"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import MovieSearch from "./MovieSearch";
import JoinPartyForm from "./watch-party/JoinPartyForm";
import { InvitationBell } from "./watch-party/InvitationCenter";

interface SiteHeaderProps {
  username: string | null;
  isAuthChecking: boolean;
  isSigningOut: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
  initialSearchQuery?: string;
  genrePage?: boolean;
}

const links = [
  { label: "Home", href: "/#home" },
  { label: "Explore", href: "/#trending", desktopClassName: "hidden xl:block" },
  { label: "Genre", href: "/movies?browse=genres" },
  { label: "News", href: "/#recommended", desktopClassName: "hidden xl:block" },
  { label: "Movies", href: "/movies" },
  { label: "TV Shows", href: "/#recommended", desktopClassName: "hidden xl:block" }
];

export default function SiteHeader({ username, isAuthChecking, isSigningOut, onSignIn, onSignUp, onSignOut, initialSearchQuery = "", genrePage = false }: SiteHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const pathname = usePathname();

  const authActions = username ? (
    <>
      <span className="flex min-w-0 items-center gap-2.5 text-xs text-white/75">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7027e4] to-[#ee0a70] font-semibold text-white">
          {username.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-24 truncate">{username}</span>
      </span>
      <button type="button" onClick={() => setJoinOpen(true)} className="rounded-lg border border-[#ee0a70]/40 px-3 py-2 text-xs font-semibold text-[#ff88bd] transition hover:bg-[#ee0a70]/10">Join party</button>
      <InvitationBell />
      <button type="button" onClick={onSignOut} disabled={isSigningOut} className="rounded-lg px-2 py-2 text-xs text-white/50 transition hover:text-white disabled:opacity-50">
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={onSignIn} className="rounded-lg px-3 py-2 text-xs font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70]">Sign in</button>
      <button type="button" onClick={onSignUp} className="rounded-lg bg-gradient-to-r from-[#7027e4] to-[#ee0a70] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(238,10,112,0.2)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5ca3]">Sign up</button>
    </>
  );

  return (
    <header className="relative z-50" id="home">
      <div className="mx-auto flex h-[92px] max-w-[1320px] items-center justify-between gap-5 px-5 sm:h-[112px] sm:px-8 lg:gap-4 lg:px-10 xl:gap-6">
        <Logo />
        <nav className="hidden flex-1 items-center justify-center gap-4 lg:flex xl:gap-7" aria-label="Primary navigation">
          {links.map((link) => {
            const isActive = link.label === "Genre" ? pathname === "/movies" && genrePage
              : link.href === "/movies" ? pathname === "/movies" && !genrePage
              : pathname === "/" && link.label === "Home";
            return (
              <Link key={link.label} href={link.href} className={`relative py-3 text-[12px] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70] ${link.desktopClassName || ""} ${isActive ? "font-semibold text-white" : "text-white/65"}`}>
                {link.label}
                {isActive && <span className="absolute inset-x-1 -bottom-0.5 h-px bg-[#ee0a70]" />}
              </Link>
            );
          })}
          <Link href="/watch-party" className="relative py-3 text-[12px] font-medium text-[#ff6cae] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70]">Watch Party</Link>
        </nav>

        <div className="hidden lg:block">
          <MovieSearch key={`desktop-${initialSearchQuery}`} initialQuery={initialSearchQuery} />
        </div>

        <div className="ml-auto hidden min-h-10 items-center gap-1 sm:flex lg:ml-0">
          {isAuthChecking ? <span className="h-8 w-28 animate-pulse rounded-lg bg-white/5" /> : authActions}
        </div>

        <button type="button" aria-label="Toggle navigation" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 text-white transition hover:border-[#ee0a70] hover:bg-white/5 lg:hidden">
          <span className="relative block h-4 w-5">
            <span className={`absolute left-0 top-0 h-px w-5 bg-current transition ${isOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`absolute left-0 top-[7px] h-px w-5 bg-current transition ${isOpen ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-[14px] h-px w-5 bg-current transition ${isOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      <nav className={`absolute inset-x-5 top-[82px] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0710]/95 p-2 shadow-2xl backdrop-blur-xl transition-all lg:hidden ${isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-3 opacity-0"}`} aria-label="Mobile navigation">
        <div className="p-2 lg:hidden">
          <MovieSearch key={`mobile-${initialSearchQuery}`} initialQuery={initialSearchQuery} mobile onNavigate={() => setIsOpen(false)} />
        </div>
        {links.map((link) => (
          <Link key={link.label} href={link.href} onClick={() => setIsOpen(false)} className={`block rounded-xl px-4 py-3 text-sm transition hover:bg-white/5 ${(link.label === "Genre" && pathname === "/movies" && genrePage) || (link.label === "Movies" && pathname === "/movies" && !genrePage) || (pathname === "/" && link.label === "Home") ? "text-[#ee0a70]" : "text-white/75"}`}>{link.label}</Link>
        ))}
        <Link href="/watch-party" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-[#ff6cae] transition hover:bg-white/5">Watch Party</Link>
        <button type="button" onClick={() => { setIsOpen(false); setJoinOpen(true); }} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[#ff6cae] transition hover:bg-white/5">Join party</button>
        {username && <div className="px-4 py-2"><InvitationBell /></div>}
        <div className="mt-2 flex items-center gap-2 border-t border-white/10 p-2 sm:hidden">
          {isAuthChecking ? <span className="h-10 w-full animate-pulse rounded-xl bg-white/5" /> : username ? (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-white/80">Hi, {username}</span>
              <button type="button" onClick={() => { setIsOpen(false); onSignOut(); }} disabled={isSigningOut} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65">Sign out</button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => { setIsOpen(false); onSignIn(); }} className="h-10 flex-1 rounded-xl border border-white/10 text-xs font-medium text-white">Sign in</button>
              <button type="button" onClick={() => { setIsOpen(false); onSignUp(); }} className="h-10 flex-1 rounded-xl bg-gradient-to-r from-[#7027e4] to-[#ee0a70] text-xs font-semibold text-white">Sign up</button>
            </>
          )}
        </div>
      </nav>
      {joinOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="join-party-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setJoinOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#100b17] p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="join-party-title" className="text-xl font-semibold">Join a watch party</h2><p className="mt-2 text-sm text-white/50">Enter the room code or paste the host&apos;s invite link.</p></div>
              <button type="button" aria-label="Close join party" onClick={() => setJoinOpen(false)} className="text-xl text-white/50 hover:text-white">×</button>
            </div>
            <div className="mt-6"><JoinPartyForm isSignedIn={Boolean(username)} onRequireSignIn={() => { setJoinOpen(false); onSignIn(); }} onJoined={() => setJoinOpen(false)} /></div>
          </div>
        </div>
      )}
    </header>
  );
}
