/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Pages are prerendered up to their first `<Suspense>` boundary (the
  // static shell) and the rest streams in at request time. Anything that
  // reads the request or the database has to sit inside a boundary.
  cacheComponents: true,
  experimental: {
    // How long the browser reuses a page it already has instead of asking
    // the server again, in seconds. `dynamic`: a page that was visited
    // (going back to it is instant). `static`: a page fetched ahead of the
    // click — the sidebar does this on hover — and the loading skeleton.
    // Saving a form refreshes these straight away (`revalidatePath`); this
    // only bounds how stale a page can be after a change made elsewhere,
    // e.g. a bill marked paid from an email.
    staleTimes: { dynamic: 30, static: 60 },
  },
};

export default config;
