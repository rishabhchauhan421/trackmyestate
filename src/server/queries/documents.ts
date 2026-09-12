import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

type DocumentOwnerFields = {
  propertyId: string | null;
  roomId: string | null;
  leaseId: string | null;
  policyId: string | null;
  investmentId: string | null;
  loanId: string | null;
  billScheduleId: string | null;
  billId: string | null;
};

/**
 * A `Document`'s owner is one of its exclusive-arc foreign keys (only one is
 * ever populated per row) rather than a single `ownerType`/`ownerRefId`
 * pair — this derives the display label the same way `Room.occupancyStatus`
 * is now derived from its active `Lease`.
 */
function ownerType(document: DocumentOwnerFields) {
  if (document.roomId) return "ROOM" as const;
  if (document.leaseId) return "LEASE" as const;
  if (document.policyId) return "POLICY" as const;
  if (document.investmentId) return "INVESTMENT" as const;
  if (document.loanId) return "LOAN" as const;
  if (document.billScheduleId) return "BILL_SCHEDULE" as const;
  if (document.billId) return "BILL" as const;
  return "PROPERTY" as const;
}

/** Documents for the Documents page (there's no upload flow yet, so usually empty). */
export async function getDocuments(ownerId: string) {
  const documents = await db.document.findMany({
    where: { ownerId },
    orderBy: { uploadedAt: "desc" },
  });

  return documents.map((document) => ({
    ...document,
    ownerType: ownerType(document),
  }));
}

/**
 * Documents attached to a single lease, for the lease edit page's
 * read-only documents list. Usually empty — there's no upload flow yet (see
 * `getDocuments`), so this only ever shows something once a document gets
 * attached some other way.
 */
export async function getDocumentsForLease(leaseId: string, ownerId: string) {
  return db.document.findMany({
    where: {
      ownerId,
      leaseId,
      ...NOT_SOFT_DELETED,
    },
    orderBy: { uploadedAt: "desc" },
  });
}
