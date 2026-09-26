"use client";

import { useCallback, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { supabase } from "@/lib/supabase";

type IssuedTokens = {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

type TokenStatus = {
  has_active_refresh: boolean;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  api_requests_remaining_today?: number;
  api_requests_remaining_hour?: number;
};

type Validity = {
  valid: boolean;
  token_type: string | null;
  expires_at: string | null;
};

async function sessionHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in required.");
  return { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <div className="mt-2 flex gap-2">
        <input readOnly value={value} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </label>
  );
}

export default function ApiTokensPanel() {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [issued, setIssued] = useState<IssuedTokens | null>(null);
  const [checkToken, setCheckToken] = useState("");
  const [validity, setValidity] = useState<Validity | null>(null);
  const [refreshValue, setRefreshValue] = useState("");
  const [refreshedAccess, setRefreshedAccess] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const loadStatus = useCallback(async () => {
    const headers = await sessionHeaders();
    const response = await fetch("/api/tokens", { headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "Could not load token status.");
    setStatus(payload);
  }, []);

  async function run(action: string, work: () => Promise<void>) {
    setBusy(action);
    setError("");
    try {
      await work();
    } catch (workError) {
      setError(workError instanceof Error ? workError.message : "Request failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-6">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white"><KeyRound size={20} /></div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Generate tokens</h2>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          {status?.has_active_refresh
            ? `Active refresh until ${formatTime(status.refresh_expires_at)}. Access until ${formatTime(status.access_expires_at)}. ${status.api_requests_remaining_today ?? 200} API requests left today, ${status.api_requests_remaining_hour ?? 10} left this hour.`
            : "Generate a pair, then copy both values immediately."}
        </p>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("generate", async () => {
          const response = await fetch("/api/tokens", { method: "POST", headers: await sessionHeaders() });
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error || "Could not generate tokens.");
          setIssued(payload);
          setRefreshedAccess("");
          await loadStatus();
        })} className="mt-5 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy === "generate" ? "Generating…" : "Generate access and refresh tokens"}
        </button>
        {issued && (
          <div className="mt-5 grid gap-4">
            <p className="text-sm text-amber-700">Copy these now. The full values are not shown again.</p>
            <CopyField label="Access token" value={issued.access_token} />
            <CopyField label="Refresh token" value={issued.refresh_token} />
            <p className="text-xs text-slate-400">Access expires {formatTime(issued.access_expires_at)}. Refresh expires {formatTime(issued.refresh_expires_at)}.</p>
            <p className="text-xs leading-5 text-slate-500">Use the access token as <code className="rounded bg-slate-100 px-1">Authorization: Bearer fa_atk_…</code> on backend APIs.</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Check validity</h2>
        <p className="mt-1 text-sm text-slate-500">Paste an access or refresh token to see whether it is still valid.</p>
        <textarea value={checkToken} onChange={(event) => setCheckToken(event.target.value)} rows={3} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" placeholder="fa_atk_… or fa_rtk_…" />
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("validate", async () => {
          const response = await fetch("/api/tokens/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: checkToken.trim() }) });
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error || "Could not validate token.");
          setValidity(payload);
        })} className="mt-4 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60">
          {busy === "validate" ? "Checking…" : "Check token"}
        </button>
        {validity && (
          <p className="mt-4 text-sm text-slate-600">
            {validity.valid ? `Valid ${validity.token_type || "token"} until ${formatTime(validity.expires_at)}.` : "This token is invalid, expired, or revoked."}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Refresh access token</h2>
        <p className="mt-1 text-sm text-slate-500">Rotates the refresh token and issues a new access token. The previous pair stops working.</p>
        <textarea value={refreshValue} onChange={(event) => setRefreshValue(event.target.value)} rows={3} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" placeholder="fa_rtk_…" />
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("refresh", async () => {
          const response = await fetch("/api/tokens/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: refreshValue.trim() }) });
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error || "Could not refresh token.");
          setRefreshedAccess(payload.access_token);
          if (payload.refresh_token) setRefreshValue(payload.refresh_token);
          await loadStatus();
        })} className="mt-4 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60">
          {busy === "refresh" ? "Refreshing…" : "Get new access token"}
        </button>
        {refreshedAccess && (
          <div className="mt-4 space-y-3">
            <CopyField label="New access token" value={refreshedAccess} />
            <CopyField label="New refresh token" value={refreshValue} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Revoke tokens</h2>
        <p className="mt-1 text-sm text-slate-500">Revoke the current pair, or paste a specific access or refresh token. Revoking a refresh token also revokes its access tokens.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => void run("revoke-all", async () => {
            const response = await fetch("/api/tokens", { method: "DELETE", headers: await sessionHeaders(), body: JSON.stringify({ all: true }) });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || "Could not revoke tokens.");
            setIssued(null);
            setRefreshedAccess("");
            await loadStatus();
          })} className="rounded-lg bg-rose-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy === "revoke-all" ? "Revoking…" : "Revoke all tokens"}
          </button>
          <button type="button" disabled={Boolean(busy) || !issued} onClick={() => void run("revoke-issued", async () => {
            if (!issued) return;
            const response = await fetch("/api/tokens", { method: "DELETE", headers: await sessionHeaders(), body: JSON.stringify({ accessToken: issued.access_token, refreshToken: issued.refresh_token }) });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || "Could not revoke tokens.");
            setIssued(null);
            await loadStatus();
          })} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60">
            {busy === "revoke-issued" ? "Revoking…" : "Revoke generated pair"}
          </button>
        </div>
      </section>

      <p className="text-sm leading-6 text-slate-500">Creates a new access token (1 hour) and refresh token (30 days). Previous tokens for this account are revoked. API calls allow 200 requests per calendar day and 10 requests per hour.</p>
    </div>
  );
}
