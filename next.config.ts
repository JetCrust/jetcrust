import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // robots.txt and the sitemap must never leave a crawler waiting on the
        // origin. Serve them from the edge and revalidate in the background, so a
        // slow cold start can't turn into a "not accessible" timeout (Ahrefs).
        source: "/:file(robots.txt|sitemap.xml)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
