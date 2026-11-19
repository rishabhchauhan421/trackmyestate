import type { Currency } from "../../../generated/prisma";
import { formatMoney } from "~/lib/format";

/** "5 Oct 2026" for a calendar day "YYYY-MM-DD", independent of server zone. */
function formatDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function plural(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * A reminder's subject and body. `offsetDays` is how far today is from the
 * due date (negative = still ahead). Incoming money (rent, payouts) is
 * worded as "expected"/"not received" rather than "due"/"overdue".
 */
export function reminderMessage({
  name,
  amount,
  dueDay,
  offsetDays,
  incoming,
  currency,
}: {
  name: string;
  amount: number;
  dueDay: string;
  offsetDays: number;
  incoming: boolean;
  /** The bill's currency, else the owner's. */
  currency?: Currency | null;
}) {
  const money = formatMoney(amount, currency);
  const days = Math.abs(offsetDays);

  let title: string;
  if (incoming) {
    title =
      offsetDays < 0
        ? `${name}: ${money} expected in ${plural(days)}`
        : offsetDays === 0
          ? `${name}: ${money} expected today`
          : `${name}: ${money} not received yet (${plural(days)} late)`;
  } else {
    title =
      offsetDays < 0
        ? `${name}: ${money} due in ${plural(days)}`
        : offsetDays === 0
          ? `${name}: ${money} due today`
          : `${name}: ${money} is ${plural(days)} overdue`;
  }

  const body = incoming
    ? `${name} — ${money}, expected on ${formatDay(dueDay)}.\nMark it received once it arrives, and we'll stop reminding you.`
    : `${name} — ${money}, due on ${formatDay(dueDay)}.\nMark it paid once it's done, and we'll stop reminding you.`;

  return { title, body };
}
