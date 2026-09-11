import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import {
  addUtilityRecipient,
  createUtility,
  deactivateUtility,
  generateUtilityBill,
  markBillPaid,
  removeUtilityRecipient,
} from "./utilities";

jest.mock("~/server/db");
jest.mock("~/server/better-auth/server", () => ({
  getSession: jest.fn(),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const getSessionMock = getSession as jest.Mock;
const { redirect } = jest.requireMock("next/navigation") as {
  redirect: jest.Mock;
};
const { revalidatePath } = jest.requireMock("next/cache") as {
  revalidatePath: jest.Mock;
};

const SESSION = { user: { id: "user-1", email: "owner@example.com" } };
const PROPERTY = { id: "prop-1", ownerId: "user-1", name: "Test Flat" };

beforeEach(() => {
  mockReset(dbMock);
  getSessionMock.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
});

function buildUtilityForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    propertyId: "prop-1",
    type: "ELECTRICITY",
    provider: "BESCOM",
    accountNumber: "ACC-1",
    billingType: "VARIABLE",
    recurrence: "MONTHLY",
    defaultAmount: "1500",
    firstDueDate: "2026-06-10",
    reminderLeadDays: "5",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("createUtility", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createUtility(buildUtilityForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("refuses to create a utility for a property the user doesn't own", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(createUtility(buildUtilityForm())).rejects.toThrow(
      "Property not found",
    );
    expect(dbMock.utility.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount before writing anything", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ defaultAmount: "0" })),
    ).rejects.toThrow("Enter a valid amount");
    expect(dbMock.utility.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable due date before writing anything", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ firstDueDate: "" })),
    ).rejects.toThrow("Enter a valid first due date");
    expect(dbMock.utility.create).not.toHaveBeenCalled();
  });

  it("creates only the utility template, then redirects", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "ELECTRICITY",
      provider: "BESCOM",
    } as never);

    await expect(createUtility(buildUtilityForm())).rejects.toThrow(
      "REDIRECT:/properties/prop-1/utilities",
    );

    expect(dbMock.utility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId: "prop-1",
        type: "ELECTRICITY",
        provider: "BESCOM",
        accountNumber: "ACC-1",
        billingType: "VARIABLE",
        recurrence: "MONTHLY",
        defaultAmount: 1500,
        dueDay: 10,
        dueMonth: null,
        reminderLeadDays: 5,
      }),
    });

    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  // Bills are never spawned by the owner-facing create flow — only the
  // (not-yet-built) background job creates them, via generateUtilityBill.
  it("does not create a bill or financial event", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "ELECTRICITY",
      provider: "BESCOM",
    } as never);

    await expect(createUtility(buildUtilityForm())).rejects.toThrow(
      "REDIRECT:",
    );

    expect(dbMock.utilityBill.create).not.toHaveBeenCalled();
    expect(dbMock.financialEvent.create).not.toHaveBeenCalled();
  });

  it("records dueMonth for a YEARLY recurrence, taken from the first due date", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "PROPERTY_TAX",
      provider: null,
    } as never);

    await expect(
      createUtility(
        buildUtilityForm({
          type: "PROPERTY_TAX",
          recurrence: "YEARLY",
          firstDueDate: "2026-09-20",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.utility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDay: 20, dueMonth: 9 }),
    });
  });

  it("does not set dueMonth for a non-YEARLY recurrence", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "ELECTRICITY",
      provider: null,
    } as never);

    await expect(
      createUtility(buildUtilityForm({ recurrence: "WEEKLY" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.utility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueMonth: null }),
    });
  });

  it("rejects a non-numeric amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ defaultAmount: "not-a-number" })),
    ).rejects.toThrow("Enter a valid amount");
    expect(dbMock.utility.create).not.toHaveBeenCalled();
  });

  it("rejects a negative amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ defaultAmount: "-100" })),
    ).rejects.toThrow("Enter a valid amount");
    expect(dbMock.utility.create).not.toHaveBeenCalled();
  });

  it("defaults billingType to VARIABLE when the field is absent entirely", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "ELECTRICITY",
      provider: null,
    } as never);

    const formData = buildUtilityForm();
    formData.delete("billingType");

    await expect(createUtility(formData)).rejects.toThrow("REDIRECT:");

    expect(dbMock.utility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ billingType: "VARIABLE" }),
    });
  });

  it("defaults reminderLeadDays to 7 when the field is absent entirely", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "ELECTRICITY",
      provider: null,
    } as never);

    const formData = buildUtilityForm();
    formData.delete("reminderLeadDays");

    await expect(createUtility(formData)).rejects.toThrow("REDIRECT:");

    expect(dbMock.utility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reminderLeadDays: 7 }),
    });
  });

  it("treats a whitespace-only provider/accountNumber as absent (null)", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "ELECTRICITY",
      provider: null,
    } as never);

    await expect(
      createUtility(
        buildUtilityForm({ provider: "   ", accountNumber: "   " }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.utility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: null, accountNumber: null }),
    });
  });

  it("accepts a leap-day first due date", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.utility.create.mockResolvedValue({
      id: "utility-1",
      type: "ELECTRICITY",
      provider: null,
    } as never);

    await expect(
      createUtility(buildUtilityForm({ firstDueDate: "2028-02-29" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.utility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDay: 29 }),
    });
  });
});

