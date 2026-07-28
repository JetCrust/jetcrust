import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REDIRECTS } from "@/lib/redirects";

// 301-redirect old WordPress URLs to their new homes so the domain cutover keeps SEO.
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const stripped = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  const target = REDIRECTS[stripped] ?? REDIRECTS[path];
  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API and static assets.
  matcher: ["/((?!_next/|api/|assets/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
