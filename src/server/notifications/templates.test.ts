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
    expect(rendered.text).toContain("https://trackmyestate.app/properties/prop-1");
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
