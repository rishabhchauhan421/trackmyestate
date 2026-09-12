import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import {
  addUtilityRecipient,
  createUtility,
  deactivateUtility,
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
    expect(dbMock.billSchedule.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount before writing anything", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ defaultAmount: "0" })),
    ).rejects.toThrow("Enter a valid amount");
    expect(dbMock.billSchedule.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable due date before writing anything", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ firstDueDate: "" })),
    ).rejects.toThrow("Enter a valid first due date");
    expect(dbMock.billSchedule.create).not.toHaveBeenCalled();
  });

  it("creates only the utility BillSchedule template, then redirects", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "ELECTRICITY",
      provider: "BESCOM",
    } as never);

    await expect(createUtility(buildUtilityForm())).rejects.toThrow(
      "REDIRECT:/properties/prop-1/utilities",
    );

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        category: "UTILITY_BILL",
        propertyId: "prop-1",
        billType: "ELECTRICITY",
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
  // (not-yet-built) background job creates them, via `generateBill` in
  // `~/server/actions/bills`.
  it("does not create a bill", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "ELECTRICITY",
      provider: "BESCOM",
    } as never);

    await expect(createUtility(buildUtilityForm())).rejects.toThrow(
      "REDIRECT:",
    );

    expect(dbMock.bill.create).not.toHaveBeenCalled();
  });

  it("records dueMonth for a YEARLY recurrence, taken from the first due date", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "PROPERTY_TAX",
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

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDay: 20, dueMonth: 9 }),
    });
  });

  it("does not set dueMonth for a non-YEARLY recurrence", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "ELECTRICITY",
      provider: null,
    } as never);

    await expect(
      createUtility(buildUtilityForm({ recurrence: "WEEKLY" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueMonth: null }),
    });
  });

  it("rejects a non-numeric amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ defaultAmount: "not-a-number" })),
    ).rejects.toThrow("Enter a valid amount");
    expect(dbMock.billSchedule.create).not.toHaveBeenCalled();
  });

  it("rejects a negative amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);

    await expect(
      createUtility(buildUtilityForm({ defaultAmount: "-100" })),
    ).rejects.toThrow("Enter a valid amount");
    expect(dbMock.billSchedule.create).not.toHaveBeenCalled();
  });

  it("defaults billingType to VARIABLE when the field is absent entirely", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "ELECTRICITY",
      provider: null,
    } as never);

    const formData = buildUtilityForm();
    formData.delete("billingType");

    await expect(createUtility(formData)).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ billingType: "VARIABLE" }),
    });
  });

  it("defaults reminderLeadDays to 7 when the field is absent entirely", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "ELECTRICITY",
      provider: null,
    } as never);

    const formData = buildUtilityForm();
    formData.delete("reminderLeadDays");

    await expect(createUtility(formData)).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reminderLeadDays: 7 }),
    });
  });

  it("treats a whitespace-only provider/accountNumber as absent (null)", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "ELECTRICITY",
      provider: null,
    } as never);

    await expect(
      createUtility(
        buildUtilityForm({ provider: "   ", accountNumber: "   " }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: null, accountNumber: null }),
    });
  });

  it("accepts a leap-day first due date", async () => {
    dbMock.property.findFirst.mockResolvedValue(PROPERTY as never);
    dbMock.billSchedule.create.mockResolvedValue({
      id: "utility-1",
      billType: "ELECTRICITY",
      provider: null,
    } as never);

    await expect(
      createUtility(buildUtilityForm({ firstDueDate: "2028-02-29" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDay: 29 }),
    });
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
    dbMock.billSchedule.findFirst.mockResolvedValue(null);

    await expect(deactivateUtility("utility-1")).rejects.toThrow(
      "Utility not found",
    );
    expect(dbMock.billSchedule.update).not.toHaveBeenCalled();
  });

  it("sets active to false and revalidates the utilities page", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    await deactivateUtility("utility-1");

    expect(dbMock.billSchedule.update).toHaveBeenCalledWith({
      where: { id: "utility-1" },
      data: { active: false },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  it("does not touch any other utility field", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    await deactivateUtility("utility-1");

    const call = dbMock.billSchedule.update.mock.calls[0]?.[0];
    expect(Object.keys(call?.data ?? {})).toEqual(["active"]);
  });
});

