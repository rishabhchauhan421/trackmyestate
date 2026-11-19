import type { MetadataRoute } from "next";

import { cacheLife } from "next/cache";

import { env } from "~/env";

/**
 * Cached for about a day, so the sitemap stays a prebuilt file instead of
 * being rendered for every crawler (it reads the clock for `lastModified`).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");
  return [
    {
      url: env.NEXT_PUBLIC_SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${env.NEXT_PUBLIC_SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
