import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminRequest } from "@/lib/security/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await verifyAdminRequest();
  if (!auth.ok) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08080B]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C5CFF] text-xs font-black text-white">
              AD
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight">
                  Postoll Admin Control
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                  Protected
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Signed in as {auth.actor.email ?? auth.actor.userId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <Link
              href="/"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-neutral-200 transition hover:border-white/35 hover:text-white"
            >
              View Live App
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