describe("addUtilityRecipient", () => {
  it("throws when the utility doesn't belong to this owner", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("name", "Spouse");
    formData.set("email", "spouse@example.com");

    await expect(
      addUtilityRecipient("utility-1", formData),
    ).rejects.toThrow("Utility not found");
    expect(dbMock.billSchedule.update).not.toHaveBeenCalled();
  });

  it("rejects a missing name or invalid email", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
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

    expect(dbMock.billSchedule.update).not.toHaveBeenCalled();
  });

  it("pushes the recipient onto the embedded array and revalidates the utilities page", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "Spouse");
    formData.set("email", "spouse@example.com");
    formData.set("notifyOnDue", "on");

    await addUtilityRecipient("utility-1", formData);

    expect(dbMock.billSchedule.update).toHaveBeenCalledWith({
      where: { id: "utility-1" },
      data: {
        recipients: {
          push: {
            name: "Spouse",
            email: "spouse@example.com",
            phone: null,
            notifyOnDue: true,
            notifyOnPaid: false,
          },
        },
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  it("trims whitespace from name and email before validating and storing", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "  Spouse  ");
    formData.set("email", "  spouse@example.com  ");

    await addUtilityRecipient("utility-1", formData);

    expect(dbMock.billSchedule.update).toHaveBeenCalledWith({
      where: { id: "utility-1" },
      data: {
        recipients: {
          push: expect.objectContaining({
            name: "Spouse",
            email: "spouse@example.com",
          }) as unknown,
        },
      },
    });
  });

  it("rejects a whitespace-only name after trimming", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "   ");
    formData.set("email", "spouse@example.com");

    await expect(
      addUtilityRecipient("utility-1", formData),
    ).rejects.toThrow("Enter a name");
    expect(dbMock.billSchedule.update).not.toHaveBeenCalled();
  });

  it("defaults phone to null and both notify flags to false when the form omits them (unchecked checkboxes)", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
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

    expect(dbMock.billSchedule.update).toHaveBeenCalledWith({
      where: { id: "utility-1" },
      data: {
        recipients: {
          push: expect.objectContaining({
            phone: null,
            notifyOnDue: false,
            notifyOnPaid: false,
          }) as unknown,
        },
      },
    });
  });

  // Documents the current (shallow) validation: any string containing "@"
  // passes, even one that isn't a real email address.
  it("accepts any string containing '@', not just well-formed emails", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    const formData = new FormData();
    formData.set("name", "Spouse");
    formData.set("email", "not@@really-an-email");

    await addUtilityRecipient("utility-1", formData);

    expect(dbMock.billSchedule.update).toHaveBeenCalledWith({
      where: { id: "utility-1" },
      data: {
        recipients: {
          push: expect.objectContaining({
            email: "not@@really-an-email",
          }) as unknown,
        },
      },
    });
  });
});

describe("removeUtilityRecipient", () => {
  it("throws when the utility doesn't belong to this owner", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue(null);

    await expect(
      removeUtilityRecipient("utility-1", "spouse@example.com"),
    ).rejects.toThrow("Utility not found");
    expect(dbMock.billSchedule.update).not.toHaveBeenCalled();
  });

  it("removes the recipient by email and revalidates the utilities page", async () => {
    dbMock.billSchedule.findFirst.mockResolvedValue({
      id: "utility-1",
      propertyId: "prop-1",
    } as never);

    await removeUtilityRecipient("utility-1", "spouse@example.com");

    expect(dbMock.billSchedule.update).toHaveBeenCalledWith({
      where: { id: "utility-1" },
      data: {
        recipients: { deleteMany: { where: { email: "spouse@example.com" } } },
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });
});
