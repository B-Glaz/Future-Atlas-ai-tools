import FutureAtlasHeader from "@/components/shell/FutureAtlasHeader";
import ApiTokensPanel from "@/components/tokens/ApiTokensPanel";
import { ProtectedTool } from "@/components/auth/AuthGate";

export default function TokensPage() {
  return (
    <main className="min-h-screen bg-[#F8F9FC]">
      <FutureAtlasHeader />
      <section className="mx-auto max-w-3xl px-6 py-14 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
          Future Atlas
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
          API access tokens
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Generate an access token and refresh token to call Future Atlas APIs without staying signed in through the browser.
        </p>
        <div className="mt-8">
          <ProtectedTool>
            <ApiTokensPanel />
          </ProtectedTool>
        </div>
      </section>
    </main>
  );
}
