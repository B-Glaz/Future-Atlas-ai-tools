"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  Sparkles,
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

const studyOptions = [
  "Computer Science & AI",
  "Business & Management",
  "Engineering",
  "Medicine & Health",
  "Data Science",
  "Arts & Design",
  "Other",
];

const countryOptions = [
  "Germany",
  "United Kingdom",
  "United States",
  "Canada",
  "France",
  "Ireland",
  "Other",
];

const academicOptions = [
  "90% or above",
  "80% – 89%",
  "70% – 79%",
  "60% – 69%",
  "Below 60%",
  "Other",
];

const englishOptions = [
  "IELTS 7.0+",
  "IELTS 6.5",
  "IELTS 6.0",
  "IELTS below 6.0",
  "I haven't taken a test yet",
  "Other",
];

const levelOptions = [
  "Bachelor's",
  "Master's",
  "PhD / Doctorate",
  "Other",
];

type EligibilityBreakdown = {
  title: string;
  status: "positive" | "caution";
  description: string;
};

type EligibilityResult = {
  score: number;
  status: string;
  summary: string;
  breakdown: EligibilityBreakdown[];
  nextSteps: string[];
};

type EligibilityState = {
  step: number;
  study: string;
  country: string;
  academic: string;
  english: string;
  level: string;
  customAnswers: Record<string, string>;
  showResults: boolean;
  result: EligibilityResult | null;
};

const storageKey = "future-atlas-eligibility-checker";

function getInitialState(): EligibilityState {
  return {
    step: 1,
    study: "",
    country: "",
    academic: "",
    english: "",
    level: "",
    customAnswers: {},
    showResults: false,
    result: null,
  };
}

