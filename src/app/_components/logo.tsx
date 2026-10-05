/** The TrackMyEstate mark and wordmark. Inherits its text color. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-mint font-display text-[1.0625rem] font-bold text-night">
        T
      </span>
      <span className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em]">
        TrackMyEstate
      </span>
    </span>
  );
}
