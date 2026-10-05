import clsx from "clsx";

import { formatBillAmount, formatDueIn, formatShortDate } from "~/lib/format";

/**
 * "Next bill · 10 Oct · In 5 days · Approx. ₹1,500" — a schedule's next due
 * bill, toned by urgency (overdue / within a week / later).
 */
export function NextDue({
  label = "Next bill",
  dueDate,
  amount,
  approx = false,
  timeZone,
  className,
}: {
  label?: string;
  dueDate: Date;
  amount?: number | null;
  approx?: boolean;
  timeZone: string;
  className?: string;
}) {
  const dueIn = formatDueIn(dueDate, new Date(), timeZone);
  const tone = dueIn.startsWith("Overdue")
    ? "bg-danger-soft text-danger"
    : dueIn === "Due today" ||
        dueIn === "Tomorrow" ||
        /^In [2-7] days$/.test(dueIn)
      ? "bg-warn-soft text-warn"
      : "bg-sunken text-ink-2";

  return (
    <p
      className={clsx(
        "inline-flex flex-wrap items-center gap-x-1.5 rounded-lg px-2.5 py-1.5 text-xs",
        tone,
        className,
      )}
    >
      <span className="font-semibold">{label}</span>
      <span aria-hidden="true">·</span>
      <span>{formatShortDate(dueDate)}</span>
      <span aria-hidden="true">·</span>
      <span className="font-semibold">{dueIn}</span>
      {amount != null && (
        <>
          <span aria-hidden="true">·</span>
          <span>{formatBillAmount(amount, approx)}</span>
        </>
      )}
    </p>
  );
}