export default function EligibilityChecker() {
  const [initialState] = useState(getInitialState);
  const [step, setStep] = useState(initialState.step || 1);

  const [study, setStudy] = useState(initialState.study || "");
  const [country, setCountry] = useState(initialState.country || "");
  const [academic, setAcademic] = useState(
    initialState.academic || ""
  );
  const [english, setEnglish] = useState(initialState.english || "");
  const [level, setLevel] = useState(initialState.level || "");
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
    initialState.customAnswers || {}
  );

  const [showResults, setShowResults] = useState(
    Boolean(initialState.showResults)
  );
  const [result, setResult] = useState<EligibilityResult | null>(
    initialState.result || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(false);
  const clearSelection = () => {
    setStep(1);
    setStudy("");
    setCountry("");
    setAcademic("");
    setEnglish("");
    setLevel("");
    setCustomAnswers({});
    setShowResults(false);
    setResult(null);
    setError("");
    setIsLoading(false);
    localStorage.removeItem(storageKey);
    clearAIClientCache();
  };
  const selectOption = (value: string) => {
    if (step === 1) setStudy(value);
    if (step === 2) setCountry(value);
    if (step === 3) setAcademic(value);
    if (step === 4) setEnglish(value);
    if (step === 5) setLevel(value);
  };

  const nextStep = () => {
    if (!canContinue) return;

    const resolvedValue = getResolvedSelection();
    const resolvedAnswers = {
      study: step === 1 ? resolvedValue : study,
      country: step === 2 ? resolvedValue : country,
      academic: step === 3 ? resolvedValue : academic,
      english: step === 4 ? resolvedValue : english,
      level: step === 5 ? resolvedValue : level,
    };

    if (step === 1) setStudy(resolvedValue);
    if (step === 2) setCountry(resolvedValue);
    if (step === 3) setAcademic(resolvedValue);
    if (step === 4) setEnglish(resolvedValue);
    if (step === 5) setLevel(resolvedValue);

    if (step < 5) {
      setShowAllOptions(false);
      setStep(step + 1);
    } else {
      setShowResults(true);
      generateResult(resolvedAnswers);
    }
  };

  const generateResult = async (
    answers = { study, country, academic, english, level }
  ) => {
    setIsLoading(true);
    setError("");

    try {
      const requestBody = {
        mode: "eligibility",
        responseFormat: "structured",
        inputs: {
          study: answers.study,
          country: answers.country,
          academic: answers.academic,
          english: answers.english,
          level: answers.level,
        },
        message:
          "Create a preliminary study-abroad eligibility assessment for this student.",
      };
      const cacheKey = getAIClientCacheKey(requestBody);
      const cachedData = readAIClientCache<EligibilityResult>(cacheKey);

      if (cachedData) {
        setResult(cachedData);
        return;
      }

      const payload = await requestAI<{ data?: EligibilityResult }>(requestBody);

      if (!payload.data || typeof payload.data !== "object") {
        throw new Error("The AI returned an incomplete assessment. Please try again.");
      }

      writeAIClientCache(cacheKey, payload.data);
      setResult(payload.data);
    } catch (error) {
      console.error("Eligibility AI error:", error);
      setError(
        "We couldn't refresh your AI assessment right now. Please try again shortly."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const previousStep = () => {
    if (step > 1) {
      setShowAllOptions(false);
      setStep(step - 1);
    }
  };

  const currentSelection =
    step === 1
      ? study
      : step === 2
        ? country
        : step === 3
          ? academic
          : step === 4
          ? english
          : level;
  const currentAnswerKey =
    step === 1
      ? "study"
      : step === 2
        ? "country"
        : step === 3
          ? "academic"
          : step === 4
            ? "english"
            : "level";
  const currentCustomValue = customAnswers[currentAnswerKey] || "";
  const isOtherSelected = currentSelection === "Other";
  const canContinue =
    Boolean(currentSelection) &&
    (!isOtherSelected || isCustomStudyInputValid(currentCustomValue));
  const getResolvedSelection = () =>
    isOtherSelected ? currentCustomValue.trim() : currentSelection;

  const options =
    step === 1
      ? studyOptions
      : step === 2
        ? countryOptions
        : step === 3
          ? academicOptions
          : step === 4
            ? englishOptions
            : levelOptions;

  const assessment = result;
  const score = assessment?.score ?? 0;

  const visibleOptions = getProgressiveOptions(options, showAllOptions);

  return (
    <div className="w-full max-w-5xl">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={clearSelection}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          Clear Selection
        </button>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        {!showResults ? (
          <>
            {/* Header */}
            <div className="border-b border-slate-100 px-6 py-6 sm:px-10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                    <ClipboardCheck size={23} strokeWidth={1.8} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                        Eligibility Checker
                      </h1>

                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                        AI Guided
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Get a quick assessment of your study abroad eligibility.
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 sm:flex">
                  <Sparkles size={13} />
                  Takes about 60 seconds
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="px-6 pt-7 sm:px-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  Step {step} of 5
                </span>

                <span className="text-xs font-medium text-slate-400">
                  {Math.round((step / 5) * 100)}%
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-500"
                  style={{ width: `${(step / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="px-6 py-10 sm:px-10 sm:py-14">
              <div className="mx-auto max-w-3xl">
                <p className="mb-3 text-sm font-medium text-violet-600">
                  {step === 1 && "Let's understand your academic goal"}
                  {step === 2 && "Choose your preferred destination"}
                  {step === 3 && "Tell us about your academics"}
                  {step === 4 && "Let's check your language readiness"}
                  {step === 5 && "One last question"}
                </p>

                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-4xl">
                  {step === 1 && "What would you like to study?"}
                  {step === 2 && "Where are you planning to study?"}
                  {step === 3 && "What's your academic performance?"}
                  {step === 4 && "What's your English proficiency?"}
                  {step === 5 && "What level do you want to study?"}
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  {step === 1 &&
                    "Select the field you're interested in pursuing abroad."}

                  {step === 2 &&
                    "Choose a destination so we can consider typical admission requirements."}

                  {step === 3 &&
                    "Select the academic range that best represents your current or previous qualification."}

                  {step === 4 &&
                    "Choose your current English language test status or score."}

                  {step === 5 &&
                    "Different study levels have different academic and language requirements."}
                </p>

                {/* Options */}
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {visibleOptions.map((option) => {
                                        if (option === MORE_OPTION) {
                      return (
                        <button key={MORE_OPTION} type="button" onClick={() => setShowAllOptions(true)} aria-expanded={showAllOptions} className="group flex min-h-[64px] items-center justify-between rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 px-5 text-left text-violet-700 transition-all duration-200 ease-out hover:border-violet-400 hover:bg-violet-50">
                          <span className="text-sm font-semibold">More</span>
                          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </button>
                      );
                    }
                    const selected = currentSelection === option;
                    return (
                      <button
                        key={option}
                        onClick={() => selectOption(option)}
                        className={`group flex min-h-[64px] items-center justify-between rounded-2xl border px-5 text-left transition-all duration-200 ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10"
                            : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {option}
                        </span>

                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                            selected
                              ? "border-white bg-white text-slate-900"
                              : "border-slate-200 text-transparent group-hover:border-slate-300"
                          }`}
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isOtherSelected && (
                  <CustomOptionInput
                    value={currentCustomValue}
                    onChange={(value) =>
                      setCustomAnswers((previous) => ({
                        ...previous,
                        [currentAnswerKey]: value,
                      }))
                    }
                    placeholder="Enter your own education-related answer"
                  />
                )}

                {/* Navigation */}
                <div className="mt-10 flex items-center justify-between">
                  <button
                    onClick={previousStep}
                    disabled={step === 1}
                    className={`flex items-center gap-2 text-sm font-medium transition ${
                      step === 1
                        ? "pointer-events-none opacity-0"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <ChevronLeft size={17} />
                    Back
                  </button>

                  <button
                    onClick={nextStep}
                    disabled={!canContinue}
                    className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
                      canContinue
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15 hover:-translate-y-0.5 hover:bg-slate-800"
                        : "cursor-not-allowed bg-slate-100 text-slate-400"
                    }`}
                  >
                    {step === 5 ? "Check My Eligibility" : "Continue"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-10">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <GraduationCap size={13} />
                This assessment is an initial guide, not an admission decision.
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Results Header */}
            <div className="border-b border-slate-100 px-6 py-7 sm:px-10">
              <button
                onClick={() => setShowResults(false)}
                className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
              >
                <ChevronLeft size={17} />
                Review my answers
              </button>

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-violet-600">
                  <Sparkles size={15} />
                  Your preliminary assessment
                </div>

                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900">
                  Your eligibility snapshot
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Based on the information you provided, here&apos;s an initial
                  assessment of your study abroad readiness.
                </p>
              </div>
            </div>

            {/* Result Content */}
            <div className="p-6 sm:p-10">
              {/* Score */}
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl bg-slate-900 p-7 text-white sm:p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Estimated eligibility match
                      </p>

                      <p className="mt-4 text-6xl font-bold tracking-[-0.05em]">
                        {score}%
                      </p>
                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                      <CheckCircle2 size={24} />
                    </div>
                  </div>

                  <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-700"
                      style={{ width: `${score}%` }}
                    />
                  </div>

                  <div className="mt-6">
                    <p className="text-lg font-semibold">
                      {assessment?.status || "Assessment pending"}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {assessment?.summary ||
                        "Your AI assessment will appear here shortly."}
                    </p>
                  </div>
                </div>

                {/* Profile Summary */}
                <div className="rounded-3xl border border-slate-200 p-7 sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Your profile
                  </p>

                  <div className="mt-6 space-y-5">
                    <div>
                      <p className="text-xs text-slate-400">
                        Study field
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {study}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Destination
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {country}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Academic performance
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {academic}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        English proficiency
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {english}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Study level
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {level}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirement Checks */}
              <div className="mt-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Your readiness breakdown
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    A quick view of the areas that may influence your
                    eligibility.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {(assessment?.breakdown || []).slice(0, 3).map((item) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-slate-200 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        {item.title}
                      </p>

                      {item.status === "caution" ? (
                        <CircleAlert
                          size={18}
                          className="text-slate-500"
                        />
                      ) : (
                        <CheckCircle2
                          size={18}
                          className="text-slate-700"
                        />
                      )}
                    </div>

                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                  ))}
                </div>
              </div>

              {/* Next Steps */}
              <div className="mt-8 rounded-3xl bg-slate-50 p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <CircleAlert size={19} className="text-slate-600" />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      What you should do next
                    </h3>

                    <div className="mt-4 space-y-3">
                      {(assessment?.nextSteps || []).slice(0, 3).map((step, index) => (
                      <div key={step} className="flex items-start gap-3">
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                          {index + 1}
                        </span>

                        <p className="text-sm leading-6 text-slate-600">
                          {step}
                        </p>
                      </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="mt-6 text-center text-xs leading-5 text-slate-400">
                {isLoading
                  ? <ResultLoading messages={["Reviewing your profile...", "Checking programme fit...", "Preparing your assessment..."]} />
                  : error ||
                    "This tool provides an initial estimate based on the information you provide. It does not guarantee admission or visa approval. Requirements vary by university, programme, country, and applicant circumstances. Always verify requirements with official sources."}
              </p>
            </div>
            {!isLoading && result && <ForumCTA context="eligibility" />}
          </>
        )}
      </div>
      <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
        Powered by One Window
      </p>
    </div>
  );
}
