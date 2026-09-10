import { headers } from "next/headers";

import EmbedApp from "@/components/embed/EmbedApp";
import AccessRestricted from "@/components/embed/AccessRestricted";
import { evaluateEmbedAccess } from "@/lib/security/embed-access";
import { logUnauthorizedEmbedAccess } from "@/lib/security/unauthorized-access";

export const dynamic = "force-dynamic";

export default async function EmbedPage() {
  const requestHeaders = new Headers(await headers());
  const decision = evaluateEmbedAccess(requestHeaders);

  if (!decision.allowed) {
    await logUnauthorizedEmbedAccess(
      requestHeaders,
      "/embed",
      decision.reason || "Embed access denied."
    );

    return <AccessRestricted />;
  }

  return <EmbedApp />;
}
