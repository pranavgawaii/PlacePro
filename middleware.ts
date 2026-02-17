import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isStudentRoute = pathname.startsWith("/student");
  const isAdminRoute = pathname.startsWith("/admin");

  let supabaseResponse = NextResponse.next({ request });
  let user: { id: string } | null = null;
  let role: string | null = null;

  try {
    const session = await updateSession(request);
    supabaseResponse = session.supabaseResponse;
    user = session.user;
    role = session.role;
  } catch {
    if (isStudentRoute || isAdminRoute) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next({ request });
  }

  if (!user && (isStudentRoute || isAdminRoute)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // CRITICAL: Copy cookies to the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    if (role === "admin" || role === "super_admin") {
      redirectUrl.pathname = "/admin/students";
    } else if (role === "student") {
      redirectUrl.pathname = "/student/dashboard";
    } else {
      redirectUrl.pathname = "/login";
    }
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // CRITICAL: Copy cookies to the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user && isStudentRoute && role !== "student") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = (role === "admin" || role === "super_admin") ? "/admin/students" : "/login";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // CRITICAL: Copy cookies to the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user && isAdminRoute && role !== "admin" && role !== "super_admin") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "student" ? "/student/dashboard" : "/login";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // CRITICAL: Copy cookies to the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
