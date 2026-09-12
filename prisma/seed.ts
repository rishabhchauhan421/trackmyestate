/**
 * Seed script for the Personal Asset & Reminder Hub domain models.
 * Populates two sample Indian portfolios (properties, policies, investments,
 * loans, and the resulting bills) so the timeline, dashboard, and reminder
 * engine have realistic data to render against.
 *
 * Run with: pnpm db:seed
 */
import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

function monthsAgo(months: number, day = 1): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function yearsAgo(years: number, month = 0, day = 1): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years, month, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function resetDomainData() {
  // Children first, to respect foreign keys on Mongo (Prisma won't cascade
  // automatically at the DB level for every relation here).
  await db.document.deleteMany();
  await db.bill.deleteMany();
  await db.loan.deleteMany();
  await db.investment.deleteMany();
  await db.policy.deleteMany();
  await db.billSchedule.deleteMany();
  await db.lease.deleteMany();
  await db.room.deleteMany();
  await db.property.deleteMany();
}

async function seedUsers() {
  const ananya = await db.user.upsert({
    where: { email: "ananya.rao@example.in" },
    update: {},
    create: {
      name: "Ananya Rao",
      email: "ananya.rao@example.in",
      emailVerified: true,
    },
  });

  const vikram = await db.user.upsert({
    where: { email: "vikram.mehta@example.in" },
    update: {},
    create: {
      name: "Vikram Mehta",
      email: "vikram.mehta@example.in",
      emailVerified: true,
    },
  });

  const rishabh = await db.user.upsert({
    where: { email: "rshbhchauhan@gmail.com" },
    update: {},
    create: {
      id: "6aa422637fd48fb4fba039ad",
      name: "Rishabh Chauhan",
      email: "rshbhchauhan@gmail.com",
      emailVerified: true,
    },
  });

  return { ananya, vikram, rishabh };
}

