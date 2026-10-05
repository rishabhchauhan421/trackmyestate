/**
 * A tiny in-memory stand-in for the Prisma client, for end-to-end tests of
 * code that reads and writes several models (the reminder pipeline). It
 * implements only the operations and filters that code uses, with MongoDB
 * semantics where they matter:
 *
 * - An optional field that was never set is *missing*, not null: a `null`
 *   filter doesn't match it, `{ isSet: false }` does (the reason for
 *   `NOT_SOFT_DELETED` and friends).
 * - `idempotencyKey` has a unique index that, like MongoDB's, counts a
 *   missing key as a value — so two keyless jobs collide (code P2002).
 * - Writes stamp `updatedAt` with the current (possibly faked) time.
 *
 * Use it with `jest.mock("~/server/db", () => jest.requireActual(
 * "~/server/__testing__/memory-db"))`, then `resetMemoryDb()` per test.
 */

import type { PrismaClient } from "../../../generated/prisma";

type Doc = Record<string, unknown>;
type Where = Record<string, unknown>;

const MODELS = [
  "user",
  "property",
  "bill",
  "billSchedule",
  "notificationRule",
  "notificationJob",
  "guest",
  "loan",
  "policy",
  "lease",
] as const;
type Model = (typeof MODELS)[number];

/**
 * `@default(...)` values from `prisma/schema.prisma` that Prisma fills in
 * on create — keep in sync with the schema for the models used here.
 */
const DEFAULTS: Partial<Record<Model, Record<string, unknown>>> = {
  user: { emailVerified: false, currency: "INR" },
  notificationJob: { status: "SCHEDULED", retryCount: 0 },
  notificationRule: { anchor: "DUE_DATE", active: true },
  guest: { dueDayOnly: false },
  billSchedule: { active: true },
};

/** Fields with a unique index, per model (besides `id`). */
const UNIQUE: Partial<Record<Model, string[]>> = {
  notificationJob: ["idempotencyKey"],
  user: ["email"],
};

const store: Record<Model, Doc[]> = Object.fromEntries(
  MODELS.map((model) => [model, []]),
) as unknown as Record<Model, Doc[]>;

let nextId = 1;

export function resetMemoryDb() {
  for (const model of MODELS) store[model].length = 0;
  nextId = 1;
}

/** Raw access for assertions and fixtures. */
export function rows(model: Model) {
  return store[model];
}

function newId() {
  return (nextId++).toString(16).padStart(24, "0");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Date) &&
    !Array.isArray(value)
  );
}

function same(a: unknown, b: unknown) {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  return a === b;
}

function compare(a: unknown, b: unknown) {
  const x = a instanceof Date ? a.getTime() : (a as number | string);
  const y = b instanceof Date ? b.getTime() : (b as number | string);
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchesField(value: unknown, condition: unknown): boolean {
  if (condition === null) return value === null; // missing ≠ null
  if (!isPlainObject(condition)) return same(value, condition);

  return Object.entries(condition).every(([op, arg]) => {
    switch (op) {
      case "equals":
        return matchesField(value, arg);
      case "in":
        return (arg as unknown[]).some((v) => same(value, v));
      case "notIn":
        return !(arg as unknown[]).some((v) => same(value, v));
      case "gte":
        return (
          value !== undefined && value !== null && compare(value, arg) >= 0
        );
      case "gt":
        return value !== undefined && value !== null && compare(value, arg) > 0;
      case "lte":
        return (
          value !== undefined && value !== null && compare(value, arg) <= 0
        );
      case "lt":
        return value !== undefined && value !== null && compare(value, arg) < 0;
      case "isSet":
        return arg ? value !== undefined : value === undefined;
      case "not":
        return !matchesField(value, arg);
      case "has":
        return Array.isArray(value) && value.some((v) => same(v, arg));
      default:
        throw new Error(`memory-db: unsupported filter operator "${op}"`);
    }
  });
}

export function matches(doc: Doc, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") {
      return (condition as Where[]).every((w) => matches(doc, w));
    }
    if (key === "OR") {
      return (condition as Where[]).some((w) => matches(doc, w));
    }
    if (key === "NOT") return !matches(doc, condition as Where);
    return matchesField(doc[key], condition);
  });
}

