import { dispatchNotificationJob } from "~/server/notifications/engine";
import { enqueueNotificationJob } from "~/server/notifications/enqueue";
import { sendGuestWelcomeEmail } from "./emails";

jest.mock("~/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
  },
}));
jest.mock("~/server/notifications/enqueue", () => ({
  enqueueNotificationJob: jest.fn(),
}));
jest.mock("~/server/notifications/engine", () => ({
  dispatchNotificationJob: jest.fn(),
}));

const enqueueMock = enqueueNotificationJob as jest.Mock;
const dispatchMock = dispatchNotificationJob as jest.Mock;

const welcome = {
  guestId: "guest-1",
  ownerId: "owner-1",
  to: "Radha@Example.com",
  guestName: "Radha",
  ownerName: "Ananya Rao",
  categories: ["UTILITY_BILL", "RENT"] as ["UTILITY_BILL", "RENT"],
};

beforeEach(() => {
  enqueueMock
    .mockReset()
    .mockResolvedValue({ job: { id: "job-1" }, created: true });
  dispatchMock.mockReset().mockResolvedValue("SENT");
});

describe("sendGuestWelcomeEmail", () => {
  it("queues the welcome once per guest and address, then sends it now", async () => {
    await sendGuestWelcomeEmail(welcome);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "owner-1",
        channel: "EMAIL",
        recipient: "Radha@Example.com",
        title: "Ananya Rao added you to their TrackMyEstate reminders",
        idempotencyKey: "guest-welcome:guest-1:radha@example.com",
        metadata: expect.objectContaining({
          guestId: "guest-1",
          thirdParty: true,
          actionLabel: "Stop these reminders",
        }) as object,
      }),
    );
    expect((enqueueMock.mock.calls[0] as [{ body: string }])[0].body).toContain(
      "about utility bill, rent",
    );
    expect(dispatchMock).toHaveBeenCalledWith({ id: "job-1" });
  });

  it("doesn't send again when the welcome was already queued", async () => {
    enqueueMock.mockResolvedValue({ job: { id: "job-1" }, created: false });

    await sendGuestWelcomeEmail(welcome);

    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("leaves a failed send to the queue's retries", async () => {
    dispatchMock.mockRejectedValue(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendGuestWelcomeEmail(welcome)).resolves.toBeUndefined();
  });
});
