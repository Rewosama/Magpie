import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Root page — redirects authenticated users to /feed and
 * unauthenticated visitors to /login.
 *
 * Requirements: 3.1, 3.2
 */
export default async function RootPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/feed");
  } else {
    redirect("/login");
  }
}
