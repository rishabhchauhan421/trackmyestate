/**
 * Test stand-in for `~/server/households`. `requireScope` reads the mocked
 * `getSession` (so a test's signed-out case still redirects to sign-in) and
 * puts every user in the household `HOUSEHOLD_ID`.
 *
 * Use it with `jest.mock("~/server/households", () => jest.requireActual(
 * "~/server/__testing__/households-mock"))`, next to the usual mocks of
 * `~/server/better-auth/server` and `next/navigation`.
 */

export const HOUSEHOLD_ID = "household-1";

type Session = { user: { id: string; name?: string; email?: string } } | null;

export const requireScope = jest.fn(async () => {
  const { getSession } = jest.requireMock<{
    getSession: () => Promise<Session>;
  }>("~/server/better-auth/server");
  const { redirect } = jest.requireMock<{ redirect: (path: string) => never }>(
    "next/navigation",
  );
  const session = await getSession();
  if (!session) redirect("/login");
  return {
    userId: session!.user.id,
    householdId: HOUSEHOLD_ID,
    user: {
      id: session!.user.id,
      name: session!.user.name ?? "",
      email: session!.user.email ?? "",
    },
  };
});

export const ensureHousehold = jest.fn(async () => HOUSEHOLD_ID);
