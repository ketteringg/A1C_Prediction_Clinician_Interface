import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip auth for public paths and Next internals
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get("dm_session");
  if (session?.value === "ok") {
    return NextResponse.next();
  }

  // Not authenticated → redirect to login, preserving intended destination
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
