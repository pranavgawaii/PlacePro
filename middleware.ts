import { NextResponse, type NextRequest } from "next/server";

// Hotfix: keep middleware Edge-safe and side-effect free.
// Auth/role protection is enforced in server layouts and API handlers.
export function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