describe("generateUtilityBill", () => {
  const UTILITY = {
    id: "utility-1",
    type: "ELECTRICITY" as const,
    provider: "BESCOM",
  };

  it("creates the bill and a matching OUTFLOW financial event", async () => {
    dbMock.utilityBill.create.mockResolvedValue({ id: "bill-1" } as never);
    dbMock.financialEvent.create.mockResolvedValue({ id: "event-1" } as never);

    const dueDate = new Date(2026, 6, 10);
    await generateUtilityBill({
      ownerId: "user-1",
      property: PROPERTY,
      utility: UTILITY,
      dueDate,
      amount: 1500,
    });

    expect(dbMock.utilityBill.create).toHaveBeenCalledWith({
      data: {
        propertyId: "prop-1",
        utilityId: "utility-1",
        dueDate,
        amount: 1500,
        status: "DUE",
      },
    });
    expect(dbMock.financialEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        type: "OUTFLOW",
        source: "BILL",
        sourceId: "bill-1",
        amount: 1500,
        dueDate,
        status: "DUE",
        description: "BESCOM (Electricity) - Test Flat",
      }),
    });
  });

  it("labels the event with the bill type alone when there is no provider", async () => {
    dbMock.utilityBill.create.mockResolvedValue({ id: "bill-1" } as never);
    dbMock.financialEvent.create.mockResolvedValue({ id: "event-1" } as never);

    await generateUtilityBill({
      ownerId: "user-1",
      property: PROPERTY,
      utility: { id: "utility-1", type: "PROPERTY_TAX", provider: null },
      dueDate: new Date(2026, 6, 10),
      amount: 5000,
    });

    expect(dbMock.financialEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "Property tax - Test Flat",
      }),
    });
  });

  it("returns the created bill", async () => {
    const created = { id: "bill-1" };
    dbMock.utilityBill.create.mockResolvedValue(created as never);
    dbMock.financialEvent.create.mockResolvedValue({ id: "event-1" } as never);

    const result = await generateUtilityBill({
      ownerId: "user-1",
      property: PROPERTY,
      utility: UTILITY,
      dueDate: new Date(2026, 6, 10),
      amount: 1500,
    });

    expect(result).toBe(created);
  });
});

