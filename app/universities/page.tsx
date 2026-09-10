import FutureAtlasHeader from "@/components/FutureAtlasHeader";
import GuidanceCTA from "@/components/GuidanceCTA";
import UniversityExplorer from "@/components/Tools/UniversityExplorer";

export default function UniversitiesPage() {
  return (
    <main className="min-h-screen bg-[#F8F9FC]">
      <FutureAtlasHeader />
      <div className="p-6 sm:p-10">
        <UniversityExplorer />
        <GuidanceCTA />
      </div>
    </main>
  );
}
