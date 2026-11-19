/**
 * One-off data migrations for existing databases. Each step runs once: it's
 * recorded in the `AppMigration` collection when it finishes, and skipped on
 * later runs, so the script is safe to run again (for example after a step
 * failed halfway — a money step is split per field for exactly that reason).
 *
 * Run it BEFORE `prisma db push` and before deploying the code that needs
 * it (see "Deploying" in the README):
 *
 *   pnpm tsx scripts/migrate-data.ts           # apply
 *   pnpm tsx scripts/migrate-data.ts --dry-run # only report what would change
 *
 * Steps use raw MongoDB commands, not Prisma model queries, because the new
 * Prisma schema can't read documents in the old shape (for example a bill
 * with no `generationKey`).
 */
import { PrismaClient } from "../generated/prisma";
import { addDays, calendarDayOf, dateOnly } from "../src/lib/calendar-day";
import { firstDueDayAfter } from "../src/lib/schedule";

const db = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type RawDoc = Record<string, unknown>;

interface CommandResult {
  n?: number;
  nModified?: number;
  cursor?: { firstBatch: RawDoc[]; id?: unknown };
}

async function run(command: Record<string, unknown>) {
  return (await db.$runCommandRaw(
    command as Parameters<typeof db.$runCommandRaw>[0],
  )) as CommandResult;
}

const oid = (value: unknown) =>
  typeof value === "string"
    ? value
    : ((value as { $oid?: string } | null)?.$oid ?? String(value));

/** A date from extended JSON: `{ $date: "…" }` or `{ $date: { $numberLong } }`. */
const toDate = (value: unknown) => {
  let raw = (value as { $date?: unknown } | null)?.$date ?? value;
  if (typeof raw === "object" && raw !== null && "$numberLong" in raw) {
    raw = Number((raw as { $numberLong: string }).$numberLong);
  }
  return new Date(raw as string | number);
};

const isoDay = (value: unknown) => toDate(value).toISOString().slice(0, 10);

/** Every document of `collection` matching `filter`, with `projection`. */
async function findAll(
  collection: string,
  filter: RawDoc,
  projection: RawDoc,
): Promise<RawDoc[]> {
  const result = await db.$runCommandRaw({
    aggregate: collection,
    pipeline: [{ $match: filter }, { $project: projection }],
    cursor: {},
  } as Parameters<typeof db.$runCommandRaw>[0]);
  // Prisma's raw `aggregate` returns the whole result in `firstBatch` only
  // up to the server's batch size, so page with `getMore` until done.
  const docs: RawDoc[] = [];
  let cursor = (result as CommandResult).cursor;
  for (;;) {
    docs.push(...(cursor?.firstBatch ?? []));
    const nextBatch = (cursor as { nextBatch?: RawDoc[] } | undefined)
      ?.nextBatch;
    if (nextBatch) docs.push(...nextBatch);
    const id = cursor?.id as { $numberLong?: string } | number | undefined;
    const done =
      id === undefined ||
      id === 0 ||
      (typeof id === "object" && id.$numberLong === "0");
    if (done) break;
    const more = await run({ getMore: id, collection });
    cursor = (more as { cursor?: CommandResult["cursor"] }).cursor;
  }
  return docs;
}

async function setFields(collection: string, id: string, fields: RawDoc) {
  await run({
    update: collection,
    updates: [{ q: { _id: { $oid: id } }, u: { $set: fields } }],
  });
}

async function hasRun(name: string) {
  return (await db.appMigration.findUnique({ where: { name } })) !== null;
}

async function step(name: string, apply: () => Promise<string>) {
  if (await hasRun(name)) {
    console.log(`✓ ${name} (already done)`);
    return;
  }
  const summary = await apply();
  if (!DRY_RUN) await db.appMigration.create({ data: { name } });
  console.log(`${DRY_RUN ? "·" : "✓"} ${name}: ${summary}`);
}

/**
 * `Bill.generationKey` is unique and required. A bill a schedule generated
 * gets "<scheduleId>:<day>"; if two bills already share that key (the
 * duplicate this index now prevents), the later one is soft-deleted and
 * keyed by its id. Any other bill gets "bill:<id>".
 */
async function billGenerationKeys() {
  const bills = await findAll(
    "Bill",
    {
      $or: [{ generationKey: { $exists: false } }, { generationKey: null }],
    },
    { _id: 1, billScheduleId: 1, dueDate: 1, deletedAt: 1, createdAt: 1 },
  );
  bills.sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime(),
  );
  const used = new Set(
    (
      await findAll(
        "Bill",
        { generationKey: { $type: "string" } },
        { generationKey: 1 },
      )
    ).map((doc) => doc.generationKey as string),
  );

  let keyed = 0;
  let duplicates = 0;
  for (const bill of bills) {
    const id = oid(bill._id);
    let key = bill.billScheduleId
      ? `${oid(bill.billScheduleId)}:${isoDay(bill.dueDate)}`
      : `bill:${id}`;
    const fields: RawDoc = {};
    if (used.has(key)) {
      key = `duplicate:${id}`;
      duplicates += 1;
      if (!bill.deletedAt)
        fields.deletedAt = { $date: new Date().toISOString() };
    }
    used.add(key);
    fields.generationKey = key;
    if (!DRY_RUN) await setFields("Bill", id, fields);
    keyed += 1;
  }
  return `${keyed} bills keyed, ${duplicates} duplicates soft-deleted`;
}

