/**
 * The bill generator on its own, for `Authorization: Bearer $CRON_SECRET`
 * callers (GitHub Actions' manual run, scripts). The scheduled daily run
 * is part of `/api/cron/daily`; admins can also run it from Admin › Jobs.
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
