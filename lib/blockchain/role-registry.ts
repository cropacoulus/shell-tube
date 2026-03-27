import { runUpstashCommand } from "@/lib/upstash/rest-client";
import { isAptosAddress } from "@/lib/auth/wallet";
import { getAptosClient } from "@/lib/blockchain/aptos-client";
import type { UserRole } from "@/lib/contracts/profile";

const ROLE_CACHE_TTL_SECONDS = 60;

export type OnChainUserRole = {
  admin: boolean;
  creator: boolean;
};

export type OnChainCreatorApplicationStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

function getRoleRegistryModuleAddress() {
  const configured =
    process.env.APTOS_ROLE_REGISTRY_ADDRESS ||
    process.env.NEXT_PUBLIC_APTOS_ROLE_REGISTRY_ADDRESS ||
    "";
  const normalized = configured.trim().toLowerCase();
  if (!normalized || !isAptosAddress(normalized)) {
    throw new Error("APTOS_ROLE_REGISTRY_ADDRESS is not configured with a valid Aptos address.");
  }
  return normalized;
}

function getRoleCacheKey(address: string) {
  return `verra:role-registry:${getRoleRegistryModuleAddress()}:${address.toLowerCase()}`;
}

async function readRoleCache(address: string): Promise<OnChainUserRole | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  const raw = await runUpstashCommand<string | null>(["GET", getRoleCacheKey(address)]).catch(() => null);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OnChainUserRole>;
    if (typeof parsed.admin !== "boolean" || typeof parsed.creator !== "boolean") return null;
    return {
      admin: parsed.admin,
      creator: parsed.creator,
    };
  } catch {
    return null;
  }
}

async function writeRoleCache(address: string, role: OnChainUserRole) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return;
  await runUpstashCommand([
    "SETEX",
    getRoleCacheKey(address),
    ROLE_CACHE_TTL_SECONDS,
    JSON.stringify(role),
  ]).catch(() => null);
}

async function runBooleanView(functionName: string, address: string) {
  const aptos = getAptosClient();
  const payload = {
    function: `${getRoleRegistryModuleAddress()}::RoleRegistry::${functionName}` as `${string}::${string}::${string}`,
    functionArguments: [address.toLowerCase()],
    typeArguments: [],
  };
  const result = await aptos.view({ payload });
  const raw = Array.isArray(result) ? result[0] : result;
  return raw === true || raw === "true";
}

async function runNumericView(functionName: string, address: string) {
  const aptos = getAptosClient();
  const payload = {
    function: `${getRoleRegistryModuleAddress()}::CreatorApplications::${functionName}` as `${string}::${string}::${string}`,
    functionArguments: [address.toLowerCase()],
    typeArguments: [],
  };
  const result = await aptos.view({ payload });
  const raw = Array.isArray(result) ? result[0] : result;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number.parseInt(raw, 10);
  return Number.NaN;
}

function mapCreatorApplicationStatus(code: number): OnChainCreatorApplicationStatus {
  switch (code) {
    case 1:
      return "pending";
    case 2:
      return "approved";
    case 3:
      return "rejected";
    default:
      return "none";
  }
}

export async function getUserRole(address: string): Promise<OnChainUserRole> {
  const normalized = address.toLowerCase();
  if (!isAptosAddress(normalized)) {
    throw new Error("Invalid Aptos address.");
  }

  const cached = await readRoleCache(normalized);
  if (cached) return cached;

  const [admin, creator] = await Promise.all([
    runBooleanView("is_admin", normalized),
    runBooleanView("is_creator", normalized),
  ]);
  const role = { admin, creator };
  await writeRoleCache(normalized, role);
  return role;
}

export async function getUserRoleOrDefault(address: string): Promise<OnChainUserRole> {
  try {
    return await getUserRole(address);
  } catch {
    return {
      admin: false,
      creator: false,
    };
  }
}

export async function getUserRoleKind(address: string): Promise<UserRole> {
  const role = await getUserRoleOrDefault(address);
  if (role.admin) return "admin";
  if (role.creator) return "creator";
  return "student";
}

export async function requireAdmin(address: string) {
  const role = await getUserRole(address);
  if (!role.admin) {
    throw new Error("Unauthorized");
  }
  return role;
}

export async function requireCreator(address: string) {
  const role = await getUserRole(address);
  if (!role.admin && !role.creator) {
    throw new Error("Unauthorized");
  }
  return role;
}

export async function getCreatorApplicationStatus(address: string): Promise<OnChainCreatorApplicationStatus> {
  const normalized = address.toLowerCase();
  if (!isAptosAddress(normalized)) {
    throw new Error("Invalid Aptos address.");
  }

  const statusCode = await runNumericView("status", normalized);
  return mapCreatorApplicationStatus(statusCode);
}
