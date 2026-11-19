import {
  CardSkeleton,
  PageHeaderSkeleton,
  StatRowSkeleton,
} from "~/app/_components/skeleton";

/**
 * Shown in the content column the moment a link is clicked, until the page
 * it leads to has loaded its data: the outline of a page header, a stat
 * row and two cards. The sidebar stays in place around it. Pages that
 * stream their own sections (the dashboard and the list pages) show their
 * header at once and never reach this.
 */
export default function Loading() {
  return (
    <div className="space-y-7">
      <PageHeaderSkeleton />
      <StatRowSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2" />
        <CardSkeleton />
      </div>
    </div>
  );
}
