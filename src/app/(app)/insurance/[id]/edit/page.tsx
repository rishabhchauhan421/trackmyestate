import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { POLICY_STATUS_LABELS, POLICY_TYPE_LABELS } from "~/lib/labels";
import { deletePolicy, updatePolicy } from "~/server/actions/policies";
import { getSession } from "~/server/better-auth/server";
import {
  getPolicyForOwner,
  hasBillsForPolicy,
} from "~/server/queries/policies";

export default async function EditPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const policy = await getPolicyForOwner(id, session.user.id);
  if (!policy) {
    notFound();
  }

  const canDelete = !(await hasBillsForPolicy(id));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Insurance", href: "/insurance" },
          { label: policy.insurer },
          { label: "Edit" },
        ]}
        title={`Edit ${policy.insurer} policy`}
        description="Update this policy's details, including its status."
      />

      <form
        action={updatePolicy.bind(null, policy.id)}
        data-gtm-event="policy_updated"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Insurer</span>
            <input
              type="text"
              name="insurer"
              required
              defaultValue={policy.insurer}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              name="type"
              required
              defaultValue={policy.type}
              className={controlClass}
            >
              {Object.entries(POLICY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Policy number</span>
            <input
              type="text"
              name="policyNumber"
              required
              defaultValue={policy.policyNumber}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Policyholder name</span>
            <input
              type="text"
              name="holderName"
              required
              defaultValue={policy.holderName}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Status</span>
            <select
              name="status"
              required
              defaultValue={policy.status}
              className={controlClass}
            >
              {Object.entries(POLICY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Start date</span>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={toDateInputValue(policy.startDate)}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Tenure (years, optional)</span>
            <input
              type="number"
              name="tenureYears"
              min="1"
              step="1"
              defaultValue={policy.tenureYears ?? ""}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Nominees (comma-separated, optional)
            </span>
            <input
              type="text"
              name="nominees"
              defaultValue={policy.nominees.join(", ")}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Sum assured (₹, optional)</span>
            <input
              type="number"
              name="sumAssured"
              min="0"
              step="1"
              defaultValue={policy.sumAssured ?? ""}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Room rent limit (₹, optional)</span>
            <input
              type="number"
              name="roomRentLimit"
              min="0"
              step="1"
              defaultValue={policy.roomRentLimit ?? ""}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Co-pay % (optional)</span>
            <input
              type="number"
              name="coPayPercent"
              min="0"
              step="0.1"
              defaultValue={policy.coPayPercent ?? ""}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Waiting period (months, optional)
            </span>
            <input
              type="number"
              name="waitingPeriodMonths"
              min="0"
              step="1"
              defaultValue={policy.waitingPeriodMonths ?? ""}
              className={controlClass}
            />
          </label>
        </div>

        <FormActions>
          <Button href="/insurance" variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save changes</SubmitButton>
        </FormActions>
      </form>

      <div className="max-w-3xl space-y-4 rounded-card border border-line bg-surface p-6">
        <div>
          <p className="text-sm font-semibold text-ink">Delete policy</p>
          <p className="mt-1 text-xs text-muted">
            {canDelete
              ? "Permanently removes this policy. Only possible when it has no premiums or claims on record."
              : "This policy has premiums or claims on record, so it can't be deleted."}
          </p>
        </div>
        <form
          action={deletePolicy.bind(null, policy.id)}
          data-gtm-event="policy_deleted"
        >
          <SubmitButton
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "Bills exist for this policy"}
          >
            Delete policy
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
