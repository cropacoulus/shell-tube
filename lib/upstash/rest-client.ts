import { createOptionBConfig } from "@/lib/runtime/option-b-config";

type UpstashCommandResult<T = unknown> = {
  result?: T;
  error?: string;
};

function getUpstashConfig() {
  const config = createOptionBConfig();
  if (!config.upstashRedisRestUrl || !config.upstashRedisRestToken) {
    throw new Error(
      "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  return config;
}

export async function runUpstashCommand<T = unknown>(command: unknown[]) {
  const config = getUpstashConfig();
  const response = await fetch(config.upstashRedisRestUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.upstashRedisRestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash command failed with ${response.status} ${response.statusText}.`);
  }

  const body = (await response.json()) as UpstashCommandResult<T>;
  if (body.error) {
    throw new Error(`Upstash command error: ${body.error}`);
  }
  return body.result as T;
}
