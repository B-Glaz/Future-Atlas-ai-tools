import FutureAtlasHeader from "@/components/shell/FutureAtlasHeader";
import GuidanceForm from "@/components/guidance/ZohoGuidanceForm";

export default function GuidancePage() {
  return (
    <main className="min-h-screen bg-[#F8F9FC]">
      <FutureAtlasHeader />
      <div className="p-6 sm:p-10">
        <GuidanceForm />
      </div>
    </main>
  );
}
