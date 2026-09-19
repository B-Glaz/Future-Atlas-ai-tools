"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Loader2, LockKeyhole, Mail, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { accountHistorySnapshot, clearAccountHistory } from "@/lib/local-history";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  requireAuth: (path?: string) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  backupHistory: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_TIMEOUT_MS = 15_000;
const withAuthTimeout = <T,>(operation: PromiseLike<T>) => Promise.race([
  Promise.resolve(operation),
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Authentication timed out. Please try again.")), AUTH_TIMEOUT_MS)),
]);
const localDevName = process.env.NEXT_PUBLIC_LOCAL_DEV_USER_NAME;
const localDevEmail = process.env.NEXT_PUBLIC_LOCAL_DEV_USER_EMAIL;
const localDevPassword = process.env.NEXT_PUBLIC_LOCAL_DEV_USER_PASSWORD;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    futureAtlasGoogleCallback?: (response: { credential?: string }) => void;
    futureAtlasGoogleClientId?: string;
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}
const localDeveloper = {
  id: "local-developer",
  aud: "authenticated",
  role: "authenticated",
  email: localDevEmail,
  email_confirmed_at: new Date(0).toISOString(),
  app_metadata: { provider: "password", providers: ["password"] },
  user_metadata: { full_name: localDevName },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<string>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
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

  const backupHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const response = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ history: await accountHistorySnapshot(user.id), consent: localStorage.getItem("future-atlas:consent") }),
    });
    if (!response.ok) throw new Error("History backup failed. Please try again.");
  }, [user]);

  const signOut = useCallback(async () => {
    window.google?.accounts.id.disableAutoSelect();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  }, [router]);

  const deleteAccount = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const response = await fetch("/api/account", { method: "DELETE", headers: { Authorization: `Bearer ${data.session.access_token}` } });
    if (!response.ok) throw new Error("Account deletion failed. Please try again.");
    await clearAccountHistory(data.session.user.id);
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, requireAuth, signOut, deleteAccount, backupHistory }}>
      {children}
      {open && <AuthDialog onClose={() => setOpen(false)} onVerified={(verifiedUser) => {
        setUser(verifiedUser);
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
  if (loading) return <ToolSkeleton />;
  if (!user) return <ToolSkeleton onSignIn={() => requireAuth()} />;
  return <>{children}</>;
}

function AuthDialog({ onClose, onVerified }: { onClose: () => void; onVerified: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [localHost, setLocalHost] = useState(false);
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => { queueMicrotask(() => setLocalHost(["localhost", "127.0.0.1"].includes(window.location.hostname))); }, []);

  useEffect(() => {
    if (step !== "email" || !googleClientId || !googleButton.current) return;
    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.futureAtlasGoogleCallback = async ({ credential }) => {
          if (!credential) return setError("Google did not return a valid login credential.");
          setBusy(true);
          setError("");
          try {
            const { data, error: googleError } = await withAuthTimeout(supabase.auth.signInWithIdToken({ provider: "google", token: credential }));
            if (googleError || !data.user) throw googleError || new Error("Google login failed.");
            onVerified(data.user);
          } catch (googleError) {
            setBusy(false);
            setError(googleError instanceof Error ? googleError.message : "Google login failed.");
          }
      };
      if (window.futureAtlasGoogleClientId !== googleClientId) {
        window.google.accounts.id.initialize({ client_id: googleClientId, callback: (response) => window.futureAtlasGoogleCallback?.(response) });
        window.futureAtlasGoogleClientId = googleClientId;
      }
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320 });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google) render();
      else existing.addEventListener("load", render, { once: true });
      return () => existing.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    script.onerror = () => setError("Google login could not be loaded.");
    document.head.appendChild(script);
  }, [onVerified, step]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {

    if (step === "password") {
      if (localHost && localDevEmail && localDevPassword && email.trim().toLowerCase() === localDevEmail.toLowerCase() && password === localDevPassword) {
        setBusy(false);
        onVerified(localDeveloper);
        return;
      }
      const { data, error: passwordError } = await withAuthTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
      setBusy(false);
      if (passwordError || !data.user) return setError(passwordError?.message || "Local sign-in failed.");
      onVerified(data.user);
      return;
    }

    if (step === "email") {
      const response = await withAuthTimeout(fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      }));
      const payload = await response.json().catch(() => ({}));
      setBusy(false);
      if (!response.ok) return setError(payload.error || "We could not send the OTP. Please try again.");
      setStep("otp");
      return;
    }

    const { data, error: verifyError } = await withAuthTimeout(supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    }));

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
    onVerified(data.user);
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Sign in to Future Atlas">
      <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white p-6 shadow-2xl">
        <button type="button" onClick={onClose} className="float-right grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={17} /></button>
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white"><LockKeyhole size={20} /></div>
        <h2 className="text-xl font-semibold text-slate-900">{step === "otp" ? "Check your email" : "Continue to your tools"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{step === "otp" ? `Enter the six-digit Future Atlas Login OTP sent to ${email}. It expires shortly and can be used once.` : "Sign in or create an account to continue."}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {step !== "otp" ? <>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Your name" autoComplete="name" />
            <div className="relative"><Mail className="absolute left-3 top-3.5 text-slate-400" size={16} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Email address" autoComplete="email" /></div>
            {step === "password" && <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="Local development password" autoComplete="current-password" />}
          </> : <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-lg tracking-[0.35em] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="000000" autoComplete="one-time-code" />}
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}
            {step === "email" ? "Email me a code" : step === "password" ? "Sign in locally" : "Verify and continue"}
          </button>
          {step === "email" && googleClientId && <div ref={googleButton} className={`flex min-h-10 justify-center ${busy ? "pointer-events-none opacity-60" : ""}`} aria-label="Continue with Google" />}
          {localHost && localDevEmail && localDevPassword && step !== "otp" && <button type="button" onClick={() => { const next = step === "password" ? "email" : "password"; setStep(next); if (next === "password") { setName(localDevName || "Local Developer"); setEmail(localDevEmail); } }} className="w-full text-xs font-medium text-slate-500 hover:text-slate-900">{step === "password" ? "Use email OTP" : "Developer password login"}</button>}
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
