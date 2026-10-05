/**
 * Cron entry point for the bill generator. Vercel Cron (see `vercel.json`)
 * hits this daily with `Authorization: Bearer $CRON_SECRET`, before the
 * hourly reminder run, so a newly generated bill is reminded about the
 * same day. Admins can also run it from the admin portal.
 */
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { generateBills } from "~/server/bills/generate";

// Comfortably above the generator's time budget (`TIME_BUDGET_MS`, 45s).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await generateBills();
  return NextResponse.json(summary);
}
