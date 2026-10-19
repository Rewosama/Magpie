import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // Sign out from Supabase (local scope only - doesn't invalidate other sessions)
  // This keeps the extension session intact when logging out from web
  await supabase.auth.signOut({ scope: "local" });

  // Create redirect response to login
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);

  // Clear ALL Supabase cookies with proper options to ensure complete logout
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    if (cookie.name.startsWith("sb-")) {
      // Set cookie to empty with expired date to ensure deletion
      response.cookies.set(cookie.name, "", {
        path: "/",
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }
  }

  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
