export type PersistenceDriver = "json" | "mysql";

export type PersistenceConfig = {
  driver: PersistenceDriver;
  databaseUrl?: string;
};

export function getPersistenceDriver(value: string | undefined): PersistenceDriver {
  return value === "mysql" ? "mysql" : "json";
}

export function createPersistenceConfig(
  env: Record<string, string | undefined> = process.env,
): PersistenceConfig {
  return {
    driver: getPersistenceDriver(env.PERSISTENCE_DRIVER),
    databaseUrl: env.DATABASE_URL,
  };
}
