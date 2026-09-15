import { NextRequest, NextResponse } from "next/server";

import { createAdminSupabase, createRequestSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function reply(requestId: string, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "X-Request-ID": requestId } });
}

function userClient(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return token ? createRequestSupabase(token) : null;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const client = userClient(request);
  if (!client) return reply(requestId, { error: { code: "AUTH_REQUIRED", message: "Sign in first.", requestId } }, 401);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return reply(requestId, { error: { code: "AUTH_REQUIRED", message: "Session expired.", requestId } }, 401);
  const { data, error } = await client.rpc("future_atlas_list_tenants");
  if (error) return reply(requestId, { error: { code: "TENANT_LIST_FAILED", message: "Could not load tenants.", requestId } }, 500);
  return reply(requestId, { data, requestId });
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const client = userClient(request);
  if (!client) return reply(requestId, { error: { code: "AUTH_REQUIRED", message: "Sign in first.", requestId } }, 401);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return reply(requestId, { error: { code: "AUTH_REQUIRED", message: "Session expired.", requestId } }, 401);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return reply(requestId, { error: { code: "INVALID_REQUEST", message: "Valid action required.", requestId } }, 400);
  }

  let result;
  if (body.action === "create") {
    if (typeof body.name !== "string" || typeof body.slug !== "string") return reply(requestId, { error: { code: "INVALID_REQUEST", message: "Name and slug required.", requestId } }, 400);
    result = await client.rpc("future_atlas_create_tenant", { p_name: body.name, p_slug: body.slug, p_environment: body.environment === "production" ? "production" : "sandbox" });
  } else if (body.action === "issueCredential") {
    result = await client.rpc("future_atlas_issue_credential", { p_tenant_id: body.tenantId, p_name: body.name, p_scopes: ["ai:generate"], p_expires_at: body.expiresAt || null });
  } else if (body.action === "revokeCredential") {
    result = await client.rpc("future_atlas_revoke_credential", { p_credential_id: body.credentialId });
  } else if (body.action === "registerDomain") {
    result = await client.rpc("future_atlas_register_domain", { p_tenant_id: body.tenantId, p_origin: body.origin });
  } else if (body.action === "verifyDomain") {
    if (typeof body.domainId !== "string" || typeof body.origin !== "string" || typeof body.verificationToken !== "string") {
      return reply(requestId, { error: { code: "INVALID_REQUEST", message: "Domain verification details required.", requestId } }, 400);
    }
    let hostname: string;
    try { hostname = new URL(body.origin).hostname; } catch { return reply(requestId, { error: { code: "INVALID_ORIGIN", message: "Valid origin required.", requestId } }, 400); }
    const dns = await fetch("https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent("_future-atlas." + hostname) + "&type=TXT", {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(5_000),
    }).then((response) => response.json()).catch(() => null) as { Answer?: Array<{ data?: string }> } | null;
    const verified = dns?.Answer?.some((answer) => answer.data?.replace(/^"|"$/g, "") === body.verificationToken);
    if (!verified) return reply(requestId, { error: { code: "DOMAIN_NOT_VERIFIED", message: "Required TXT record was not found.", requestId } }, 409);
    try {
      result = await createAdminSupabase().rpc("future_atlas_mark_domain_verified", { p_domain_id: body.domainId, p_origin: body.origin, p_token: body.verificationToken });
    } catch {
      return reply(requestId, { error: { code: "SERVER_CONFIGURATION_ERROR", message: "Domain verification is not configured.", requestId } }, 503);
    }
  } else {
    return reply(requestId, { error: { code: "INVALID_ACTION", message: "Unknown tenant action.", requestId } }, 400);
  }

  if (result.error) return reply(requestId, { error: { code: result.error.message || "TENANT_ACTION_FAILED", message: "Tenant action failed.", requestId } }, 400);
  return reply(requestId, { data: result.data, requestId }, body.action === "create" ? 201 : 200);
}
