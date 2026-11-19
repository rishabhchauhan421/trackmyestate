import { permanentRedirect } from "next/navigation";

/**
 * Old address of a utility bill's page, kept so saved links still work:
 * every bill now has one page at `/bills/[id]`.
 */
export default async function UtilityBillRedirect({
  params,
}: {
  params: Promise<{ id: string; billId: string }>;
}) {
  const { billId } = await params;
  permanentRedirect(`/bills/${billId}`);
}
