export function isAptosAddress(value: string) {
  return /^0x[a-fA-F0-9]{1,64}$/.test(value);
}

export function buildWalletSignInMessage(params: {
  domain: string;
  address: string;
  nonce: string;
  chainId?: number;
  issuedAt: string;
}) {
  const statement =
    process.env.WALLET_SIGNIN_STATEMENT ||
    "Sign this message to authenticate with Verra.";
  const lines = [
    `${params.domain} wants you to sign in with your Aptos account:`,
    params.address,
    "",
    statement,
    "",
    `URI: https://${params.domain}`,
    "Version: 1",
    `Chain ID: ${params.chainId ?? 1}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
  ];
  return lines.join("\n");
}
