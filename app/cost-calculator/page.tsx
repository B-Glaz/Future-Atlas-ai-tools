import FutureAtlasHeader from "@/components/FutureAtlasHeader";
import GuidanceCTA from "@/components/GuidanceCTA";
import CostCalculator from "@/components/Tools/CostCalculator";

export default function CostCalculatorPage() {
  return (
    <main className="min-h-screen bg-[#F8F9FC]">
      <FutureAtlasHeader />
      <div className="p-6 sm:p-10">
        <CostCalculator />
        <GuidanceCTA />
      </div>
    </main>
  );
}
