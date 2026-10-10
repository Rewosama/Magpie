"use client";

export default function SignOutButton({ email }: { email?: string }) {
  return (
    <a
      href="/auth/signout"
      className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
      title={email ? `${email} olarak giriş yapıldı — çıkış yap` : "Çıkış yap"}
    >
      {email && (
        <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 max-w-[160px] truncate">
          {email}
        </span>
      )}
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Çıkış yap"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </a>
  );
}
