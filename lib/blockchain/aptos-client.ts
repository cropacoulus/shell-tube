import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";

import { resolveAppNetwork } from "@/lib/wallet/network";

let aptosClient: Aptos | null = null;

export function getAptosClient() {
  if (!aptosClient) {
    aptosClient = new Aptos(
      new AptosConfig({
        network: resolveAppNetwork(),
      }),
    );
  }
  return aptosClient;
}
