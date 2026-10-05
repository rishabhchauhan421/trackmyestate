const OK = "bg-ok-soft text-ok";
const WARN = "bg-warn-soft text-warn";
const DANGER = "bg-danger-soft text-danger";
const NEUTRAL = "bg-sunken-2 text-ink-2";

const STATUS_STYLES: Record<string, string> = {
  PAID: OK,
  DUE: WARN,
  OVERDUE: DANGER,
  PARTIALLY_PAID: WARN,
  CANCELLED: NEUTRAL,
  REFUNDED: "bg-accent-soft text-accent-strong",
  ACTIVE: OK,
  LAPSED: DANGER,
  MATURED: NEUTRAL,
  CLAIMED: NEUTRAL,
};

const FALLBACK_STYLE = NEUTRAL;

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide ${
        STATUS_STYLES[status] ?? FALLBACK_STYLE
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
