import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

function normalizeDatabaseUrl(value: string) {
  try {
    // URL serialisation percent-encodes reserved characters in the username
    // and password. This lets a password containing characters such as \ or @
    // work correctly when supplied in a .env DATABASE_URL value.
    const databaseUrl = new URL(value);

    if (databaseUrl.protocol === "file:") {
      throw new Error("DATABASE_URL points to a SQLite file. This project is configured for PostgreSQL; use a postgresql:// connection string instead");
    }

    if (!databaseUrl.username || !databaseUrl.password) {
      throw new Error("DATABASE_URL must include both a database username and password");
    }

    return databaseUrl.toString();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid URL";
    throw new Error(`DATABASE_URL is invalid: ${reason}`);
  }
}

const adapter = new PrismaPg({
  connectionString: normalizeDatabaseUrl(connectionString)
});

export const prisma = new PrismaClient({
  adapter
});
