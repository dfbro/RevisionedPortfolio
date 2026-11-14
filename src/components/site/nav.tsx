"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScrollCounter } from "@/components/motion/scroll-counter";
import { getLenis } from "@/components/motion/smooth-scroll";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/writeups", label: "Writeups" },
  { href: "/projects", label: "Projects" },
  { href: "/achievements", label: "Record" },
  { href: "/about", label: "About" },
];

export function Nav({ brand }: { brand: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchOnIntent = (href: string) => () => router.prefetch(href);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.documentElement.style.overflow;
    const smoothScroll = getLenis();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.documentElement.style.overflow = "hidden";
    smoothScroll?.stop();
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.documentElement.style.overflow = previousOverflow;
      smoothScroll?.start();
    };
  }, [open]);

  return (
    <header className={cn(
      "fixed inset-x-0 top-0 z-50 text-white mix-blend-difference",
      open && "bottom-0 isolate flex h-dvh flex-col bg-background text-foreground mix-blend-normal",
    )}>
      <nav className="relative z-10 mx-auto flex h-16 w-full max-w-[1600px] shrink-0 items-center justify-between px-4 md:px-8">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight" onClick={() => setOpen(false)}>
          {brand}
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              onMouseEnter={prefetchOnIntent(l.href)}
              onFocus={prefetchOnIntent(l.href)}
              onTouchStart={prefetchOnIntent(l.href)}
              className={cn("text-sm transition-opacity hover:opacity-100", pathname.startsWith(l.href) ? "opacity-100" : "opacity-60")}
            >
              {l.label}
            </Link>
          ))}
          <ScrollCounter className="w-14 font-mono text-[11px] tabular-nums opacity-60" />
          <ThemeToggle />
        </div>
        <button
          type="button"
          className={cn("meta md:hidden", open ? "text-foreground" : "text-white")}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "close" : "menu"}
        </button>
      </nav>
      <nav
        id="mobile-menu"
        aria-label="Mobile navigation"
        hidden={!open}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background px-5 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] md:hidden"
      >
        <p className="meta mb-8">Navigate / 01</p>
        <ul className="flex flex-col gap-1">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                prefetch={false}
                onMouseEnter={prefetchOnIntent(l.href)}
                onFocus={prefetchOnIntent(l.href)}
                onTouchStart={prefetchOnIntent(l.href)}
                aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                className={cn(
                  "block py-2 font-display text-[clamp(2.75rem,10vw,4.75rem)] leading-[0.92] tracking-tight transition-colors",
                  pathname.startsWith(l.href) ? "text-primary" : "text-foreground hover:text-primary",
                )}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-6">
          <span className="meta">Appearance</span>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
