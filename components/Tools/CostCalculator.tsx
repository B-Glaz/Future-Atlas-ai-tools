"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  Plane,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import {
  CustomOptionInput,
  isCustomStudyInputValid,
} from "@/components/Tools/CustomOptionInput";
import {
  getAIClientCacheKey,
  readAIClientCache,
  writeAIClientCache,
  clearAIClientCache,
} from "@/lib/ai/client-cache";
import { requestAI } from "@/lib/ai/request";
import { getProgressiveOptions, MORE_OPTION } from "@/lib/progressive-options";
import ForumCTA from "@/components/ForumCTA";
import ResultLoading from "@/components/ai/ResultLoading";

type BudgetStatus = {
  label: string;
  description: string;
};

type CostData = {
  country: string;
  course: string;
  studyLevel: string;
  tuition: string;
  accommodation: string;
  living: string;
  insurance: string;
  visa: string;
  travel: string;
  other: string;
  total: string;
  budget: string;
  budgetStatus?: BudgetStatus;
aiAnalysis?: string;
};

const questions = [
  {
    id: "country",
    title: "Where are you planning to study?",
    subtitle: "Choose your preferred study destination.",
    options: [
      "Germany",
      "France",
      "United Kingdom",
      "United States",
      "Canada",
      "Australia",
      "Ireland",
      "Netherlands",
      "New Zealand",
      "Italy",
      "Spain",
      "Sweden",
      "Finland",
      "Denmark",
      "Norway",
      "Switzerland",
      "Belgium",
      "Austria",
      "Poland",
      "Portugal",
      "Japan",
      "South Korea",
      "Singapore",
      "United Arab Emirates",
      "Other",
    ],
  },
  {
    id: "studyLevel",
    title: "What level are you planning to study?",
    subtitle: "This helps us estimate tuition and other costs.",
    options: [
      "Bachelor's",
      "Master's",
      "MBA",
      "PhD",
      "Diploma / Certificate",
      "Other",
    ],
  },
  {
    id: "course",
    title: "What do you want to study?",
    subtitle: "Select your broad field of study.",
    options: [
      "Computer Science / IT",
      "Engineering",
      "Business / Management",
      "Data Science / AI",
      "Healthcare / Medicine",
      "Arts / Design",
      "Other",
    ],
  },
  {
    id: "budget",
    title: "What is your approximate annual budget?",
    subtitle: "This helps us understand how comfortable the estimated cost may be.",
    options: [
      "Under ₹10 Lakhs",
      "₹10–20 Lakhs",
      "₹20–30 Lakhs",
      "₹30–50 Lakhs",
      "Above ₹50 Lakhs",
      "I'm not sure",
      "Other",
    ],
  },
];

export default function CostCalculator() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(false);
  const clearSelection = () => {
    setStep(0);
    setAnswers({});
    setCustomAnswers({});
    setResult(null);
    setError("");
    setIsLoading(false);
    clearAIClientCache();
  };
  const currentQuestion = questions[step];
  const currentCustomValue = customAnswers[currentQuestion.id] || "";
  const isOtherSelected = answers[currentQuestion.id] === "Other";
  const canUseCustomAnswer = isCustomStudyInputValid(currentCustomValue);
  const canContinue = Boolean(answers[currentQuestion.id]) && (!isOtherSelected || canUseCustomAnswer);

  const visibleOptions = getProgressiveOptions(currentQuestion.options, showAllOptions);

  const selectAnswer = (answer: string) => {
    setAnswers((current) => ({ ...current, [currentQuestion.id]: answer }));
  };

  const previousStep = () => {
    if (step > 0) {
      setShowAllOptions(false);
      setStep((current) => current - 1);
    }
  };

  const nextStep = () => {
    if (!canContinue) return;

    const resolvedAnswer = isOtherSelected
      ? currentCustomValue.trim()
      : answers[currentQuestion.id];
    const updatedAnswers = { ...answers, [currentQuestion.id]: resolvedAnswer };
    setAnswers(updatedAnswers);

    if (step < questions.length - 1) {
      setShowAllOptions(false);
      setStep((current) => current + 1);
      return;
    }

    generateEstimate(updatedAnswers);
  };
  const generateEstimate = async (data: Record<string, string>) => {
    setIsLoading(true);
    setError("");

    try {
      const requestBody = {
        mode: "cost",
        responseFormat: "structured",
        inputs: data,
        message:
          "Generate a personalized study-abroad cost estimate from the user's inputs.",
      };
      const cacheKey = getAIClientCacheKey(requestBody);
      const cachedData = readAIClientCache<Partial<CostData>>(cacheKey);
      const aiEstimate =
        cachedData ??
        (await (async () => {
      const aiData = await requestAI<{ data?: Partial<CostData> }>(requestBody);

      if (!aiData.data || typeof aiData.data !== "object") {
        throw new Error("The AI returned an incomplete cost estimate. Please try again.");
      }

          writeAIClientCache(cacheKey, aiData.data);
          return aiData.data;
        })());

      setResult({
        country: data.country || "Your destination",
        course: data.course || "Your course",
        studyLevel: data.studyLevel || "Your study level",
        tuition: aiEstimate.tuition || "AI estimate unavailable",
        accommodation:
          aiEstimate.accommodation || "AI estimate unavailable",
        living: aiEstimate.living || "AI estimate unavailable",
        insurance: aiEstimate.insurance || "AI estimate unavailable",
        visa: aiEstimate.visa || "AI estimate unavailable",
        travel: aiEstimate.travel || "AI estimate unavailable",
        other: aiEstimate.other || "AI estimate unavailable",
        total: aiEstimate.total || "AI estimate unavailable",
        budget: data.budget || "Not specified",
        budgetStatus: aiEstimate.budgetStatus,
        aiAnalysis:
          aiEstimate.aiAnalysis ||
          "We could not generate a detailed analysis for this estimate. Please try again shortly.",
      });
    } catch (error) {
      console.error("Cost AI error:", error);
      setError(
        "We couldn't generate your AI estimate right now. Please try again shortly."
      );
    } finally {
      setIsLoading(false);
    }
  };
  const restart = clearSelection;

  if (result) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-violet-600">
              <Sparkles size={16} />
              Your Study Abroad Cost Estimate
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Estimated cost for {result.country}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {result.studyLevel} · {result.course}
            </p>
          </div>

          <button
            onClick={restart}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <X size={15} />
            Clear Selection
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <CostCard
            icon={<Wallet size={19} />}
            title="Tuition"
            value={result.tuition}
          />

          <CostCard
            icon={<Home size={19} />}
            title="Accommodation"
            value={result.accommodation}
          />

          <CostCard
            icon={<Wallet size={19} />}
            title="Living Expenses"
            value={result.living}
          />

          <CostCard
            icon={<ShieldCheck size={19} />}
            title="Insurance"
            value={result.insurance}
          />

          <CostCard
            icon={<Check size={19} />}
            title="Visa"
            value={result.visa}
          />

          <CostCard
            icon={<Plane size={19} />}
            title="Travel"
            value={result.travel}
          />

          <CostCard
            icon={<Wallet size={19} />}
            title="Other Expenses"
            value={result.other}
          />

          <div className="rounded-3xl bg-slate-900 p-7 text-white">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Estimated Total
            </p>

            <p className="mt-4 text-2xl font-semibold">
              {result.total}
            </p>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              This is an estimated range. Actual costs depend on your
              university, city, accommodation, lifestyle, and current
              regulations.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-violet-100 bg-violet-50/50 p-7">
  <div className="flex items-start gap-4">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
      <Sparkles size={18} />
    </div>

    <div className="flex-1">
      <p className="text-xs font-medium uppercase tracking-wider text-violet-600">
        AI Cost Advisor
      </p>

      <h3 className="mt-2 font-semibold text-slate-900">
        Your personalized cost analysis
      </h3>

      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
        {result.aiAnalysis}
      </p>
      <Link href="/guidance" className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
        Get Personalized Guidance
        <ArrowRight size={15} />
      </Link>
    </div>
  </div>
