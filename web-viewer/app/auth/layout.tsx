/**
 * Auth routes layout - no header, just the content.
 * This prevents the main layout's header from showing during auth flows.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {children}
    </div>
  );
}
