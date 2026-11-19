import { Home, homeMetadata } from "./_home/home";

export const metadata = homeMetadata;

/**
 * The homepage as signed-out visitors (and search engines) get it. It reads
 * nothing from the request, so it is static: built once and served from
 * the CDN. A visitor with a session cookie is shown `/home` instead (see
 * `src/proxy.ts`), so keep this file free of `getSession`, `cookies()` and
 * `headers()`.
 */
export default function HomePage() {
  return <Home session={null} />;
}