async function seedAnanyaPortfolio(ownerId: string) {
  // --- Properties -----------------------------------------------------
  const selfOccupied = await db.property.create({
    data: {
      ownerId,
      name: "Indiranagar 2BHK",
      type: "SELF_OCCUPIED",
      addressLine1: "12th Main Road, HAL 2nd Stage",
      addressLine2: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pinCode: "560038",
      purchasePrice: 9_500_000,
      currentEstimatedValue: 13_200_000,
      purchaseDate: yearsAgo(6, 3, 15),
      photos: [],
    },
  });

  const rented = await db.property.create({
    data: {
      ownerId,
      name: "Whitefield Rented Flat",
      type: "RENTED",
      addressLine1: "Prestige Shantiniketan, Whitefield",
      city: "Bengaluru",
      state: "Karnataka",
      pinCode: "560048",
      purchasePrice: 6_800_000,
      currentEstimatedValue: 8_900_000,
      purchaseDate: yearsAgo(4, 7, 1),
      photos: [],
    },
  });

  const room = await db.room.create({
    data: {
      propertyId: rented.id,
      label: "Whole flat",
      floor: "7",
      areaSqft: 1180,
    },
  });

  // A past lease that ended just before Karthik's began.
  await db.lease.create({
    data: {
      propertyId: rented.id,
      roomId: room.id,
      tenantName: "Divya Nair",
      tenantPhone: "+91 90080 33412",
      tenantEmail: "divya.nair@example.in",
      leaseStart: yearsAgo(2, 4, 1),
      leaseEnd: monthsAgo(8, 1),
      rentAmount: 28_500,
      depositAmount: 85_500,
      active: false,
    },
  });

  const lease = await db.lease.create({
    data: {
      propertyId: rented.id,
      roomId: room.id,
      tenantName: "Karthik Subramaniam",
      tenantPhone: "+91 98450 12233",
      tenantEmail: "karthik.s@example.in",
      leaseStart: monthsAgo(8, 1),
      rentAmount: 32_000,
      depositAmount: 96_000,
      active: true,
    },
  });

  // Rent history: a few paid months, current month due, and one overdue.
  // Rent is a `Bill` (category RENT, an inflow) linked to the Lease it was
  // collected from.
  const rentBills = await Promise.all(
    [-2, -1, 0].map((offset) =>
      db.bill.create({
        data: {
          ownerId,
          category: "RENT",
          direction: "INFLOW",
          leaseId: lease.id,
          propertyId: rented.id,
          dueDate: monthsAgo(-offset, 5),
          amount: 32_000,
          status: offset < 0 ? "PAID" : "DUE",
          paidDate: offset < 0 ? monthsAgo(-offset, 6) : null,
          paidAmount: offset < 0 ? 32_000 : null,
          description: "Rent - Whitefield Rented Flat (Karthik Subramaniam)",
        },
      }),
    ),
  );

  // --- Utilities (recurring schedules) + their current bill instance ---
  const maintenanceUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: rented.id,
      billType: "MAINTENANCE",
      provider: "Prestige Shantiniketan Owners' Association",
      recurrence: "MONTHLY",
      defaultAmount: 3_500,
      dueDay: daysFromNow(5).getDate(),
      reminderLeadDays: 5,
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: maintenanceUtility.id,
      propertyId: rented.id,
      dueDate: daysFromNow(5),
      amount: 3_500,
      status: "DUE",
      description: "Maintenance - Whitefield Rented Flat",
    },
  });

  const propertyTaxUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: selfOccupied.id,
      billType: "PROPERTY_TAX",
      provider: "BBMP",
      recurrence: "YEARLY",
      defaultAmount: 18_400,
      dueDay: daysFromNow(40).getDate(),
      dueMonth: daysFromNow(40).getMonth() + 1,
      reminderLeadDays: 14,
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: propertyTaxUtility.id,
      propertyId: selfOccupied.id,
      dueDate: daysFromNow(40),
      amount: 18_400,
      status: "DUE",
      description: "Property tax - Indiranagar 2BHK (BBMP)",
    },
  });

  const electricityUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: selfOccupied.id,
      billType: "ELECTRICITY",
      provider: "BESCOM",
      accountNumber: "BESCOM-448821",
      recurrence: "MONTHLY",
      defaultAmount: 4_120,
      dueDay: daysFromNow(-3).getDate(),
      reminderLeadDays: 5,
      recipients: [
        { name: "Radha Rao", email: "radha.rao@example.in", notifyOnDue: true },
      ],
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: electricityUtility.id,
      propertyId: selfOccupied.id,
      dueDate: daysFromNow(-3),
      amount: 4_120,
      status: "OVERDUE",
      description: "BESCOM electricity bill - Indiranagar 2BHK",
    },
  });

  // --- Loan (home loan on the self-occupied flat) ----------------------
  const homeLoan = await db.loan.create({
    data: {
      ownerId,
      lender: "State Bank of India",
      type: "HOME_LOAN",
      principal: 7_200_000,
      interestRatePercent: 8.6,
      startDate: yearsAgo(6, 3, 20),
      outstandingBalance: 4_850_000,
      linkedPropertyId: selfOccupied.id,
    },
  });
  await db.billSchedule.create({
    data: {
      ownerId,
      category: "EMI",
      loanId: homeLoan.id,
      recurrence: "MONTHLY",
      dueDay: 5,
      defaultAmount: 71_250,
      tenureMonths: 180,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "EMI",
      direction: "OUTFLOW",
      loanId: homeLoan.id,
      dueDate: daysFromNow(9),
      installmentNumber: 73,
      principalComponent: 36_400,
      interestComponent: 34_850,
      amount: 71_250,
      status: "DUE",
      description: "Home loan EMI - SBI",
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "EMI",
      direction: "OUTFLOW",
      loanId: homeLoan.id,
      dueDate: monthsAgo(1, 5),
      installmentNumber: 72,
      principalComponent: 36_140,
      interestComponent: 35_110,
      amount: 71_250,
      status: "PAID",
      paidDate: monthsAgo(1, 4),
      description: "Home loan EMI - SBI",
    },
  });

  // --- Policies ---------------------------------------------------------
  const lifePolicy = await db.policy.create({
    data: {
      ownerId,
      type: "ENDOWMENT",
      insurer: "LIC of India",
      policyNumber: "LIC-EN-887654321",
      holderName: "Ananya Rao",
      nominees: ["Radha Rao"],
      startDate: yearsAgo(10, 5, 1),
      tenureYears: 20,
      status: "ACTIVE",
      sumAssured: 1_500_000,
    },
  });

  const healthPolicy = await db.policy.create({
    data: {
      ownerId,
      type: "HEALTH",
      insurer: "HDFC Ergo General Insurance",
      policyNumber: "HDFCERGO-HLT-2291045",
      holderName: "Ananya Rao",
      nominees: ["Radha Rao"],
      startDate: monthsAgo(9, 12),
      tenureYears: 1,
      status: "ACTIVE",
      sumAssured: 1_000_000,
      roomRentLimit: 8_000,
      coPayPercent: 10,
      waitingPeriodMonths: 24,
      networkHospitals: [
        "Manipal Hospital, Old Airport Road",
        "Fortis Hospital, Bannerghatta Road",
      ],
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PREMIUM",
      direction: "OUTFLOW",
      policyId: lifePolicy.id,
      amount: 42_500,
      frequency: "YEARLY",
      dueDate: daysFromNow(22),
      gracePeriodDays: 30,
      status: "DUE",
      description: "LIC Jeevan Anand - annual premium",
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PREMIUM",
      direction: "OUTFLOW",
      policyId: healthPolicy.id,
      amount: 18_900,
      frequency: "YEARLY",
      dueDate: daysFromNow(75),
      gracePeriodDays: 15,
      status: "DUE",
      description: "HDFC Ergo mediclaim - annual premium",
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PAYOUT",
      direction: "INFLOW",
      policyId: lifePolicy.id,
      label: "Maturity benefit",
      dueDate: yearsAgo(-10, 5, 1), // 10 years from policy start (future)
      amount: 1_850_000,
      status: "DUE",
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "CLAIM_SETTLEMENT",
      direction: "INFLOW",
      policyId: healthPolicy.id,
      dueDate: monthsAgo(2, 10), // filed date
      amount: 45_000,
      status: "PAID",
      claimStatus: "SETTLED",
      paidDate: monthsAgo(1, 20),
      paidAmount: 40_500,
      description: "Hospitalisation - appendectomy, Manipal Hospital",
    },
  });

  // --- Investments --------------------------------------------------------
  const sipInvestment = await db.investment.create({
    data: {
      ownerId,
      name: "SBI Bluechip Fund - SIP",
      type: "MUTUAL_FUND",
      institution: "SBI Mutual Fund",
      investedDate: yearsAgo(3, 1, 5),
      capitalDeployed: 360_000,
      expectedReturnType: "Long-term capital appreciation",
      targetRoiPercent: 12,
      currentEstimatedValue: 468_000,
    },
  });

  await db.investment.create({
    data: {
      ownerId,
      name: "Public Provident Fund",
      type: "PPF",
      institution: "State Bank of India",
      investedDate: yearsAgo(5, 3, 1),
      capitalDeployed: 750_000,
      expectedReturnType: "Fixed interest, compounded annually",
      targetRoiPercent: 7.1,
      expectedReturnDate: yearsAgo(-10, 3, 1),
      currentEstimatedValue: 962_000,
    },
  });

  await db.investment.create({
    data: {
      ownerId,
      name: "Sovereign Gold Bonds - Tranche IV",
      type: "GOLD",
      institution: "RBI Retail Direct",
      investedDate: yearsAgo(2, 8, 20),
      capitalDeployed: 200_000,
      expectedReturnType: "Interest + gold price appreciation",
      targetRoiPercent: 2.5,
      currentEstimatedValue: 248_000,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "INVESTMENT_RETURN",
      direction: "INFLOW",
      investmentId: sipInvestment.id,
      dueDate: monthsAgo(1, 5),
      amount: 4_200,
      label: "Dividend reinvestment",
      status: "PAID",
      paidDate: monthsAgo(1, 5),
      paidAmount: 4_200,
      description: "SBI Bluechip Fund - dividend reinvestment",
    },
  });

  return { selfOccupied, rented, homeLoan, lifePolicy, healthPolicy };
}

