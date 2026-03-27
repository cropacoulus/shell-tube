# On-Chain RBAC Migration

## Steps

1. Deploy the Move package in [aptos/role_registry/Move.toml](/Users/rifqi/Development/Pribadi/Crypto/stream-p2p/aptos/role_registry/Move.toml).
2. Call `RoleRegistry::initialize` from the bootstrap admin wallet.
3. Set `APTOS_ROLE_REGISTRY_ADDRESS` in runtime config to the deployed module address.
4. Migrate existing privileged wallets by calling `RoleRegistry::set_role` for:
   - admin wallets
   - creator wallets
5. Redeploy backend with on-chain resolver enabled.
6. Remove legacy env allowlists like `ADMIN_WALLETS` and `CREATOR_WALLETS`.

## Safe Rollout

1. Deploy module to testnet.
2. Initialize with one bootstrap admin.
3. Backfill all existing admin and creator wallets on-chain.
4. Verify:
   - `is_admin`
   - `is_creator`
5. Switch backend to new role resolver.
6. Remove old env-based role paths.

## Notes

- Safe default is `student` when no role exists on-chain.
- Cache TTL is 60 seconds, but Aptos remains authoritative.
- Event emission from `RoleRegistry::set_role` allows indexers and analytics workers to sync later.
