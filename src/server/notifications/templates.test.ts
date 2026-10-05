jest.mock("~/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app" },
}));

import { renderNotificationEmail } from "./templates";

describe("renderNotificationEmail", () => {
  it("uses the job's title as the subject and includes the body in both html and text", () => {
    const rendered = renderNotificationEmail({
      title: "Rent due in 3 days",
      body: "₹25,000 rent is due on 15 Sep.",
      metadata: { actionUrl: "https://trackmyestate.app/properties/prop-1" },
    });

    expect(rendered.subject).toBe("Rent due in 3 days");
    expect(rendered.html).toContain("Rent due in 3 days");
    expect(rendered.html).toContain("properties/prop-1");
    expect(rendered.text).toContain("₹25,000 rent is due on 15 Sep.");
    expect(rendered.text).toContain(
      "https://trackmyestate.app/properties/prop-1",
    );
  });

  it("falls back to the site URL when the job has no actionUrl", () => {
    const rendered = renderNotificationEmail({
      title: "Reminder",
      body: "Body",
      metadata: null,
    });

    expect(rendered.html).toContain("https://trackmyestate.app");
  });

  it("escapes HTML-significant characters from job content", () => {
    const rendered = renderNotificationEmail({
      title: "<script>alert(1)</script>",
      body: "Body",
      metadata: null,
    });

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });
});

describe("renderNotificationEmail button label", () => {
  it("uses metadata.actionLabel when given (e.g. a guest's stop link)", () => {
    const email = renderNotificationEmail({
      title: "Bill due",
      body: "Electricity — ₹4,120",
      metadata: {
        actionUrl: "https://trackmyestate.app/reminders/stop?guest=g",
        actionLabel: "Stop these reminders",
      },
    });
    expect(email.html).toContain(">Stop these reminders</a>");
    expect(email.html).not.toContain("View in TrackMyEstate");
  });
});

describe("renderNotificationEmail without a button", () => {
  it("renders no link when actionUrl is null", () => {
    const email = renderNotificationEmail({
      title: "Bill due",
      body: "From Ananya Rao, via TrackMyEstate.",
      metadata: { actionUrl: null },
    });
    expect(email.html).not.toContain("<a ");
    expect(email.text).toBe("Bill due\n\nFrom Ananya Rao, via TrackMyEstate.");
  });

  it("labels the link in the plain-text version", () => {
    const email = renderNotificationEmail({
      title: "Bill due",
      body: "Body",
      metadata: { actionUrl: "https://trackmyestate.app/timeline" },
    });
    expect(email.text).toBe(
      "Bill due\n\nBody\n\nView in TrackMyEstate: https://trackmyestate.app/timeline",
    );
  });
});
