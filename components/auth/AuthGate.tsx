"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LockKeyhole, X } from "lucide-react";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!googleClientId || !googleButton.current) return;
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
  }, [onVerified]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Sign in to Future Atlas">
      <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white p-6 shadow-2xl">
        <button type="button" onClick={onClose} className="float-right grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={17} /></button>
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white"><LockKeyhole size={20} /></div>
        <h2 className="text-xl font-semibold text-slate-900">Continue to your tools</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sign in securely with Google to continue.</p>
        <div className="mt-5">
          {error && <p className="mb-4 text-sm text-rose-600" role="alert">{error}</p>}
          {googleClientId ? <div ref={googleButton} className={`flex min-h-10 justify-center ${busy ? "pointer-events-none opacity-60" : ""}`} aria-label="Continue with Google" /> : <p className="text-sm text-rose-600" role="alert">Google login is not configured.</p>}
        </div>
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
