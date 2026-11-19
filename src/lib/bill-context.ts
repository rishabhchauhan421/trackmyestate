/**
 * How a bill is named and where it links back to, from what it belongs to.
 * Pure (no database), so the bill page, lists and tests share one answer.
 */
import type { BillType, EventCategory } from "../../generated/prisma";
import { BILL_TYPE_LABELS, EVENT_CATEGORY_LABELS } from "./labels";

/** The parts of a bill (and its relations) that `billTitle` reads. */
export interface BillContextInput {
  category: EventCategory;
  description?: string | null;
  label?: string | null;
  property?: { id: string; name: string } | null;
  lease?: { id: string; tenantName: string; propertyId: string } | null;
  loan?: { id: string; lender: string } | null;
  policy?: { id: string; insurer: string } | null;
  investment?: { id: string; name: string } | null;
  billSchedule?: { billType: BillType | null; provider: string | null } | null;
}

/** e.g. "Tata Power · Electricity", "EMI · HDFC Bank", "Rent · Priya Shah". */
export function billTitle(bill: BillContextInput): string {
  if (bill.description) return bill.description;
  if (bill.label) return bill.label;

  const category = EVENT_CATEGORY_LABELS[bill.category];
  const schedule = bill.billSchedule;
  if (bill.category === "UTILITY_BILL" && schedule?.billType) {
    const type = BILL_TYPE_LABELS[schedule.billType];
    return schedule.provider ? `${schedule.provider} · ${type}` : type;
  }
  const party =
    bill.lease?.tenantName ??
    bill.loan?.lender ??
    bill.policy?.insurer ??
    bill.investment?.name;
  return party ? `${category} · ${party}` : category;
}

/** The record the bill belongs to, for a "back to" link. */
export function billAsset(
  bill: BillContextInput,
): { label: string; href: string } | null {
  if (bill.lease) {
    return {
      label: bill.lease.tenantName,
      href: `/properties/${bill.lease.propertyId}/leases`,
    };
  }
  if (bill.property) {
    return {
      label: bill.property.name,
      href:
        bill.category === "UTILITY_BILL"
          ? `/properties/${bill.property.id}/utilities`
          : `/properties/${bill.property.id}`,
    };
  }
  if (bill.loan) {
    return { label: bill.loan.lender, href: `/loans/${bill.loan.id}/edit` };
  }
  if (bill.policy) {
    return {
      label: bill.policy.insurer,
      href: `/insurance/${bill.policy.id}/edit`,
    };
  }
  if (bill.investment) {
    return {
      label: bill.investment.name,
      href: `/investments/${bill.investment.id}/edit`,
    };
  }
  return null;
}
