"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Loader2, LockKeyhole, Mail, X } from "lucide-react";

import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  requireAuth: (path?: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<string>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const requireAuth = useCallback((path?: string) => {
    if (user) {
      if (path) router.push(path);
      return;
    }
    setDestination(path);
    setOpen(true);
  }, [router, user]);

  return (
    <AuthContext.Provider value={{ user, loading, requireAuth }}>
      {children}
      {open && <AuthDialog onClose={() => setOpen(false)} onVerified={() => {
        setOpen(false);
        if (destination) router.push(destination);
      }} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function ProtectedTool({ children }: { children: ReactNode }) {
  const { user, loading, requireAuth } = useAuth();

  useEffect(() => {
    if (!loading && !user) requireAuth();
  }, [loading, user, requireAuth]);

  if (loading) return <ToolSkeleton />;
  if (!user) return <ToolSkeleton onSignIn={() => requireAuth()} />;
  return children;
}

function AuthDialog({ onClose, onVerified }: { onClose: () => void; onVerified: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    if (step === "email") {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, data: { full_name: name.trim() } },
      });
      setBusy(false);
      if (sendError) return setError(sendError.message);
      setStep("otp");
      return;
    }

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });

    if (verifyError || !data.user) {
      setBusy(false);
      return setError(verifyError?.message || "Verification failed.");
    }

    const { error: profileError } = await supabase.from("future_atlas_profiles").upsert({
      user_id: data.user.id,
      email: data.user.email,
      full_name: name.trim() || data.user.user_metadata.full_name || null,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (profileError) return setError("Account verified, but profile setup failed. Please try again.");
    onVerified();
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Sign in to Future Atlas">
      <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white p-6 shadow-2xl">
        <button type="button" onClick={onClose} className="float-right grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={17} /></button>
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white"><LockKeyhole size={20} /></div>
        <h2 className="text-xl font-semibold text-slate-900">{step === "email" ? "Continue to your tools" : "Check your email"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{step === "email" ? "Sign in or create an account with a one-time email code." : `Enter the six-digit code sent to ${email}.`}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {step === "email" ? <>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Your name" autoComplete="name" />
            <div className="relative"><Mail className="absolute left-3 top-3.5 text-slate-400" size={16} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Email address" autoComplete="email" /></div>
          </> : <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-lg tracking-[0.35em] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="000000" autoComplete="one-time-code" />}
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}
            {step === "email" ? "Email me a code" : "Verify and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ToolSkeleton({ onSignIn }: { onSignIn?: () => void }) {
  return <div className="mx-auto w-full max-w-5xl p-6 sm:p-10" aria-label="Loading tool">
    <div className="skeleton-sweep h-7 w-48 rounded bg-slate-200" />
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton-sweep h-28 rounded-lg bg-slate-200" />)}
    </div>
    {onSignIn && <button type="button" onClick={onSignIn} className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Sign in to continue</button>}
  </div>;
}
