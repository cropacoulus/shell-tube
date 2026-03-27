module role_registry::RoleRegistry {
    use std::error;
    use std::signer;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_NOT_ADMIN: u64 = 3;

    /// Compact role flags stored per address in the registry table.
    /// This is intentionally not published under each user address because
    /// Aptos cannot mutate a resource under an arbitrary account without
    /// that account's signer.
    struct Roles has copy, drop, store {
        admin: bool,
        creator: bool,
    }

    #[event]
    struct RoleUpdated has drop, store {
        actor: address,
        user: address,
        admin: bool,
        creator: bool,
    }

    struct Registry has key {
        roles: Table<address, Roles>,
    }

    public entry fun initialize(account: &signer) {
        let registry_address = signer::address_of(account);
        assert!(!exists<Registry>(registry_address), error::already_exists(E_ALREADY_INITIALIZED));

        let roles = table::new<address, Roles>();
        // Bootstrap the initializer as the first admin so the registry
        // is operable immediately after deployment.
        table::add(&mut roles, registry_address, Roles { admin: true, creator: false });
        move_to(account, Registry { roles });
    }

    public entry fun set_role(admin: &signer, user: address, is_admin: bool, is_creator: bool) acquires Registry {
        let registry_address = @role_registry;
        assert!(exists<Registry>(registry_address), error::not_found(E_NOT_INITIALIZED));

        let actor = signer::address_of(admin);
        assert!(is_admin(actor), error::permission_denied(E_NOT_ADMIN));

        let registry = borrow_global_mut<Registry>(registry_address);
        let next_roles = Roles {
            admin: is_admin,
            creator: is_creator,
        };

        if (table::contains(&registry.roles, user)) {
            *table::borrow_mut(&mut registry.roles, user) = next_roles;
        } else {
            table::add(&mut registry.roles, user, next_roles);
        };

        event::emit(RoleUpdated {
            actor,
            user,
            admin: is_admin,
            creator: is_creator,
        });
    }

    #[view]
    public fun is_admin(addr: address): bool acquires Registry {
        let registry_address = @role_registry;
        if (!exists<Registry>(registry_address)) {
            return false
        };

        let registry = borrow_global<Registry>(registry_address);
        if (!table::contains(&registry.roles, addr)) {
            return false
        };

        table::borrow(&registry.roles, addr).admin
    }

    #[view]
    public fun is_creator(addr: address): bool acquires Registry {
        let registry_address = @role_registry;
        if (!exists<Registry>(registry_address)) {
            return false
        };

        let registry = borrow_global<Registry>(registry_address);
        if (!table::contains(&registry.roles, addr)) {
            return false
        };

        table::borrow(&registry.roles, addr).creator
    }
}
