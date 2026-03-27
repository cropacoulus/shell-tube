type IdempotencyPart = string | number | boolean | null | undefined;

export function buildEventIdempotencyKey(namespace: string, ...parts: IdempotencyPart[]) {
  return [namespace, ...parts]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .map((part) => String(part).trim())
    .join(":");
}