</div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-violet-100">
          <ForumCTA context="cost" />
        </div>
        <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
          Powered by One Window
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={clearSelection} className="text-sm font-medium text-slate-500 transition hover:text-slate-900">
          Clear Selection
        </button>
      </div>
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Calculator size={24} />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Estimate your study abroad cost
        </h1>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
          Answer a few quick questions and get an estimated picture of
          what studying abroad could cost you.
        </p>
      </div>

      <div className="mb-8 flex gap-2">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className={`h-1.5 flex-1 rounded-full ${
              index <= step ? "bg-slate-900" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Question {step + 1} of {questions.length}
        </p>

        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          {currentQuestion.title}
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          {currentQuestion.subtitle}
        </p>

        <div className="mt-8 space-y-3">
          {visibleOptions.map((option) => {
            if (option === MORE_OPTION) {
              return (
                <button key={MORE_OPTION} type="button" onClick={() => setShowAllOptions(true)} aria-expanded={showAllOptions} className="group flex w-full items-center justify-between rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-4 text-left text-violet-700 transition-all duration-200 ease-out hover:border-violet-400 hover:bg-violet-50">
                  <span className="text-sm font-semibold">More</span>
                  <ArrowRight size={17} />
                </button>
              );
            }
            return (
            <button
              key={option}
              onClick={() => selectAnswer(option)}
              className={`group flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                answers[currentQuestion.id] === option
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm font-medium">
                {option}
              </span>

              <ChevronRight
                size={17}
                className={`transition-transform group-hover:translate-x-1 ${
                  answers[currentQuestion.id] === option
                    ? "text-white"
                    : "text-slate-300"
                }`}
              />
            </button>
          );
          })}
        </div>

        {isOtherSelected && (
          <>
            <CustomOptionInput
              value={currentCustomValue}
              onChange={(value) =>
                setCustomAnswers((previous) => ({
                  ...previous,
                  [currentQuestion.id]: value,
                }))
              }
              placeholder="Enter your own study-abroad related answer"
            />
          </>
        )}

        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={previousStep}
            disabled={step === 0 || isLoading}
            className={`flex items-center gap-2 text-sm font-medium transition ${step === 0 || isLoading ? "pointer-events-none opacity-0" : "text-slate-500 hover:text-slate-900"}`}
          >
            <ChevronLeft size={17} />
            Back
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={!canContinue || isLoading}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${canContinue && !isLoading ? "bg-slate-900 text-white hover:bg-slate-800" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}
          >
            {isLoading ? "Generating..." : step === questions.length - 1 ? "Generate Estimate" : "Continue"}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-6 text-center text-[10px] leading-5 text-slate-400">
        {isLoading ? (
          <ResultLoading messages={["Understanding your budget...", "Comparing study costs...", "Preparing your estimate..."]} />
        ) : error ||
          "Estimates are indicative only. Actual costs vary by university, location, lifestyle, exchange rates, and individual circumstances."}
      </div>

      <p className="mt-3 text-center text-[10px] font-medium text-slate-400">
        Powered by One Window
      </p>
    </div>
  );
}

function CostCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) 
{
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>

        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>
      </div>

      <p className="mt-5 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  )
}  
