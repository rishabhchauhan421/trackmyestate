import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { DocumentsIcon } from "~/app/_components/icons";
import { EmptyState } from "~/app/_components/empty-state";
import { PageHeader } from "~/app/_components/page-header";
import { formatDate } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import { getUserTimeZone } from "~/server/queries/settings";
import { getDocuments } from "~/server/queries/documents";

const OWNER_TYPE_LABELS: Record<string, string> = {
  PROPERTY: "Property",
  ROOM: "Room",
  LEASE: "Lease",
  POLICY: "Policy",
  INVESTMENT: "Investment",
  LOAN: "Loan",
  BILL_SCHEDULE: "Bill schedule",
  BILL: "Bill",
};

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const timeZone = await getUserTimeZone(session.user.id);
  const documents = await getDocuments(session.user.id);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Policy PDFs, loan statements, property papers, receipts and KYC — encrypted, attached to the asset they belong to."
        action={
          <Button type="button" disabled title="Coming soon">
            Upload document
          </Button>
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          Icon={DocumentsIcon}
          title="Your vault is empty"
          description="Upload a document to attach it to a property, policy, investment or loan — or drop one in to auto-create a record."
          actionLabel="Upload your first document"
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <ul className="divide-y divide-line-soft">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {document.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {OWNER_TYPE_LABELS[document.ownerType]} · uploaded{" "}
                    {formatDate(document.uploadedAt, timeZone)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
