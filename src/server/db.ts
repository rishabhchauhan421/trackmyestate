/**
 * The app's singleton Prisma client. In development it's cached on
 * `globalThis` so Next.js's hot-reload doesn't spin up a fresh
 * `PrismaClient` (and a new MongoDB connection pool) on every file edit.
 *
 * That caching has a real consequence: after changing `prisma/schema.prisma`
 * and running `db:push`/`prisma generate`, this cached client still reflects
 * the *old* schema until the dev server process itself is restarted — a file
 * save alone isn't enough, because the cached instance was built from the
 * previously-generated client code.
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
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
