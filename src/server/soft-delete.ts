/**
 * Soft deletes, enforced in one place. Most domain models are never really
 * deleted: they get a `deletedAt` and are expected to disappear from every
 * read. Repeating `NOT_SOFT_DELETED` in each query by hand is how deleted
 * records leaked into dashboard totals and lists, so `~/server/db` runs every
 * read on these models through `excludeSoftDeleted` instead.
 *
 * A query that names `deletedAt` anywhere in its `where` (for example an
 * admin view that wants deleted rows, or `{ deletedAt: { not: null } }`) is
 * left alone: it has said what it wants.
 */

/** Models with a `deletedAt` column (Prisma model names). */
export const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set([
  "Property",
  "Room",
  "Lease",
  "BillSchedule",
  "Bill",
  "Policy",
  "Investment",
  "Loan",
  "PaymentTransaction",
  "NotificationRule",
  "Document",
  "Guest",
  "PropertyIssue",
]);

/** Read operations whose `where` gets the not-deleted filter. */
export const SOFT_DELETE_READS: ReadonlySet<string> = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * Matches documents with no `deletedAt`. A key that was never written is
 * *missing* in MongoDB, not null, so both cases are needed.
 */
export const NOT_DELETED_WHERE = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
};

function mentionsDeletedAt(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(mentionsDeletedAt);
  if (typeof value !== "object" || value === null || value instanceof Date) {
    return false;
  }
  return Object.entries(value).some(
    ([key, inner]) => key === "deletedAt" || mentionsDeletedAt(inner),
  );
}

/** `where` narrowed to rows that aren't soft-deleted (see the file comment). */
export function excludeSoftDeleted<W extends object>(
  where: W | undefined,
): W | { AND: unknown[] } | typeof NOT_DELETED_WHERE {
  if (!where || Object.keys(where).length === 0) return NOT_DELETED_WHERE;
  if (mentionsDeletedAt(where)) return where;
  return { AND: [where, NOT_DELETED_WHERE] };
}

/** Whether `operation` on `model` should get the not-deleted filter. */
export function appliesSoftDeleteFilter(model: string, operation: string) {
  return SOFT_DELETE_MODELS.has(model) && SOFT_DELETE_READS.has(operation);
}
