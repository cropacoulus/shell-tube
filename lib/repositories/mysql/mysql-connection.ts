type MySqlModule = {
  createPool: (config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) => {
    execute: (sql: string, params?: unknown[]) => Promise<[unknown[], unknown]>;
  };
};

export type MySqlConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export function parseMySqlDatabaseUrl(databaseUrl: string): MySqlConnectionConfig {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql:// scheme for the MySQL repository.");
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\/+/, ""),
  };
}

let pool:
  | {
      execute: (sql: string, params?: unknown[]) => Promise<[unknown[], unknown]>;
    }
  | null = null;

async function loadMySqlModule(): Promise<MySqlModule> {
  try {
    const runtimeImport = new Function("specifier", "return import(specifier);") as (
      specifier: string,
    ) => Promise<unknown>;
    return (await runtimeImport("mysql2/promise")) as MySqlModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error";
    throw new Error(
      `MySQL repository requires the mysql2 package. Install mysql2 before using PERSISTENCE_DRIVER=mysql. ${message}`,
    );
  }
}

export async function getMySqlPool() {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when PERSISTENCE_DRIVER=mysql.");
  }

  const mysql = await loadMySqlModule();
  pool = mysql.createPool(parseMySqlDatabaseUrl(databaseUrl));
  return pool;
}
