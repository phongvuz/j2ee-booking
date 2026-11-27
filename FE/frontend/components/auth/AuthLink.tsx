"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { authModalUrl, type AuthMode } from "@/lib/auth-navigation";

export default function AuthLink({ mode, children, className }: {
  mode: AuthMode;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = authModalUrl(pathname, searchParams.toString(), mode);

  return (
    <Link href={href} scroll={false} className={className} onNavigate={(event) => {
      event.preventDefault();
      window.history.pushState(null, "", `${href}${window.location.hash}`);
    }}>
      {children}
    </Link>
  );
}