/** Money fields, by MongoDB collection (Lease is stored as "Tenant"). */
const MONEY_FIELDS: Record<string, string[]> = {
  Property: ["purchasePrice", "currentEstimatedValue"],
  Tenant: ["rentAmount", "depositAmount"],
  BillSchedule: ["defaultAmount"],
  Bill: ["amount", "paidAmount", "principalComponent", "interestComponent"],
  Policy: ["sumAssured", "roomRentLimit"],
  Investment: ["capitalDeployed", "currentEstimatedValue"],
  Loan: ["principal", "outstandingBalance"],
  PaymentTransaction: ["amount"],
};

/** Rupees → whole paise, one field at a time (see the file comment). */
async function moneyToMinorUnits(collection: string, field: string) {
  const filter = { [field]: { $type: "number" } };
  if (DRY_RUN) {
    const docs = await findAll(collection, filter, { _id: 1 });
    return `${docs.length} values would be converted`;
  }
  const result = await run({
    update: collection,
    updates: [
      {
        q: filter,
        u: [
          {
            $set: {
              [field]: { $round: [{ $multiply: [`$${field}`, 100] }, 0] },
            },
          },
        ],
        multi: true,
      },
    ],
  });
  return `${result.nModified ?? result.n ?? 0} values converted`;
}

/**
 * Every user gets a personal household and their records move into it. The
 * app also does this lazily on first use (`ensureHousehold`); running it
 * here means the background jobs see households for everyone straight away.
 */
async function households() {
  const users = await db.user.findMany({ select: { id: true, name: true } });
  let created = 0;
  for (const user of users) {
    const member = await db.householdMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    let householdId = member?.householdId;
    if (!householdId) {
      created += 1;
      if (DRY_RUN) continue;
      const household = await db.household.create({
        data: {
          name: user.name ? `${user.name}'s household` : "My household",
          personalForUserId: user.id,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
      });
      householdId = household.id;
    }
    if (DRY_RUN) continue;
    for (const collection of [
      "Property",
      "Policy",
      "Investment",
      "Loan",
      "BillSchedule",
      "Bill",
      "Document",
      "PaymentTransaction",
    ]) {
      await run({
        update: collection,
        updates: [
          {
            q: {
              ownerId: { $oid: user.id },
              $or: [{ householdId: { $exists: false } }, { householdId: null }],
            },
            u: { $set: { householdId: { $oid: householdId } } },
            multi: true,
          },
        ],
      });
    }
  }
  return `${users.length} users, ${created} households created`;
}

/**
 * Leases now bill their rent through a RENT schedule (see
 * `src/server/actions/leases.ts`). Every active lease without one gets
 * one, due on its `rentDueDay` (or, if it never had one, the day of the
 * month it started, which is also saved as its due day). The next bill run
 * creates the bills. Runs after "households" so each schedule gets its
 * property's household.
 */
async function rentSchedules() {
  const leases = await db.lease.findMany({
    where: {
      active: true,
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    },
    include: { property: { select: { ownerId: true, householdId: true } } },
  });
  let created = 0;
  for (const lease of leases) {
    const existing = await db.billSchedule.findFirst({
      where: { leaseId: lease.id, category: "RENT" },
      select: { id: true },
    });
    if (existing) continue;
    created += 1;
    if (DRY_RUN) continue;

    const dueDay = lease.rentDueDay ?? lease.leaseStart.getUTCDate();
    const dayBeforeStart = addDays(calendarDayOf(lease.leaseStart), -1);
    if (lease.rentDueDay == null) {
      await db.lease.update({
        where: { id: lease.id },
        data: { rentDueDay: dueDay },
      });
    }
    await db.billSchedule.create({
      data: {
        ownerId: lease.property.ownerId,
        householdId: lease.property.householdId,
        category: "RENT",
        propertyId: lease.propertyId,
        leaseId: lease.id,
        recurrence: "MONTHLY",
        startDate: dateOnly(firstDueDayAfter(dayBeforeStart, dueDay)),
        dueDay,
        endDate: lease.leaseEnd,
        defaultAmount: lease.rentAmount,
        active: true,
      },
    });
  }
  return `${leases.length} active leases, ${created} rent schedules created`;
}

async function main() {
  if (DRY_RUN) console.log("Dry run: nothing will be written.\n");
  await step("2026-11-bill-generation-keys", billGenerationKeys);
  for (const [collection, fields] of Object.entries(MONEY_FIELDS)) {
    for (const field of fields) {
      await step(`2026-11-money-minor-units:${collection}.${field}`, () =>
        moneyToMinorUnits(collection, field),
      );
    }
  }
  await step("2026-11-households", households);
  await step("2026-11-rent-schedules", rentSchedules);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
