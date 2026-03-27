module role_registry::CreatorApplications {
    use std::error;
    use std::signer;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};
    use role_registry::RoleRegistry;

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_ALREADY_PRIVILEGED: u64 = 3;
    const E_APPLICATION_ALREADY_ACTIVE: u64 = 4;
    const E_APPLICATION_NOT_PENDING: u64 = 5;
    const E_NOT_ADMIN: u64 = 6;

    const STATUS_NONE: u8 = 0;
    const STATUS_PENDING: u8 = 1;
    const STATUS_APPROVED: u8 = 2;
    const STATUS_REJECTED: u8 = 3;

    struct ApplicationRecord has copy, drop, store {
        status: u8,
        reviewed_by: address,
    }

    #[event]
    struct CreatorApplicationSubmitted has drop, store {
        user: address,
    }

    #[event]
    struct CreatorApplicationReviewed has drop, store {
        actor: address,
        user: address,
        approved: bool,
    }

    struct Registry has key {
        applications: Table<address, ApplicationRecord>,
    }

    public entry fun initialize(account: &signer) {
        let registry_address = signer::address_of(account);
        assert!(!exists<Registry>(registry_address), error::already_exists(E_ALREADY_INITIALIZED));
        move_to(account, Registry {
            applications: table::new<address, ApplicationRecord>(),
        });
    }

    public entry fun submit(user: &signer) acquires Registry {
        let registry_address = @role_registry;
        assert!(exists<Registry>(registry_address), error::not_found(E_NOT_INITIALIZED));

        let applicant = signer::address_of(user);
        assert!(
            !RoleRegistry::is_admin(applicant) && !RoleRegistry::is_creator(applicant),
            error::already_exists(E_ALREADY_PRIVILEGED)
        );

        let registry = borrow_global_mut<Registry>(registry_address);
        let next_record = ApplicationRecord {
            status: STATUS_PENDING,
            reviewed_by: @0x0,
        };

        if (table::contains(&registry.applications, applicant)) {
            let current = table::borrow(&registry.applications, applicant);
            assert!(
                current.status == STATUS_REJECTED,
                error::already_exists(E_APPLICATION_ALREADY_ACTIVE)
            );
            *table::borrow_mut(&mut registry.applications, applicant) = next_record;
        } else {
            table::add(&mut registry.applications, applicant, next_record);
        };

        event::emit(CreatorApplicationSubmitted {
            user: applicant,
        });
    }

    public entry fun review(admin: &signer, user: address, approve: bool) acquires Registry {
        let registry_address = @role_registry;
        assert!(exists<Registry>(registry_address), error::not_found(E_NOT_INITIALIZED));

        let actor = signer::address_of(admin);
        assert!(RoleRegistry::is_admin(actor), error::permission_denied(E_NOT_ADMIN));

        let registry = borrow_global_mut<Registry>(registry_address);
        assert!(table::contains(&registry.applications, user), error::not_found(E_APPLICATION_NOT_PENDING));

        let application = table::borrow_mut(&mut registry.applications, user);
        assert!(application.status == STATUS_PENDING, error::invalid_state(E_APPLICATION_NOT_PENDING));

        application.status = if (approve) { STATUS_APPROVED } else { STATUS_REJECTED };
        application.reviewed_by = actor;

        if (approve) {
            RoleRegistry::set_role(
                admin,
                user,
                RoleRegistry::is_admin(user),
                true,
            );
        };

        event::emit(CreatorApplicationReviewed {
            actor,
            user,
            approved: approve,
        });
    }

    #[view]
    public fun status(addr: address): u8 acquires Registry {
        let registry_address = @role_registry;
        if (!exists<Registry>(registry_address)) {
            return STATUS_NONE
        };

        let registry = borrow_global<Registry>(registry_address);
        if (!table::contains(&registry.applications, addr)) {
            return STATUS_NONE
        };

        table::borrow(&registry.applications, addr).status
    }
}
