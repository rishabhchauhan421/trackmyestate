/**
 * The app's singleton Prisma client. In development it's cached on
 * `globalThis` so Next.js's hot-reload doesn't spin up a fresh
 * `PrismaClient` (and a new MongoDB connection pool) on every file edit.
 *
 * The cache also remembers which generated `PrismaClient` class built the
 * instance. After `prisma generate` (e.g. a schema change), the generated
 * module is reloaded with a new class, so the stale instance — which would
 * reject new models and fields ("Unknown field …", `db.newModel` undefined)
 * — is disconnected and replaced instead of being reused. A server that
 * was already running when the schema changed may still need one restart
 * to load the new generated code.
 */
import { env } from "../env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
  prismaClass: typeof PrismaClient | undefined;
};

function getPrismaClient() {
  const cached = globalForPrisma.prisma;
  if (cached && globalForPrisma.prismaClass === PrismaClient) return cached;

  // Built from an older generated client — close its connections.
  void cached?.$disconnect();

  const client = createPrismaClient();
  if (env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaClass = PrismaClient;
  }
  return client;
}

export const db = getPrismaClient();
