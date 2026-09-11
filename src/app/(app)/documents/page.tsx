import { DocumentsIcon } from "~/app/_components/icons";
import { EmptyState } from "~/app/_components/empty-state";
import { PageHeader } from "~/app/_components/page-header";

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Policy PDFs, loan statements, property papers, receipts and KYC — encrypted, attached to the asset they belong to."
        action={
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white opacity-40"
          >
            Upload document
          </button>
        }
      />

      <EmptyState
        Icon={DocumentsIcon}
        title="Your vault is empty"
        description="Upload a document to attach it to a property, policy, investment or loan — or drop one in to auto-create a record."
        actionLabel="Upload your first document"
      />
    </>
  );
}
