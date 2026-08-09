import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "kosmetik-admin-auth";
const ROLE_COOKIE = "kosmetik-admin-role";
const getDashboardTarget = (roleValue?: string | null) =>
  String(roleValue || "").toLowerCase() === "staff_pramuniaga" ? "/admin/dashboard-pramuniaga" : "/admin/dashboard";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(ADMIN_COOKIE)?.value;
  if (pathname.startsWith("/admin/login")) {
    if (authCookie === "1") {
      const roleCookie = request.cookies.get(ROLE_COOKIE)?.value || "";
      const roleValue = decodeURIComponent(roleCookie);
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = getDashboardTarget(roleValue);
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/master/users")) {
    const roleCookie = request.cookies.get(ROLE_COOKIE)?.value || "";
    const roleValue = decodeURIComponent(roleCookie).toLowerCase();
    const isSuperAdmin = roleValue === "super_admin";
    const isItSupport = roleValue === "it_support";
    if (!isSuperAdmin && !isItSupport) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = getDashboardTarget(roleValue);
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }
  }

  const roleCookie = request.cookies.get(ROLE_COOKIE)?.value || "";
  const roleValue = decodeURIComponent(roleCookie).toLowerCase();
  if (roleValue === "it_support") {
    if (!pathname.startsWith("/admin/master/users")) {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = "/admin/master/users";
      targetUrl.search = "";
      return NextResponse.redirect(targetUrl);
    }
  }
  if (roleValue === "staff_pramuniaga") {
    if (pathname.startsWith("/admin/dashboard") && pathname !== "/admin/dashboard-pramuniaga") {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = "/admin/dashboard-pramuniaga";
      targetUrl.search = "";
      return NextResponse.redirect(targetUrl);
    }
  }

  if (authCookie === "1") {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
