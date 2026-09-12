import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { POLICY_STATUS_LABELS, POLICY_TYPE_LABELS } from "~/lib/labels";
import { deletePolicy, updatePolicy } from "~/server/actions/policies";
import { getSession } from "~/server/better-auth/server";
import { getPolicyForOwner, hasBillsForPolicy } from "~/server/queries/policies";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

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
      <div>
        <Link
          href="/insurance"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Insurance
        </Link>
      </div>

      <PageHeader
        title={`Edit ${policy.insurer} policy`}
        description="Update this policy's details, including its status."
      />

      <form
        action={updatePolicy.bind(null, policy.id)}
        data-gtm-event="policy_updated"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Insurer</label>
            <input
              type="text"
              name="insurer"
              required
              defaultValue={policy.insurer}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue={policy.type}
              className={inputClass}
            >
              {Object.entries(POLICY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Policy number</label>
            <input
              type="text"
              name="policyNumber"
              required
              defaultValue={policy.policyNumber}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Policyholder name</label>
            <input
              type="text"
              name="holderName"
              required
              defaultValue={policy.holderName}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Status</label>
            <select
              name="status"
              required
              defaultValue={policy.status}
              className={inputClass}
            >
              {Object.entries(POLICY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Start date</label>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={toDateInputValue(policy.startDate)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Tenure (years, optional)</label>
            <input
              type="number"
              name="tenureYears"
              min="1"
              step="1"
              defaultValue={policy.tenureYears ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Nominees (comma-separated, optional)</label>
            <input
              type="text"
              name="nominees"
              defaultValue={policy.nominees.join(", ")}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Sum assured (₹, optional)</label>
            <input
              type="number"
              name="sumAssured"
              min="0"
              step="1"
              defaultValue={policy.sumAssured ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Room rent limit (₹, optional)</label>
            <input
              type="number"
              name="roomRentLimit"
              min="0"
              step="1"
              defaultValue={policy.roomRentLimit ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Co-pay % (optional)</label>
            <input
              type="number"
              name="coPayPercent"
              min="0"
              step="0.1"
              defaultValue={policy.coPayPercent ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Waiting period (months, optional)</label>
            <input
              type="number"
              name="waitingPeriodMonths"
              min="0"
              step="1"
              defaultValue={policy.waitingPeriodMonths ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save changes</Button>
          <Link
            href="/insurance"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Delete policy
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canDelete
              ? "Permanently removes this policy. Only possible when it has no premiums or claims on record."
              : "This policy has premiums or claims on record, so it can't be deleted."}
          </p>
        </div>
        <form
          action={deletePolicy.bind(null, policy.id)}
          data-gtm-event="policy_deleted"
        >
          <Button
            type="submit"
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "Bills exist for this policy"}
          >
            Delete policy
          </Button>
        </form>
      </div>
    </>
  );
}