describe("deactivateUtility", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(deactivateUtility("utility-1")).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("throws when the utility doesn't belong to this owner", async () => {
    dbMock.utility.findFirst.mockResolvedValue(null);

    await expect(deactivateUtility("utility-1")).rejects.toThrow(
      "Utility not found",
    );
    expect(dbMock.utility.update).not.toHaveBeenCalled();
  });

  it("sets active to false and revalidates the utilities page", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    await deactivateUtility("utility-1");

    expect(dbMock.utility.update).toHaveBeenCalledWith({
      where: { id: "utility-1" },
      data: { active: false },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  it("does not touch any other utility field", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    await deactivateUtility("utility-1");

    const call = dbMock.utility.update.mock.calls[0]?.[0];
    expect(Object.keys(call?.data ?? {})).toEqual(["active"]);
  });
});

describe("markBillPaid", () => {
  it("throws when the bill doesn't belong to this owner", async () => {
    dbMock.utilityBill.findFirst.mockResolvedValue(null);

    await expect(markBillPaid("bill-1")).rejects.toThrow("Bill not found");
    expect(dbMock.utilityBill.update).not.toHaveBeenCalled();
  });

  it("marks the bill paid and syncs its financial event", async () => {
    dbMock.utilityBill.findFirst.mockResolvedValue({
      id: "bill-1",
      propertyId: "prop-1",
      amount: 1500,
    } as never);

    await markBillPaid("bill-1");

    expect(dbMock.utilityBill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({ status: "PAID", paidAmount: 1500 }),
    });
    expect(dbMock.financialEvent.updateMany).toHaveBeenCalledWith({
      where: { source: "BILL", sourceId: "bill-1" },
      data: { status: "PAID" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  it("records paidAmount as 0 for a free/zero-amount bill", async () => {
    dbMock.utilityBill.findFirst.mockResolvedValue({
      id: "bill-1",
      propertyId: "prop-1",
      amount: 0,
    } as never);

    await markBillPaid("bill-1");

    expect(dbMock.utilityBill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({ paidAmount: 0 }),
    });
  });

  it("is idempotent: marking an already-PAID bill paid again still succeeds", async () => {
    dbMock.utilityBill.findFirst.mockResolvedValue({
      id: "bill-1",
      propertyId: "prop-1",
      amount: 1500,
      status: "PAID",
    } as never);

    await markBillPaid("bill-1");

    expect(dbMock.utilityBill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({ status: "PAID" }),
    });
  });
});

describe("addUtilityRecipient", () => {
  it("throws when the utility doesn't belong to this owner", async () => {
    dbMock.utility.findFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("name", "Spouse");
    formData.set("email", "spouse@example.com");

    await expect(
      addUtilityRecipient("utility-1", formData),
    ).rejects.toThrow("Utility not found");
    expect(dbMock.utilityRecipient.create).not.toHaveBeenCalled();
  });

  it("rejects a missing name or invalid email", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const noName = new FormData();
    noName.set("email", "spouse@example.com");
    await expect(addUtilityRecipient("utility-1", noName)).rejects.toThrow(
      "Enter a name",
    );

    const badEmail = new FormData();
    badEmail.set("name", "Spouse");
    badEmail.set("email", "not-an-email");
    await expect(
      addUtilityRecipient("utility-1", badEmail),
    ).rejects.toThrow("Enter a valid email");

    expect(dbMock.utilityRecipient.create).not.toHaveBeenCalled();
  });

  it("creates the recipient and revalidates the utilities page", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "Spouse");
    formData.set("email", "spouse@example.com");
    formData.set("notifyOnDue", "on");

    await addUtilityRecipient("utility-1", formData);

    expect(dbMock.utilityRecipient.create).toHaveBeenCalledWith({
      data: {
        utilityId: "utility-1",
        name: "Spouse",
        email: "spouse@example.com",
        phone: null,
        notifyOnDue: true,
        notifyOnPaid: false,
        deletedAt: null,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  it("trims whitespace from name and email before validating and storing", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "  Spouse  ");
    formData.set("email", "  spouse@example.com  ");

    await addUtilityRecipient("utility-1", formData);

    expect(dbMock.utilityRecipient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Spouse",
        email: "spouse@example.com",
      }),
    });
  });

  it("rejects a whitespace-only name after trimming", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "   ");
    formData.set("email", "spouse@example.com");

    await expect(
      addUtilityRecipient("utility-1", formData),
    ).rejects.toThrow("Enter a name");
    expect(dbMock.utilityRecipient.create).not.toHaveBeenCalled();
  });

  it("defaults phone to null and both notify flags to false when the form omits them (unchecked checkboxes)", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "Spouse");
    formData.set("email", "spouse@example.com");
    // No "phone", "notifyOnDue" or "notifyOnPaid" fields — this is exactly
    // what a browser submits for an unchecked checkbox (the field is
    // entirely absent, not "off").

    await addUtilityRecipient("utility-1", formData);

    expect(dbMock.utilityRecipient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: null,
        notifyOnDue: false,
        notifyOnPaid: false,
      }),
    });
  });

  // Documents the current (shallow) validation: any string containing "@"
  // passes, even one that isn't a real email address.
  it("accepts any string containing '@', not just well-formed emails", async () => {
    dbMock.utility.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "Spouse");
    formData.set("email", "not@@really-an-email");

    await addUtilityRecipient("utility-1", formData);

    expect(dbMock.utilityRecipient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "not@@really-an-email" }),
    });
  });
});

describe("removeUtilityRecipient", () => {
  it("throws when the recipient doesn't belong to this owner", async () => {
    dbMock.utilityRecipient.findFirst.mockResolvedValue(null);

    await expect(removeUtilityRecipient("recipient-1")).rejects.toThrow(
      "Recipient not found",
    );
    expect(dbMock.utilityRecipient.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the recipient and revalidates the utilities page", async () => {
    dbMock.utilityRecipient.findFirst.mockResolvedValue({
      id: "recipient-1",
      utility: { propertyId: "prop-1" },
    } as never);

    await removeUtilityRecipient("recipient-1");

    expect(dbMock.utilityRecipient.update).toHaveBeenCalledWith({
      where: { id: "recipient-1" },
      data: { deletedAt: expect.any(Date) as Date },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });
});
