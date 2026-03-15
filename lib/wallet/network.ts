import { Network } from "@aptos-labs/ts-sdk";

export function resolveAppNetwork(): Network {
  const value = (process.env.NEXT_PUBLIC_APTOS_NETWORK || "testnet").toLowerCase();
  if (value === "mainnet") return Network.MAINNET;
  if (value === "devnet") return Network.DEVNET;
  if (value === "local" || value === "localnet") return Network.LOCAL;
  if (value === "shelbynet") return Network.SHELBYNET;
  return Network.TESTNET;
}

export function resolveShelbyNetwork(): Network.TESTNET | Network.SHELBYNET | Network.LOCAL {
  const network = resolveAppNetwork();
  if (network === Network.SHELBYNET || network === Network.LOCAL) return network;
  return Network.TESTNET;
}