function applyData(doc: Doc, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (isPlainObject(value) && "increment" in value) {
      doc[key] =
        ((doc[key] as number | undefined) ?? 0) + (value.increment as number);
    } else if (value !== undefined) {
      doc[key] = value;
    }
  }
}

function uniqueViolation(field: string) {
  return Object.assign(
    new Error(`Unique constraint failed on the fields: (\`${field}\`)`),
    { code: "P2002" },
  );
}

function checkUnique(model: Model, doc: Doc, ignoreId?: unknown) {
  for (const field of UNIQUE[model] ?? []) {
    const clash = store[model].some(
      (other) =>
        other.id !== ignoreId &&
        // Like MongoDB, a missing value is a value (null) for the index.
        (other[field] ?? null) === (doc[field] ?? null),
    );
    if (clash) throw uniqueViolation(field);
  }
}

/** Deep copy of plain records (jsdom has no `structuredClone`). */
function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, clone(v)]),
    ) as T;
  }
  return value;
}

function makeDelegate(model: Model) {
  const all = () => store[model];
  const findIndex = (where: Where) =>
    all().findIndex((doc) => matches(doc, where));

  return {
    async findMany(
      args: {
        where?: Where;
        orderBy?: Record<string, "asc" | "desc">;
        take?: number;
        skip?: number;
        cursor?: { id: string };
      } = {},
    ) {
      let result = all().filter((doc) => matches(doc, args.where));
      if (args.orderBy) {
        const [[field, dir]] = Object.entries(args.orderBy) as [
          [string, "asc" | "desc"],
        ];
        result = [...result].sort(
          (a, b) => compare(a[field], b[field]) * (dir === "desc" ? -1 : 1),
        );
      }
      if (args.cursor) {
        const at = result.findIndex((doc) => doc.id === args.cursor!.id);
        result = at === -1 ? [] : result.slice(at);
      }
      if (args.skip) result = result.slice(args.skip);
      if (args.take !== undefined) result = result.slice(0, args.take);
      return clone(result);
    },
    async findUnique(args: { where: Where }) {
      const doc = all().find((d) => matches(d, args.where));
      return doc ? clone(doc) : null;
    },
    async findFirst(args: { where?: Where } = {}) {
      const doc = all().find((d) => matches(d, args.where));
      return doc ? clone(doc) : null;
    },
    async count(args: { where?: Where } = {}) {
      return all().filter((doc) => matches(doc, args.where)).length;
    },
    async create(args: { data: Record<string, unknown> }) {
      const now = new Date();
      const doc: Doc = {
        id: newId(),
        ...clone(DEFAULTS[model] ?? {}),
        createdAt: now,
        updatedAt: now,
      };
      applyData(doc, args.data);
      checkUnique(model, doc);
      all().push(doc);
      return clone(doc);
    },
    async createMany(args: { data: Record<string, unknown>[] }) {
      for (const data of args.data) await this.create({ data });
      return { count: args.data.length };
    },
    async update(args: { where: Where; data: Record<string, unknown> }) {
      const index = findIndex(args.where);
      if (index === -1)
        throw new Error(`memory-db: ${model} to update not found`);
      const doc = { ...all()[index]! };
      applyData(doc, args.data);
      doc.updatedAt = new Date();
      checkUnique(model, doc, doc.id);
      all()[index] = doc;
      return clone(doc);
    },
    async updateMany(args: { where?: Where; data: Record<string, unknown> }) {
      let count = 0;
      all().forEach((doc, index) => {
        if (!matches(doc, args.where)) return;
        const next = { ...doc };
        applyData(next, args.data);
        next.updatedAt = new Date();
        all()[index] = next;
        count += 1;
      });
      return { count };
    },
    async deleteMany(args: { where?: Where } = {}) {
      const keep = all().filter((doc) => !matches(doc, args.where));
      const count = all().length - keep.length;
      store[model] = keep;
      return { count };
    },
  };
}

export const db = Object.fromEntries(
  MODELS.map((model) => [model, makeDelegate(model)]),
) as unknown as PrismaClient;
