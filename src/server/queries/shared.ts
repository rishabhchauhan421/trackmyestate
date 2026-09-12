/** Constants shared by more than one query module. */
import "server-only";

/** Payment/bill statuses that still represent money owed (not yet settled). */
export const OPEN_PAYMENT_STATUSES = ["DUE", "OVERDUE", "PARTIALLY_PAID"] as const;

// Records created before `deletedAt` existed on a model (or created without
// explicitly setting it) simply lack the key in MongoDB rather than storing
// it as null — a plain `{ deletedAt: null }` filter only matches documents
// where the key is explicitly null, so it silently excludes those. `isSet`
// catches the "key absent" case too.
export const NOT_SOFT_DELETED = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
};
