/**
 * Seed script for the Personal Asset & Reminder Hub domain models.
 * Populates two sample Indian portfolios (properties, policies, investments,
 * loans, the resulting financial events, and reminders) so the timeline,
 * dashboard, and reminder engine have realistic data to render against.
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
  await db.reminder.deleteMany();
  await db.financialEvent.deleteMany();
  await db.eMIPayment.deleteMany();
  await db.loan.deleteMany();
  await db.return.deleteMany();
  await db.investment.deleteMany();
  await db.claim.deleteMany();
  await db.payout.deleteMany();
  await db.premiumPayment.deleteMany();
  await db.policy.deleteMany();
  await db.bill.deleteMany();
  await db.rentPayment.deleteMany();
  await db.tenant.deleteMany();
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
      occupancyStatus: "OCCUPIED",
    },
  });

  const tenant = await db.tenant.create({
    data: {
      propertyId: rented.id,
      roomId: room.id,
      name: "Karthik Subramaniam",
      phone: "+91 98450 12233",
      email: "karthik.s@example.in",
      leaseStart: monthsAgo(8, 1),
      rentAmount: 32_000,
      depositAmount: 96_000,
      active: true,
    },
  });

  // Rent history: a few paid months, current month due, and one overdue.
  const rentPayments = await Promise.all(
    [-2, -1, 0].map((offset) =>
      db.rentPayment.create({
        data: {
          propertyId: rented.id,
          tenantId: tenant.id,
          dueDate: monthsAgo(-offset, 5),
          amount: 32_000,
          status: offset < 0 ? "PAID" : "DUE",
          paidDate: offset < 0 ? monthsAgo(-offset, 6) : null,
          paidAmount: offset < 0 ? 32_000 : null,
        },
      }),
    ),
  );
  const currentRent = rentPayments[rentPayments.length - 1]!;

  const maintenanceBill = await db.bill.create({
    data: {
      propertyId: rented.id,
      type: "MAINTENANCE",
      dueDate: daysFromNow(5),
      amount: 3_500,
      status: "DUE",
    },
  });

  const propertyTaxBill = await db.bill.create({
    data: {
      propertyId: selfOccupied.id,
      type: "PROPERTY_TAX",
      dueDate: daysFromNow(40),
      amount: 18_400,
      status: "DUE",
    },
  });

  const electricityBill = await db.bill.create({
    data: {
      propertyId: selfOccupied.id,
      type: "ELECTRICITY",
      dueDate: daysFromNow(-3),
      amount: 4_120,
      status: "OVERDUE",
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
      tenureMonths: 180,
      emiAmount: 71_250,
      emiDueDay: 5,
      startDate: yearsAgo(6, 3, 20),
      outstandingBalance: 4_850_000,
      linkedAssetType: "PROPERTY",
      linkedAssetId: selfOccupied.id,
    },
  });

  const upcomingEmi = await db.eMIPayment.create({
    data: {
      loanId: homeLoan.id,
      installmentNumber: 73,
      dueDate: daysFromNow(9),
      principalComponent: 36_400,
      interestComponent: 34_850,
      amount: 71_250,
      status: "DUE",
    },
  });
  await db.eMIPayment.create({
    data: {
      loanId: homeLoan.id,
      installmentNumber: 72,
      dueDate: monthsAgo(1, 5),
      principalComponent: 36_140,
      interestComponent: 35_110,
      amount: 71_250,
      status: "PAID",
      paidDate: monthsAgo(1, 4),
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

  const lifePremium = await db.premiumPayment.create({
    data: {
      policyId: lifePolicy.id,
      amount: 42_500,
      frequency: "YEARLY",
      dueDate: daysFromNow(22),
      gracePeriodDays: 30,
      status: "DUE",
    },
  });

  const healthPremium = await db.premiumPayment.create({
    data: {
      policyId: healthPolicy.id,
      amount: 18_900,
      frequency: "YEARLY",
      dueDate: daysFromNow(75),
      gracePeriodDays: 15,
      status: "DUE",
    },
  });

  const maturityPayout = await db.payout.create({
    data: {
      policyId: lifePolicy.id,
      label: "Maturity benefit",
      expectedDate: yearsAgo(-10, 5, 1), // 10 years from policy start (future)
      amount: 1_850_000,
      status: "DUE",
    },
  });

  const claim = await db.claim.create({
    data: {
      policyId: healthPolicy.id,
      filedDate: monthsAgo(2, 10),
      amount: 45_000,
      status: "SETTLED",
      settledAmount: 40_500,
      settledDate: monthsAgo(1, 20),
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

  const ppf = await db.investment.create({
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

  const gold = await db.investment.create({
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

  const sipReturn = await db.return.create({
    data: {
      investmentId: sipInvestment.id,
      date: monthsAgo(1, 5),
      amount: 4_200,
      label: "Dividend reinvestment",
    },
  });

  // --- Financial events (unifying inflow/outflow spine) -----------------
  await db.financialEvent.createMany({
    data: [
      {
        ownerId,
        type: "INFLOW",
        source: "RENT",
        sourceId: currentRent.id,
        amount: currentRent.amount,
        dueDate: currentRent.dueDate,
        status: "DUE",
        description: "Rent - Whitefield Rented Flat (Karthik Subramaniam)",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "BILL",
        sourceId: maintenanceBill.id,
        amount: maintenanceBill.amount,
        dueDate: maintenanceBill.dueDate,
        status: "DUE",
        description: "Maintenance - Whitefield Rented Flat",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "BILL",
        sourceId: propertyTaxBill.id,
        amount: propertyTaxBill.amount,
        dueDate: propertyTaxBill.dueDate,
        status: "DUE",
        description: "Property tax - Indiranagar 2BHK (BBMP)",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "BILL",
        sourceId: electricityBill.id,
        amount: electricityBill.amount,
        dueDate: electricityBill.dueDate,
        status: "OVERDUE",
        description: "BESCOM electricity bill - Indiranagar 2BHK",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "EMI",
        sourceId: upcomingEmi.id,
        amount: upcomingEmi.amount,
        dueDate: upcomingEmi.dueDate,
        status: "DUE",
        description: "Home loan EMI - SBI",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "PREMIUM",
        sourceId: lifePremium.id,
        amount: lifePremium.amount,
        dueDate: lifePremium.dueDate,
        status: "DUE",
        description: "LIC Jeevan Anand - annual premium",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "PREMIUM",
        sourceId: healthPremium.id,
        amount: healthPremium.amount,
        dueDate: healthPremium.dueDate,
        status: "DUE",
        description: "HDFC Ergo mediclaim - annual premium",
      },
      {
        ownerId,
        type: "INFLOW",
        source: "CLAIM_SETTLEMENT",
        sourceId: claim.id,
        amount: claim.settledAmount!,
        dueDate: claim.settledDate!,
        status: "PAID",
        description: "HDFC Ergo mediclaim - claim settled",
      },
      {
        ownerId,
        type: "INFLOW",
        source: "RETURN",
        sourceId: sipReturn.id,
        amount: sipReturn.amount,
        dueDate: sipReturn.date,
        status: "PAID",
        description: "SBI Bluechip Fund - dividend reinvestment",
      },
    ],
  });

  // --- Reminders (a subset of the events above, with escalation) --------
  const rentEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "RENT", sourceId: currentRent.id },
  });
  const emiEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "EMI", sourceId: upcomingEmi.id },
  });
  const lifePremiumEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "PREMIUM", sourceId: lifePremium.id },
  });

  await db.reminder.createMany({
    data: [
      {
        ownerId,
        financialEventId: rentEvent.id,
        title: "Collect rent - Whitefield Rented Flat",
        dueDate: rentEvent.dueDate,
        leadTimeDays: 3,
        escalationDays: [3, 1, 0],
        channels: ["PUSH", "WHATSAPP"],
        status: "PENDING",
      },
      {
        ownerId,
        financialEventId: emiEvent.id,
        title: "SBI home loan EMI due",
        dueDate: emiEvent.dueDate,
        leadTimeDays: 5,
        escalationDays: [5, 2, 0],
        channels: ["PUSH", "EMAIL"],
        status: "PENDING",
      },
      {
        ownerId,
        financialEventId: lifePremiumEvent.id,
        title: "LIC Jeevan Anand premium due",
        dueDate: lifePremiumEvent.dueDate,
        leadTimeDays: 30,
        escalationDays: [30, 7, 1],
        channels: ["EMAIL", "PUSH", "WHATSAPP"],
        status: "PENDING",
      },
    ],
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

  const tenant = await db.tenant.create({
    data: {
      propertyId: investmentFlat.id,
      name: "Priya Deshpande",
      phone: "+91 99870 44521",
      email: "priya.d@example.in",
      leaseStart: monthsAgo(5, 1),
      rentAmount: 58_000,
      depositAmount: 174_000,
      active: true,
    },
  });

  const currentRent = await db.rentPayment.create({
    data: {
      propertyId: investmentFlat.id,
      tenantId: tenant.id,
      dueDate: daysFromNow(6),
      amount: 58_000,
      status: "DUE",
    },
  });

  const societyMaintenance = await db.bill.create({
    data: {
      propertyId: selfOccupied.id,
      type: "MAINTENANCE",
      dueDate: daysFromNow(12),
      amount: 9_800,
      status: "DUE",
    },
  });

  const waterBill = await db.bill.create({
    data: {
      propertyId: investmentFlat.id,
      type: "WATER",
      dueDate: daysFromNow(-1),
      amount: 1_450,
      status: "OVERDUE",
    },
  });

  const homeLoan = await db.loan.create({
    data: {
      ownerId,
      lender: "HDFC Bank",
      type: "HOME_LOAN",
      principal: 16_500_000,
      interestRatePercent: 8.75,
      tenureMonths: 240,
      emiAmount: 145_600,
      emiDueDay: 3,
      startDate: yearsAgo(5, 10, 25),
      outstandingBalance: 12_900_000,
      linkedAssetType: "PROPERTY",
      linkedAssetId: selfOccupied.id,
    },
  });

  const upcomingEmi = await db.eMIPayment.create({
    data: {
      loanId: homeLoan.id,
      installmentNumber: 61,
      dueDate: daysFromNow(14),
      principalComponent: 51_200,
      interestComponent: 94_400,
      amount: 145_600,
      status: "DUE",
    },
  });

  const carLoan = await db.loan.create({
    data: {
      ownerId,
      lender: "Axis Bank",
      type: "VEHICLE_LOAN",
      principal: 1_800_000,
      interestRatePercent: 9.2,
      tenureMonths: 60,
      emiAmount: 37_500,
      emiDueDay: 8,
      startDate: yearsAgo(1, 6, 15),
      outstandingBalance: 1_260_000,
      linkedAssetType: "NONE",
    },
  });

  const carEmi = await db.eMIPayment.create({
    data: {
      loanId: carLoan.id,
      installmentNumber: 15,
      dueDate: daysFromNow(19),
      principalComponent: 26_800,
      interestComponent: 10_700,
      amount: 37_500,
      status: "DUE",
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

  const termPremium = await db.premiumPayment.create({
    data: {
      policyId: termPolicy.id,
      amount: 68_000,
      frequency: "YEARLY",
      dueDate: daysFromNow(48),
      gracePeriodDays: 30,
      status: "DUE",
    },
  });

  const healthPremium = await db.premiumPayment.create({
    data: {
      policyId: familyFloater.id,
      amount: 31_200,
      frequency: "YEARLY",
      dueDate: daysFromNow(-8),
      gracePeriodDays: 15,
      status: "OVERDUE",
    },
  });

  const vehiclePremium = await db.premiumPayment.create({
    data: {
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

  const fdReturn = await db.return.create({
    data: {
      investmentId: fd!.id,
      date: daysFromNow(400),
      amount: 75_000,
      label: "Maturity payout (expected)",
    },
  });

  const claim = await db.claim.create({
    data: {
      policyId: vehiclePolicy.id,
      filedDate: monthsAgo(1, 5),
      amount: 22_000,
      status: "APPROVED",
      description: "Windshield + bumper repair after minor collision",
    },
  });

  await db.financialEvent.createMany({
    data: [
      {
        ownerId,
        type: "INFLOW",
        source: "RENT",
        sourceId: currentRent.id,
        amount: currentRent.amount,
        dueDate: currentRent.dueDate,
        status: "DUE",
        description: "Rent - Andheri Investment Flat (Priya Deshpande)",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "BILL",
        sourceId: societyMaintenance.id,
        amount: societyMaintenance.amount,
        dueDate: societyMaintenance.dueDate,
        status: "DUE",
        description: "Society maintenance - Powai 3BHK",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "BILL",
        sourceId: waterBill.id,
        amount: waterBill.amount,
        dueDate: waterBill.dueDate,
        status: "OVERDUE",
        description: "Water bill - Andheri Investment Flat",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "EMI",
        sourceId: upcomingEmi.id,
        amount: upcomingEmi.amount,
        dueDate: upcomingEmi.dueDate,
        status: "DUE",
        description: "Home loan EMI - HDFC Bank",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "EMI",
        sourceId: carEmi.id,
        amount: carEmi.amount,
        dueDate: carEmi.dueDate,
        status: "DUE",
        description: "Car loan EMI - Axis Bank",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "PREMIUM",
        sourceId: termPremium.id,
        amount: termPremium.amount,
        dueDate: termPremium.dueDate,
        status: "DUE",
        description: "ICICI Prudential term plan - annual premium",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "PREMIUM",
        sourceId: healthPremium.id,
        amount: healthPremium.amount,
        dueDate: healthPremium.dueDate,
        status: "OVERDUE",
        description: "Star Health family floater - annual premium",
      },
      {
        ownerId,
        type: "INFLOW",
        source: "RETURN",
        sourceId: fdReturn.id,
        amount: fdReturn.amount,
        dueDate: fdReturn.date,
        status: "DUE",
        description: "ICICI Bank FD - maturity payout expected",
      },
    ],
  });

  const emiEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "EMI", sourceId: upcomingEmi.id },
  });
  const healthPremiumEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "PREMIUM", sourceId: healthPremium.id },
  });
  const carEmiEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "EMI", sourceId: carEmi.id },
  });

  await db.reminder.createMany({
    data: [
      {
        ownerId,
        financialEventId: healthPremiumEvent.id,
        title: "Star Health premium overdue - renew to avoid lapse",
        dueDate: healthPremiumEvent.dueDate,
        leadTimeDays: 15,
        escalationDays: [15, 7, 1, 0],
        channels: ["EMAIL", "PUSH", "WHATSAPP", "SMS"],
        status: "SENT",
        lastSentAt: daysFromNow(-1),
      },
      {
        ownerId,
        financialEventId: emiEvent.id,
        title: "HDFC home loan EMI due",
        dueDate: emiEvent.dueDate,
        leadTimeDays: 5,
        escalationDays: [5, 2, 0],
        channels: ["PUSH", "EMAIL"],
        status: "PENDING",
      },
      {
        ownerId,
        financialEventId: carEmiEvent.id,
        title: "Axis Bank car loan EMI due",
        dueDate: carEmiEvent.dueDate,
        leadTimeDays: 3,
        escalationDays: [3, 0],
        channels: ["PUSH"],
        status: "PENDING",
      },
    ],
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

  const tenant = await db.tenant.create({
    data: {
      propertyId: rented.id,
      name: "Neha Kapoor",
      phone: "+91 98110 55621",
      email: "neha.kapoor@example.in",
      leaseStart: monthsAgo(6, 1),
      rentAmount: 38_000,
      depositAmount: 114_000,
      active: true,
    },
  });

  const rentPayments = await Promise.all(
    [-2, -1, 0].map((offset) =>
      db.rentPayment.create({
        data: {
          propertyId: rented.id,
          tenantId: tenant.id,
          dueDate: monthsAgo(-offset, 3),
          amount: 38_000,
          status: offset < 0 ? "PAID" : "DUE",
          paidDate: offset < 0 ? monthsAgo(-offset, 2) : null,
          paidAmount: offset < 0 ? 38_000 : null,
        },
      }),
    ),
  );
  const currentRent = rentPayments[rentPayments.length - 1]!;

  const maintenanceBill = await db.bill.create({
    data: {
      propertyId: rented.id,
      type: "MAINTENANCE",
      dueDate: daysFromNow(8),
      amount: 4_200,
      status: "DUE",
    },
  });

  const propertyTaxBill = await db.bill.create({
    data: {
      propertyId: selfOccupied.id,
      type: "PROPERTY_TAX",
      dueDate: daysFromNow(-6),
      amount: 21_600,
      status: "OVERDUE",
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
      tenureMonths: 180,
      emiAmount: 88_400,
      emiDueDay: 7,
      startDate: yearsAgo(5, 1, 15),
      outstandingBalance: 6_950_000,
      linkedAssetType: "PROPERTY",
      linkedAssetId: selfOccupied.id,
    },
  });

  const upcomingEmi = await db.eMIPayment.create({
    data: {
      loanId: homeLoan.id,
      installmentNumber: 58,
      dueDate: daysFromNow(11),
      principalComponent: 43_900,
      interestComponent: 44_500,
      amount: 88_400,
      status: "DUE",
    },
  });
  await db.eMIPayment.create({
    data: {
      loanId: homeLoan.id,
      installmentNumber: 57,
      dueDate: monthsAgo(1, 7),
      principalComponent: 43_600,
      interestComponent: 44_800,
      amount: 88_400,
      status: "PAID",
      paidDate: monthsAgo(1, 6),
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

  const termPremium = await db.premiumPayment.create({
    data: {
      policyId: termPolicy.id,
      amount: 24_800,
      frequency: "YEARLY",
      dueDate: daysFromNow(60),
      gracePeriodDays: 30,
      status: "DUE",
    },
  });

  const healthPremium = await db.premiumPayment.create({
    data: {
      policyId: healthPolicy.id,
      amount: 16_500,
      frequency: "YEARLY",
      dueDate: daysFromNow(18),
      gracePeriodDays: 15,
      status: "DUE",
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

  const sipReturn = await db.return.create({
    data: {
      investmentId: sipInvestment.id,
      date: monthsAgo(1, 3),
      amount: 3_600,
      label: "Dividend reinvestment",
    },
  });

  // --- Financial events (unifying inflow/outflow spine) -----------------
  await db.financialEvent.createMany({
    data: [
      {
        ownerId,
        type: "INFLOW",
        source: "RENT",
        sourceId: currentRent.id,
        amount: currentRent.amount,
        dueDate: currentRent.dueDate,
        status: "DUE",
        description: "Rent - Sector 50 Rented Flat (Neha Kapoor)",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "BILL",
        sourceId: maintenanceBill.id,
        amount: maintenanceBill.amount,
        dueDate: maintenanceBill.dueDate,
        status: "DUE",
        description: "Maintenance - Sector 50 Rented Flat",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "BILL",
        sourceId: propertyTaxBill.id,
        amount: propertyTaxBill.amount,
        dueDate: propertyTaxBill.dueDate,
        status: "OVERDUE",
        description: "Property tax - DLF Phase 3 Apartment (MCG)",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "EMI",
        sourceId: upcomingEmi.id,
        amount: upcomingEmi.amount,
        dueDate: upcomingEmi.dueDate,
        status: "DUE",
        description: "Home loan EMI - ICICI Bank",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "PREMIUM",
        sourceId: termPremium.id,
        amount: termPremium.amount,
        dueDate: termPremium.dueDate,
        status: "DUE",
        description: "Max Life term plan - annual premium",
      },
      {
        ownerId,
        type: "OUTFLOW",
        source: "PREMIUM",
        sourceId: healthPremium.id,
        amount: healthPremium.amount,
        dueDate: healthPremium.dueDate,
        status: "DUE",
        description: "Niva Bupa health cover - annual premium",
      },
      {
        ownerId,
        type: "INFLOW",
        source: "RETURN",
        sourceId: sipReturn.id,
        amount: sipReturn.amount,
        dueDate: sipReturn.date,
        status: "PAID",
        description: "Parag Parikh Flexi Cap Fund - dividend reinvestment",
      },
    ],
  });

  // --- Reminders (a subset of the events above, with escalation) --------
  const rentEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "RENT", sourceId: currentRent.id },
  });
  const emiEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "EMI", sourceId: upcomingEmi.id },
  });
  const healthPremiumEvent = await db.financialEvent.findFirstOrThrow({
    where: { ownerId, source: "PREMIUM", sourceId: healthPremium.id },
  });

  await db.reminder.createMany({
    data: [
      {
        ownerId,
        financialEventId: rentEvent.id,
        title: "Collect rent - Sector 50 Rented Flat",
        dueDate: rentEvent.dueDate,
        leadTimeDays: 3,
        escalationDays: [3, 1, 0],
        channels: ["PUSH", "WHATSAPP"],
        status: "PENDING",
      },
      {
        ownerId,
        financialEventId: emiEvent.id,
        title: "ICICI home loan EMI due",
        dueDate: emiEvent.dueDate,
        leadTimeDays: 5,
        escalationDays: [5, 2, 0],
        channels: ["PUSH", "EMAIL"],
        status: "PENDING",
      },
      {
        ownerId,
        financialEventId: healthPremiumEvent.id,
        title: "Niva Bupa health premium due",
        dueDate: healthPremiumEvent.dueDate,
        leadTimeDays: 15,
        escalationDays: [15, 7, 1],
        channels: ["EMAIL", "PUSH"],
        status: "PENDING",
      },
    ],
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
