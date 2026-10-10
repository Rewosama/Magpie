import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase";
import SignOutButton from "@/components/SignOutButton";

/**
 * Reads the current user via getUser() (validates JWT with Supabase, more
 * reliable than getSession() which reads from cookie and can return stale data
 * right after a login/logout redirect).
 */
async function UserEmailContent() {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return <SignOutButton email={user.email} />;
  } catch {
    return null;
  }
}

/**
 * Renders the user's email + logout button in the header.
 * Suspense ensures a missing/slow session never breaks the header.
 */
export function UserEmail() {
  return (
    <Suspense fallback={null}>
      <UserEmailContent />
    </Suspense>
  );
}
