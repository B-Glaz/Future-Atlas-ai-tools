"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  GraduationCap,
  MapPin,
  Sparkles,
  Star,
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
  "Computer Science",
  "Business & Management",
  "Engineering",
  "Medicine",
  "Data Science & AI",
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

const budgetOptions = [
  "Under $15,000 / year",
  "$15,000 – $30,000 / year",
  "$30,000 – $50,000 / year",
  "No Preference",
  "Other",
];

type UniversityMatch = {
  name: string;
  shortName: string;
  country: string;
  location: string;
  ranking: string;
  tuition: string;
  match: number;
  type: string;
  highlights: string[];
};
export default function UniversityExplorer() {
  const [step, setStep] = useState(1);
  const [study, setStudy] = useState("");
  const [country, setCountry] = useState("");
  const [budget, setBudget] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<UniversityMatch[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(false);
  const clearSelection = () => {
    setStep(1);
    setStudy("");
    setCountry("");
    setBudget("");
    setCustomAnswers({});
    setShowResults(false);
    setResults(null);
    setError("");
    setIsLoading(false);
    clearAIClientCache();
  };
  const selectOption = (value: string) => {
    if (step === 1) setStudy(value);
    if (step === 2) setCountry(value);
    if (step === 3) setBudget(value);
  };

  const nextStep = () => {
    if (!canContinue) return;

    const resolvedValue = getResolvedSelection();
    const resolvedAnswers = {
      study: step === 1 ? resolvedValue : study,
      country: step === 2 ? resolvedValue : country,
      budget: step === 3 ? resolvedValue : budget,
    };

    if (step === 1) setStudy(resolvedValue);
    if (step === 2) setCountry(resolvedValue);
    if (step === 3) setBudget(resolvedValue);

    if (step < 3) {
      setShowAllOptions(false);
      setStep(step + 1);
    } else {
      setShowResults(true);
      generateResults(resolvedAnswers);
    }
  };

  const generateResults = async (
    answers = { study, country, budget }
  ) => {
    setIsLoading(true);
    setError("");

    try {
      const requestBody = {
        mode: "university",
        responseFormat: "structured",
        inputs: {
          study: answers.study,
          country: answers.country,
          budget: answers.budget,
        },
        message:
          "Recommend best-fit universities for this student's study preferences.",
      };
      const cacheKey = getAIClientCacheKey(requestBody);
      const cachedData = readAIClientCache<{
        universities?: UniversityMatch[];
      }>(cacheKey);

      if (Array.isArray(cachedData?.universities)) {
        setResults(cachedData.universities);
        return;
      }

      const payload = await requestAI<{
        data?: { universities?: UniversityMatch[] };
      }>(requestBody);

      if (!Array.isArray(payload.data?.universities) || !payload.data.universities.length) {
        throw new Error("The AI returned no university matches. Please try again.");
      }

      writeAIClientCache(cacheKey, payload.data);
      setResults(payload.data.universities);
    } catch (error) {
      console.error("University AI error:", error);
      setError(
        "We couldn't refresh your AI matches right now. Please try again shortly."
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
    step === 1 ? study : step === 2 ? country : budget;
  const currentAnswerKey =
    step === 1 ? "study" : step === 2 ? "country" : "budget";
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
        : budgetOptions;

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
                    <GraduationCap size={24} strokeWidth={1.8} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                        University Explorer
                      </h1>

                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                        AI Guided
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Discover universities that match your goals.
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 sm:flex">
                  <Sparkles size={13} />
                  Find your best-fit universities
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="px-6 pt-7 sm:px-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  Step {step} of 3
                </span>

                <span className="text-xs font-medium text-slate-400">
                  {Math.round((step / 3) * 100)}%
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-500"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="px-6 py-10 sm:px-10 sm:py-14">
              <div className="mx-auto max-w-3xl">
                <p className="mb-3 text-sm font-medium text-violet-600">
                  {step === 1 && "Let's find your academic match"}
                  {step === 2 && "Choose your preferred destination"}
                  {step === 3 && "Let's understand your budget"}
                </p>

                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-4xl">
                  {step === 1 && "What would you like to study?"}
                  {step === 2 && "Where would you like to study?"}
                  {step === 3 && "What's your approximate tuition budget?"}
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  {step === 1 &&
                    "Select the subject or field you want to pursue at university."}
                  {step === 2 &&
                    "Choose a country you're interested in. You can explore other destinations later."}
                  {step === 3 &&
                    "We'll use this to identify universities that fit your financial preferences."}
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
                        <span className="text-sm font-medium">{option}</span>

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
                    {step === 3 ? "Find Universities" : "Continue"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-10">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <GraduationCap size={13} />
                We&apos;ll personalize your university recommendations.
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
                Change preferences
              </button>

              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-violet-600">
                    <Sparkles size={15} />
                    Your personalized matches
                  </div>

                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900">
                    Universities worth exploring
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Showing universities for{" "}
                    <span className="font-medium text-slate-700">
                      {study}
                    </span>
                    {country && (
                      <>
                        {" "}
                        in{" "}
                        <span className="font-medium text-slate-700">
                          {country}
                        </span>
                      </>
                    )}
                    .
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Tuition preference
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {budget}
                  </p>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="grid gap-4 p-6 sm:p-10 lg:grid-cols-3">
              {(results || []).map((university, index) => (
                <div
                  key={university.name}
                  className="group rounded-3xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5"
                >
                  {/* University Top */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-700">
                      {university.shortName}
                    </div>

                    <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-600">
                      <Star size={12} fill="currentColor" />
                      {university.ranking}
                    </div>
                  </div>

                  {/* Name */}
                  <div className="mt-6">
                    <h3 className="min-h-[56px] text-xl font-semibold leading-7 tracking-tight text-slate-900">
                      {university.name}
                    </h3>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={13} />
                      {university.location}
                    </div>
                  </div>

                  {/* Match */}
                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        Your match
                      </span>

                      <span className="text-lg font-bold text-slate-900">
                        {university.match}%
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: `${university.match}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Type</span>
                      <span className="font-medium text-slate-700">
                        {university.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-slate-400">Tuition</span>
                      <span className="text-right font-medium text-slate-700">
                        {university.tuition}
                      </span>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {university.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>

                  {index === 0 && (
                    <div className="mt-7 text-center text-[10px] font-medium text-violet-500">
                      Best match for your preferences
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(isLoading || error || !results?.length) && (
              <div className="px-6 pb-6 text-center text-xs text-slate-400 sm:px-10">
                {isLoading
                  ? <ResultLoading messages={["Reviewing your preferences...", "Comparing universities...", "Preparing your shortlist..."]} />
                  : error || "Your AI matches will appear here."}
              </div>
            )}

            {/* Results Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-10">
              <div className="text-center">
                <p className="text-xs text-slate-400">
                  Recommendations are personalized based on your preferences.
                </p>
              </div>
            </div>
            {!isLoading && Boolean(results?.length) && <ForumCTA context="university" />}
          </>
        )}
      </div>
      <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
        Powered by One Window
      </p>
    </div>
  );
}
