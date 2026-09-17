"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, GraduationCap, LogOut } from "lucide-react";
import { clearAIClientCache } from "@/lib/ai/client-cache";
import CreditCounter from "@/components/CreditCounter";
import { useAuth } from "@/components/auth/AuthGate";

function resetTemporaryState() {
  const temporaryPrefixes = ["future-atlas-ai-", "future-atlas-country-", "future-atlas-university-", "future-atlas-scholarship-", "future-atlas-eligibility-", "future-atlas-cost-"];
  Object.keys(localStorage).forEach((key) => {
    if (temporaryPrefixes.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
  });
  clearAIClientCache();
}

export default function FutureAtlasHeader() {
  const router = useRouter();
  const { user, signOut, backupHistory } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [busy, setBusy] = useState(false);

  async function finishLogout(withBackup: boolean) {
    setBusy(true);
    setBackupError("");
    try {
      if (withBackup) await backupHistory();
      await signOut();
      setLogoutOpen(false);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Could not complete logout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <nav className="border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-5 lg:px-10">
        <button type="button" onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Go back" title="Go back">
          <ArrowLeft size={18} />
        </button>
        <Link href="/" onClick={resetTemporaryState} className="flex items-center gap-3 text-left" aria-label="Go to Future Atlas homepage">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><GraduationCap size={20} /></div>
          <div>
            <p className="text-sm font-bold tracking-tight">Future Atlas</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Global Pathways</p>
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <CreditCounter />
          {user && <>
          <button type="button" onClick={() => setLogoutOpen(true)} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </>}
        </div>
      </div>
      {logoutOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <div className="w-full max-w-sm border border-slate-200 bg-white p-6 shadow-2xl">
          <h2 id="logout-title" className="text-lg font-semibold text-slate-900">Sign out of Future Atlas?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your device history stays on this device. Back it up to your account before signing out?</p>
          {backupError && <p className="mt-3 text-sm text-rose-600" role="alert">{backupError}</p>}
          <div className="mt-5 grid gap-2">
            <button type="button" disabled={busy} onClick={() => void finishLogout(true)} className="bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">Back up history and sign out</button>
            <button type="button" disabled={busy} onClick={() => void finishLogout(false)} className="border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Sign out without backup</button>
            <button type="button" disabled={busy} onClick={() => setLogoutOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-500">Cancel</button>
          </div>
        </div>
      </div>}
    </nav>
  );
}
