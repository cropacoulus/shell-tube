export function getRoleRegistryModuleAddressForPayload() {
  const configured =
    process.env.NEXT_PUBLIC_APTOS_ROLE_REGISTRY_ADDRESS ||
    process.env.APTOS_ROLE_REGISTRY_ADDRESS ||
    "";
  return configured.trim().toLowerCase();
}

export function buildSubmitCreatorApplicationPayload() {
  const moduleAddress = getRoleRegistryModuleAddressForPayload();
  return {
    function: `${moduleAddress}::CreatorApplications::submit` as `${string}::${string}::${string}`,
    functionArguments: [],
    typeArguments: [],
  };
}

export function buildReviewCreatorApplicationPayload(user: string, approve: boolean) {
  const moduleAddress = getRoleRegistryModuleAddressForPayload();
  return {
    function: `${moduleAddress}::CreatorApplications::review` as `${string}::${string}::${string}`,
    functionArguments: [user.toLowerCase(), approve],
    typeArguments: [],
  };
}
