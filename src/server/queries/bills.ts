import "server-only";

import { db } from "~/server/db";

/**
 * `Bill`s for a property, scoped to one category — the generic query
 * primitive behind the (still per-domain) UI pages. Category-specific
 * enrichment — e.g. utility type/provider — is layered on top by the caller,
 * not here.
 */
export async function getBillsForProperty(
  propertyId: string,
  category: "UTILITY_BILL" | "RENT",
) {
  return db.bill.findMany({
    where: { propertyId, category },
    orderBy: { dueDate: "desc" },
  });
}
