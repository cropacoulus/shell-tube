"use client";

import { useState } from "react";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveAppNetwork } from "@/lib/wallet/network";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const network = resolveAppNetwork();
  const aptosApiKey = process.env.NEXT_PUBLIC_APTOS_API_KEY;

  return (
    <QueryClientProvider client={queryClient}>
      <AptosWalletAdapterProvider
        autoConnect
        dappConfig={{
          network,
          aptosApiKeys: aptosApiKey ? { [network]: aptosApiKey } : undefined,
        }}
      >
        {children}
      </AptosWalletAdapterProvider>
    </QueryClientProvider>
  );
}