async function seedVikramPortfolio(ownerId: string) {
  const selfOccupied = await db.property.create({
    data: {
      ownerId,
      name: "Powai 3BHK",
      type: "SELF_OCCUPIED",
      addressLine1: "Hiranandani Gardens, Powai",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400076",
      purchasePrice: 21_500_000,
      currentEstimatedValue: 27_800_000,
      purchaseDate: yearsAgo(5, 10, 12),
      photos: [],
    },
  });

  const investmentFlat = await db.property.create({
    data: {
      ownerId,
      name: "Andheri Investment Flat",
      type: "INVESTMENT",
      addressLine1: "Lokhandwala Complex, Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400053",
      purchasePrice: 12_000_000,
      currentEstimatedValue: 15_400_000,
      purchaseDate: yearsAgo(3, 2, 1),
      photos: [],
    },
  });

  const lease = await db.lease.create({
    data: {
      propertyId: investmentFlat.id,
      tenantName: "Priya Deshpande",
      tenantPhone: "+91 99870 44521",
      tenantEmail: "priya.d@example.in",
      leaseStart: monthsAgo(5, 1),
      rentAmount: 58_000,
      depositAmount: 174_000,
      active: true,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "RENT",
      direction: "INFLOW",
      leaseId: lease.id,
      propertyId: investmentFlat.id,
      dueDate: daysFromNow(6),
      amount: 58_000,
      status: "DUE",
      description: "Rent - Andheri Investment Flat (Priya Deshpande)",
    },
  });

  const societyMaintenanceUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: selfOccupied.id,
      billType: "MAINTENANCE",
      provider: "Hiranandani Gardens CHS",
      recurrence: "MONTHLY",
      defaultAmount: 9_800,
      dueDay: daysFromNow(12).getDate(),
      reminderLeadDays: 5,
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: societyMaintenanceUtility.id,
      propertyId: selfOccupied.id,
      dueDate: daysFromNow(12),
      amount: 9_800,
      status: "DUE",
      description: "Society maintenance - Powai 3BHK",
    },
  });

  const waterUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: investmentFlat.id,
      billType: "WATER",
      provider: "BMC Water Supply",
      recurrence: "MONTHLY",
      defaultAmount: 1_450,
      dueDay: daysFromNow(-1).getDate(),
      reminderLeadDays: 3,
      recipients: [
        {
          name: "Shalini Mehta",
          email: "shalini.mehta@example.in",
          notifyOnDue: true,
        },
      ],
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: waterUtility.id,
      propertyId: investmentFlat.id,
      dueDate: daysFromNow(-1),
      amount: 1_450,
      status: "OVERDUE",
      description: "Water bill - Andheri Investment Flat",
    },
  });

  const homeLoan = await db.loan.create({
    data: {
      ownerId,
      lender: "HDFC Bank",
      type: "HOME_LOAN",
      principal: 16_500_000,
      interestRatePercent: 8.75,
      startDate: yearsAgo(5, 10, 25),
      outstandingBalance: 12_900_000,
      linkedPropertyId: selfOccupied.id,
    },
  });
  await db.billSchedule.create({
    data: {
      ownerId,
      category: "EMI",
      loanId: homeLoan.id,
      recurrence: "MONTHLY",
      dueDay: 3,
      defaultAmount: 145_600,
      tenureMonths: 240,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "EMI",
      direction: "OUTFLOW",
      loanId: homeLoan.id,
      dueDate: daysFromNow(14),
      installmentNumber: 61,
      principalComponent: 51_200,
      interestComponent: 94_400,
      amount: 145_600,
      status: "DUE",
      description: "Home loan EMI - HDFC Bank",
    },
  });

  const carLoan = await db.loan.create({
    data: {
      ownerId,
      lender: "Axis Bank",
      type: "VEHICLE_LOAN",
      principal: 1_800_000,
      interestRatePercent: 9.2,
      startDate: yearsAgo(1, 6, 15),
      outstandingBalance: 1_260_000,
    },
  });
  await db.billSchedule.create({
    data: {
      ownerId,
      category: "EMI",
      loanId: carLoan.id,
      recurrence: "MONTHLY",
      dueDay: 8,
      defaultAmount: 37_500,
      tenureMonths: 60,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "EMI",
      direction: "OUTFLOW",
      loanId: carLoan.id,
      dueDate: daysFromNow(19),
      installmentNumber: 15,
      principalComponent: 26_800,
      interestComponent: 10_700,
      amount: 37_500,
      status: "DUE",
      description: "Car loan EMI - Axis Bank",
    },
  });

  const termPolicy = await db.policy.create({
    data: {
      ownerId,
      type: "TERM_LIFE",
      insurer: "ICICI Prudential Life Insurance",
      policyNumber: "ICICIPRU-TL-5540221",
      holderName: "Vikram Mehta",
      nominees: ["Shalini Mehta"],
      startDate: yearsAgo(4, 4, 1),
      tenureYears: 30,
      status: "ACTIVE",
      sumAssured: 20_000_000,
    },
  });

  const familyFloater = await db.policy.create({
    data: {
      ownerId,
      type: "HEALTH",
      insurer: "Star Health and Allied Insurance",
      policyNumber: "STARHLT-FF-771203",
      holderName: "Vikram Mehta",
      nominees: ["Shalini Mehta", "Aarav Mehta"],
      startDate: monthsAgo(4, 18),
      tenureYears: 1,
      status: "ACTIVE",
      sumAssured: 1_500_000,
      roomRentLimit: 10_000,
      coPayPercent: 0,
      waitingPeriodMonths: 24,
      networkHospitals: [
        "Kokilaben Dhirubhai Ambani Hospital, Andheri West",
        "Hiranandani Hospital, Powai",
      ],
    },
  });

  const vehiclePolicy = await db.policy.create({
    data: {
      ownerId,
      type: "VEHICLE",
      insurer: "Bajaj Allianz General Insurance",
      policyNumber: "BAJAJ-MV-990417",
      holderName: "Vikram Mehta",
      nominees: [],
      startDate: monthsAgo(2, 15),
      tenureYears: 1,
      status: "ACTIVE",
      sumAssured: 1_400_000,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PREMIUM",
      direction: "OUTFLOW",
      policyId: termPolicy.id,
      amount: 68_000,
      frequency: "YEARLY",
      dueDate: daysFromNow(48),
      gracePeriodDays: 30,
      status: "DUE",
      description: "ICICI Prudential term plan - annual premium",
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PREMIUM",
      direction: "OUTFLOW",
      policyId: familyFloater.id,
      amount: 31_200,
      frequency: "YEARLY",
      dueDate: daysFromNow(-8),
      gracePeriodDays: 15,
      status: "OVERDUE",
      description: "Star Health family floater - annual premium",
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PREMIUM",
      direction: "OUTFLOW",
      policyId: vehiclePolicy.id,
      amount: 14_500,
      frequency: "YEARLY",
      dueDate: daysFromNow(320),
      gracePeriodDays: 0,
      status: "PAID",
      paidDate: monthsAgo(2, 15),
    },
  });

  const investments = await Promise.all([
    db.investment.create({
      data: {
        ownerId,
        name: "Axis Small Cap Fund - SIP",
        type: "MUTUAL_FUND",
        institution: "Axis Mutual Fund",
        investedDate: yearsAgo(4, 6, 1),
        capitalDeployed: 720_000,
        expectedReturnType: "Long-term capital appreciation",
        targetRoiPercent: 14,
        currentEstimatedValue: 1_046_000,
      },
    }),
    db.investment.create({
      data: {
        ownerId,
        name: "Fixed Deposit - 3 year",
        type: "FIXED_DEPOSIT",
        institution: "ICICI Bank",
        investedDate: yearsAgo(1, 9, 10),
        capitalDeployed: 1_000_000,
        expectedReturnType: "Fixed interest at maturity",
        targetRoiPercent: 7.25,
        expectedReturnDate: yearsAgo(-2, 9, 10),
        currentEstimatedValue: 1_075_000,
      },
    }),
    db.investment.create({
      data: {
        ownerId,
        name: "Digital Gold",
        type: "GOLD",
        institution: "MMTC-PAMP",
        investedDate: yearsAgo(1, 1, 20),
        capitalDeployed: 150_000,
        expectedReturnType: "Gold price appreciation",
        currentEstimatedValue: 178_000,
      },
    }),
    db.investment.create({
      data: {
        ownerId,
        name: "National Pension System - Tier I",
        type: "NPS",
        institution: "HDFC Pension Fund",
        investedDate: yearsAgo(6, 4, 1),
        capitalDeployed: 900_000,
        expectedReturnType: "Market-linked, annuity on retirement",
        targetRoiPercent: 9,
        currentEstimatedValue: 1_340_000,
      },
    }),
  ]);
  const [axisSip, fd] = investments;

  await db.bill.create({
    data: {
      ownerId,
      category: "INVESTMENT_RETURN",
      direction: "INFLOW",
      investmentId: fd!.id,
      dueDate: daysFromNow(400),
      amount: 75_000,
      label: "Maturity payout (expected)",
      status: "DUE",
      description: "ICICI Bank FD - maturity payout expected",
    },
  });

  const claim = await db.bill.create({
    data: {
      ownerId,
      category: "CLAIM_SETTLEMENT",
      direction: "INFLOW",
      policyId: vehiclePolicy.id,
      dueDate: monthsAgo(1, 5), // filed date
      amount: 22_000,
      status: "DUE", // APPROVED, not yet settled
      claimStatus: "APPROVED",
      description: "Windshield + bumper repair after minor collision",
    },
  });

  return {
    selfOccupied,
    investmentFlat,
    homeLoan,
    carLoan,
    termPolicy,
    familyFloater,
    vehiclePolicy,
    axisSip,
    claim,
  };
}

