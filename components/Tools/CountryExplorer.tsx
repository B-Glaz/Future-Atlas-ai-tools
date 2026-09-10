"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Globe2,
  MapPin,
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
  "Computer Science",
  "Business",
  "Engineering",
  "Medicine",
  "Arts & Design",
  "Other",
];

const budgetOptions = [
  "Under $15,000",
  "$15,000 – $30,000",
  "$30,000 – $50,000",
  "No Preference",
  "Other",
];

const priorityOptions = [
  "Career & Jobs",
  "PR Opportunities",
  "Low Cost",
  "Top Rankings",
  "Scholarships",
  "Other",
];

type CountryMatch = {
  name: string;
  code: string;
  score: number;
  description: string;
  tags: string[];
};

type CountryExplorerState = {
  step: number;
  study: string;
  budget: string;
  priority: string;
  customAnswers: Record<string, string>;
  showResults: boolean;
  results: CountryMatch[] | null;
};

const storageKey = "future-atlas-country-explorer";

function getInitialState(): CountryExplorerState {
  return {
    step: 1,
    study: "",
    budget: "",
    priority: "",
    customAnswers: {},
    showResults: false,
    results: null,
  };
}

export default function CountryExplorer() {
  const [initialState] = useState(getInitialState);
  const [step, setStep] = useState(initialState.step || 1);
  const [study, setStudy] = useState(initialState.study || "");
  const [budget, setBudget] = useState(initialState.budget || "");
  const [priority, setPriority] = useState(initialState.priority || "");
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
    initialState.customAnswers || {}
  );
  const [showResults, setShowResults] = useState(
    Boolean(initialState.showResults)
  );
  const [results, setResults] = useState<CountryMatch[] | null>(
    initialState.results || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(false);
  const clearSelection = () => {
    setStep(1);
    setStudy("");
    setBudget("");
    setPriority("");
    setCustomAnswers({});
    setShowResults(false);
    setResults(null);
    setError("");
    setIsLoading(false);
    localStorage.removeItem(storageKey);
    clearAIClientCache();
  };
  const selectOption = (value: string) => {
    if (step === 1) setStudy(value);
    if (step === 2) setBudget(value);
    if (step === 3) setPriority(value);
  };

  const nextStep = () => {
    if (!canContinue) return;

    const resolvedValue = getResolvedSelection();
    const resolvedAnswers = {
      study: step === 1 ? resolvedValue : study,
      budget: step === 2 ? resolvedValue : budget,
      priority: step === 3 ? resolvedValue : priority,
    };

    if (step === 1) setStudy(resolvedValue);
    if (step === 2) setBudget(resolvedValue);
    if (step === 3) setPriority(resolvedValue);

    if (step < 3) {
      setShowAllOptions(false);
      setStep(step + 1);
    } else {
      setShowResults(true);
      generateResults(resolvedAnswers);
    }
  };

  const generateResults = async (
    answers = { study, budget, priority }
  ) => {
    setIsLoading(true);
    setError("");

    try {
      const requestBody = {
        mode: "country",
        responseFormat: "structured",
        inputs: {
          study: answers.study,
          budget: answers.budget,
          priority: answers.priority,
        },
        message:
          "Recommend the best study-abroad countries for this student.",
      };
      const cacheKey = getAIClientCacheKey(requestBody);
      const cachedData = readAIClientCache<{ countries?: CountryMatch[] }>(
        cacheKey
      );

      if (Array.isArray(cachedData?.countries)) {
        setResults(cachedData.countries);
        return;
      }

      const payload = await requestAI<{
        data?: { countries?: CountryMatch[] };
      }>(requestBody);

      if (!Array.isArray(payload.data?.countries) || !payload.data.countries.length) {
        throw new Error("The AI returned no country matches. Please try again.");
      }

      writeAIClientCache(cacheKey, payload.data);
      setResults(payload.data.countries);
    } catch (error) {
      console.error("Country AI error:", error);
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
    step === 1 ? study : step === 2 ? budget : priority;
  const currentAnswerKey =
    step === 1 ? "study" : step === 2 ? "budget" : "priority";
  const currentCustomValue = customAnswers[currentAnswerKey] || "";
  const isOtherSelected = currentSelection === "Other";
  const canContinue =
    Boolean(currentSelection) &&
    (!isOtherSelected || isCustomStudyInputValid(currentCustomValue));
  const options = step === 1 ? studyOptions : step === 2 ? budgetOptions : priorityOptions;
  const visibleOptions = getProgressiveOptions(options, showAllOptions);
  const getResolvedSelection = () =>
    isOtherSelected ? currentCustomValue.trim() : currentSelection;

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
                    <Globe2 size={23} strokeWidth={1.8} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                        Country Explorer
                      </h1>

                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                        AI Guided
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Find the countries that fit your study goals.
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 sm:flex">
                  <Sparkles size={13} />
                  Takes less than 30 seconds
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
                  {step === 1 && "Let's start with your goals"}
                  {step === 2 && "Let's understand your budget"}
                  {step === 3 && "What matters most to you?"}
                </p>

                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-4xl">
                  {step === 1 && "What would you like to study?"}
                  {step === 2 && "What's your approximate study budget?"}
                  {step === 3 && "What's your top priority?"}
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  {step === 1 &&
                    "Choose the field you're planning to pursue abroad."}
                  {step === 2 &&
                    "This helps us identify destinations that offer the right balance of cost and opportunity."}
                  {step === 3 &&
                    "Pick the factor that matters most when choosing your destination."}
                </p>

                {/* Options */}
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {visibleOptions.map((option) => {                                    if (option === MORE_OPTION) {
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
                    placeholder="Enter your own study-abroad related answer"
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
                    {step === 3 ? "Find My Countries" : "Continue"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-10">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <MapPin size={13} />
                Your answers help personalize your recommendations.
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
                    Countries worth exploring
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Based on your interest in{" "}
                    <span className="font-medium text-slate-700">
                      {study}
                    </span>
                    .
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Your priority
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {priority}
                  </p>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="grid gap-4 p-6 sm:p-10 lg:grid-cols-3">
              {(results || []).map((country, index) => (
                <div
                  key={country.name}
                  className="group rounded-3xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-700">
                      {country.code}
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Match
                      </p>
                      <p className="mt-0.5 text-xl font-bold text-slate-900">
                        {country.score}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                      {country.name}
                    </h3>

                    <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-500">
                      {country.description}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {country.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {index === 0 && (
                    <div className="mt-7 text-center text-[10px] font-medium text-violet-500">
                      Best overall match
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(isLoading || error || !results?.length) && (
              <div className="px-6 pb-6 text-center text-xs text-slate-400 sm:px-10">
                {isLoading
                  ? <ResultLoading messages={["Understanding your priorities...", "Comparing destinations...", "Preparing your best matches..."]} />
                  : error || "Your AI matches will appear here."}
              </div>
            )}

            {/* Results Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-10">
              <div className="text-center">
                <p className="text-xs text-slate-400">
                  Recommendations are personalized based on your responses.
                </p>
              </div>
            </div>
            {!isLoading && Boolean(results?.length) && <ForumCTA context="country" />}
          </>
        )}
      </div>
      <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
        Powered by One Window
      </p>
    </div>
  );
}
