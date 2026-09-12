import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { DocumentsIcon } from "~/app/_components/icons";
import { EmptyState } from "~/app/_components/empty-state";
import { PageHeader } from "~/app/_components/page-header";
import { formatDate } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {document.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {OWNER_TYPE_LABELS[document.ownerType]} · uploaded{" "}
                    {formatDate(document.uploadedAt)}
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