async function seedRishabhPortfolio(ownerId: string) {
  // --- Properties -----------------------------------------------------
  const selfOccupied = await db.property.create({
    data: {
      ownerId,
      name: "DLF Phase 3 Apartment",
      type: "SELF_OCCUPIED",
      addressLine1: "Tower 9, DLF Phase 3",
      city: "Gurugram",
      state: "Haryana",
      pinCode: "122002",
      purchasePrice: 11_800_000,
      currentEstimatedValue: 16_500_000,
      purchaseDate: yearsAgo(5, 1, 10),
      photos: [],
    },
  });

  const rented = await db.property.create({
    data: {
      ownerId,
      name: "Sector 50 Rented Flat",
      type: "RENTED",
      addressLine1: "Vipul World, Sector 48",
      city: "Gurugram",
      state: "Haryana",
      pinCode: "122018",
      purchasePrice: 7_200_000,
      currentEstimatedValue: 9_600_000,
      purchaseDate: yearsAgo(3, 6, 5),
      photos: [],
    },
  });

  const lease = await db.lease.create({
    data: {
      propertyId: rented.id,
      tenantName: "Neha Kapoor",
      tenantPhone: "+91 98110 55621",
      tenantEmail: "neha.kapoor@example.in",
      leaseStart: monthsAgo(6, 1),
      rentAmount: 38_000,
      depositAmount: 114_000,
      active: true,
    },
  });

  await Promise.all(
    [-2, -1, 0].map((offset) =>
      db.bill.create({
        data: {
          ownerId,
          category: "RENT",
          direction: "INFLOW",
          leaseId: lease.id,
          propertyId: rented.id,
          dueDate: monthsAgo(-offset, 3),
          amount: 38_000,
          status: offset < 0 ? "PAID" : "DUE",
          paidDate: offset < 0 ? monthsAgo(-offset, 2) : null,
          paidAmount: offset < 0 ? 38_000 : null,
          description: "Rent - Sector 50 Rented Flat (Neha Kapoor)",
        },
      }),
    ),
  );

  const maintenanceUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: rented.id,
      billType: "MAINTENANCE",
      provider: "Vipul World RWA",
      recurrence: "MONTHLY",
      defaultAmount: 4_200,
      dueDay: daysFromNow(8).getDate(),
      reminderLeadDays: 5,
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: maintenanceUtility.id,
      propertyId: rented.id,
      dueDate: daysFromNow(8),
      amount: 4_200,
      status: "DUE",
      description: "Maintenance - Sector 50 Rented Flat",
    },
  });

  const propertyTaxUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: selfOccupied.id,
      billType: "PROPERTY_TAX",
      provider: "Municipal Corporation of Gurugram",
      recurrence: "YEARLY",
      defaultAmount: 21_600,
      dueDay: daysFromNow(-6).getDate(),
      dueMonth: daysFromNow(-6).getMonth() + 1,
      reminderLeadDays: 14,
      recipients: [
        {
          name: "Priya Chauhan",
          email: "priya.chauhan@example.in",
          notifyOnDue: true,
        },
      ],
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: propertyTaxUtility.id,
      propertyId: selfOccupied.id,
      dueDate: daysFromNow(-6),
      amount: 21_600,
      status: "OVERDUE",
      description: "Property tax - DLF Phase 3 Apartment (MCG)",
    },
  });

  // A few more utilities whose current bill instance covers every
  // `PaymentStatus` a utility bill can be in, alongside the DUE
  // (maintenanceBill) and OVERDUE (propertyTaxBill) ones above.
  const gasUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: rented.id,
      billType: "GAS",
      provider: "Indane Gas Agency",
      recurrence: "MONTHLY",
      defaultAmount: 900,
      dueDay: monthsAgo(1, 12).getDate(),
      reminderLeadDays: 3,
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: gasUtility.id,
      propertyId: rented.id,
      dueDate: monthsAgo(1, 12),
      amount: 900,
      status: "PAID",
      paidDate: monthsAgo(1, 10),
      paidAmount: 900,
      description: "Gas bill - Sector 50 Rented Flat (Indane)",
    },
  });

  const internetUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: rented.id,
      billType: "INTERNET",
      provider: "Airtel Xstream Fiber",
      recurrence: "MONTHLY",
      defaultAmount: 1_200,
      dueDay: daysFromNow(-4).getDate(),
      reminderLeadDays: 3,
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: internetUtility.id,
      propertyId: rented.id,
      dueDate: daysFromNow(-4),
      amount: 1_200,
      status: "PARTIALLY_PAID",
      paidDate: daysFromNow(-2),
      paidAmount: 700,
      description: "Internet bill - Sector 50 Rented Flat (Airtel)",
    },
  });

  const waterUtility = await db.billSchedule.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      propertyId: selfOccupied.id,
      billType: "WATER",
      provider: "Gurugram Jal Board",
      recurrence: "MONTHLY",
      defaultAmount: 650,
      dueDay: monthsAgo(2, 15).getDate(),
      reminderLeadDays: 3,
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: waterUtility.id,
      propertyId: selfOccupied.id,
      dueDate: monthsAgo(2, 15),
      amount: 650,
      status: "CANCELLED",
      notes: "Connection transferred to RWA-managed billing; charge voided.",
      description: "Water bill - DLF Phase 3 Apartment (voided)",
    },
  });

  // A second, historical bill instance on the existing maintenance utility
  // — a duplicate charge that was later refunded.
  await db.bill.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: maintenanceUtility.id,
      propertyId: rented.id,
      dueDate: monthsAgo(3, 8),
      amount: 4_200,
      status: "REFUNDED",
      paidDate: monthsAgo(3, 6),
      paidAmount: 4_200,
      notes: "Duplicate charge, refunded by the RWA the following month.",
      description:
        "Maintenance - Sector 50 Rented Flat (duplicate charge, refunded)",
    },
  });

  // --- Loan (home loan on the self-occupied flat) ----------------------
  const homeLoan = await db.loan.create({
    data: {
      ownerId,
      lender: "ICICI Bank",
      type: "HOME_LOAN",
      principal: 9_000_000,
      interestRatePercent: 8.4,
      startDate: yearsAgo(5, 1, 15),
      outstandingBalance: 6_950_000,
      linkedPropertyId: selfOccupied.id,
    },
  });
  await db.billSchedule.create({
    data: {
      ownerId,
      category: "EMI",
      loanId: homeLoan.id,
      recurrence: "MONTHLY",
      dueDay: 7,
      defaultAmount: 88_400,
      tenureMonths: 180,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "EMI",
      direction: "OUTFLOW",
      loanId: homeLoan.id,
      dueDate: daysFromNow(11),
      installmentNumber: 58,
      principalComponent: 43_900,
      interestComponent: 44_500,
      amount: 88_400,
      status: "DUE",
      description: "Home loan EMI - ICICI Bank",
    },
  });
  await db.bill.create({
    data: {
      ownerId,
      category: "EMI",
      direction: "OUTFLOW",
      loanId: homeLoan.id,
      dueDate: monthsAgo(1, 7),
      installmentNumber: 57,
      principalComponent: 43_600,
      interestComponent: 44_800,
      amount: 88_400,
      status: "PAID",
      paidDate: monthsAgo(1, 6),
      description: "Home loan EMI - ICICI Bank",
    },
  });

  // --- Policies ---------------------------------------------------------
  const termPolicy = await db.policy.create({
    data: {
      ownerId,
      type: "TERM_LIFE",
      insurer: "Max Life Insurance",
      policyNumber: "MAXLIFE-TL-3312087",
      holderName: "Rishabh Chauhan",
      nominees: ["Priya Chauhan"],
      startDate: yearsAgo(3, 2, 1),
      tenureYears: 30,
      status: "ACTIVE",
      sumAssured: 15_000_000,
    },
  });

  const healthPolicy = await db.policy.create({
    data: {
      ownerId,
      type: "HEALTH",
      insurer: "Niva Bupa Health Insurance",
      policyNumber: "NIVABUPA-HLT-4487021",
      holderName: "Rishabh Chauhan",
      nominees: ["Priya Chauhan"],
      startDate: monthsAgo(5, 20),
      tenureYears: 1,
      status: "ACTIVE",
      sumAssured: 1_200_000,
      roomRentLimit: 10_000,
      coPayPercent: 0,
      waitingPeriodMonths: 24,
      networkHospitals: [
        "Medanta - The Medicity, Gurugram",
        "Fortis Memorial Research Institute, Gurugram",
      ],
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PREMIUM",
      direction: "OUTFLOW",
      policyId: termPolicy.id,
      amount: 24_800,
      frequency: "YEARLY",
      dueDate: daysFromNow(60),
      gracePeriodDays: 30,
      status: "DUE",
      description: "Max Life term plan - annual premium",
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "PREMIUM",
      direction: "OUTFLOW",
      policyId: healthPolicy.id,
      amount: 16_500,
      frequency: "YEARLY",
      dueDate: daysFromNow(18),
      gracePeriodDays: 15,
      status: "DUE",
      description: "Niva Bupa health cover - annual premium",
    },
  });

  // --- Investments --------------------------------------------------------
  const sipInvestment = await db.investment.create({
    data: {
      ownerId,
      name: "Parag Parikh Flexi Cap Fund - SIP",
      type: "MUTUAL_FUND",
      institution: "PPFAS Mutual Fund",
      investedDate: yearsAgo(4, 4, 1),
      capitalDeployed: 480_000,
      expectedReturnType: "Long-term capital appreciation",
      targetRoiPercent: 13,
      currentEstimatedValue: 712_000,
    },
  });

  const nps = await db.investment.create({
    data: {
      ownerId,
      name: "National Pension System - Tier I",
      type: "NPS",
      institution: "SBI Pension Fund",
      investedDate: yearsAgo(3, 4, 1),
      capitalDeployed: 420_000,
      expectedReturnType: "Market-linked, annuity on retirement",
      targetRoiPercent: 9.5,
      currentEstimatedValue: 546_000,
    },
  });

  const gold = await db.investment.create({
    data: {
      ownerId,
      name: "Sovereign Gold Bonds - Tranche VII",
      type: "GOLD",
      institution: "RBI Retail Direct",
      investedDate: yearsAgo(1, 9, 15),
      capitalDeployed: 150_000,
      expectedReturnType: "Interest + gold price appreciation",
      targetRoiPercent: 2.5,
      currentEstimatedValue: 178_000,
    },
  });

  await db.bill.create({
    data: {
      ownerId,
      category: "INVESTMENT_RETURN",
      direction: "INFLOW",
      investmentId: sipInvestment.id,
      dueDate: monthsAgo(1, 3),
      amount: 3_600,
      label: "Dividend reinvestment",
      status: "PAID",
      paidDate: monthsAgo(1, 3),
      paidAmount: 3_600,
      description: "Parag Parikh Flexi Cap Fund - dividend reinvestment",
    },
  });

  return {
    selfOccupied,
    rented,
    homeLoan,
    termPolicy,
    healthPolicy,
    sipInvestment,
    nps,
    gold,
  };
}

async function main() {
  console.log("Resetting existing domain data...");
  await resetDomainData();

  console.log("Seeding users...");
  const { ananya, vikram, rishabh } = await seedUsers();

  console.log("Seeding Ananya Rao's portfolio (Bengaluru)...");
  await seedAnanyaPortfolio(ananya.id);

  console.log("Seeding Vikram Mehta's portfolio (Mumbai)...");
  await seedVikramPortfolio(vikram.id);

  console.log("Seeding Rishabh Chauhan's portfolio (Gurugram)...");
  await seedRishabhPortfolio(rishabh.id);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
