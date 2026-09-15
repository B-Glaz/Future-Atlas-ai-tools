"use client";

import { useCallback, useState } from "react";
import { requestAI } from "./request";
import { getAIClientCacheKey, readAIClientCache, writeAIClientCache, clearAIClientCache } from "./client-cache";
import { getProgressiveOptions } from "@/lib/progressive-options";
import { isCustomStudyInputValid } from "@/components/Tools/CustomOptionInput";

export type StepConfig<T extends string> = {
  id: T;
  title: string;
  subtitle: string;
  options: string[];
};

export type ToolFlowConfig<T extends string> = {
  steps: readonly StepConfig<T>[];
  aiMode: string;
  aiMessage: string;
  getInputs: (answers: Record<T, string>) => Record<string, string>;
  resultKey: string;
};

export function useToolFlow<T extends string>(config: ToolFlowConfig<T>) {
  const { steps, aiMode, aiMessage, getInputs, resultKey } = config;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<T, string>>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<unknown[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(false);

  const currentStep = steps[currentStepIndex];
  const currentAnswerKey = currentStep.id;
  const currentSelection = answers[currentAnswerKey] || "";
  const currentCustomValue = customAnswers[currentAnswerKey] || "";
  const isOtherSelected = currentSelection === "Other";
  const canContinue = Boolean(currentSelection) && (!isOtherSelected || isCustomStudyInputValid(currentCustomValue));
  const visibleOptions = getProgressiveOptions(currentStep.options, showAllOptions);

  const getResolvedSelection = useCallback(() =>
    isOtherSelected ? currentCustomValue.trim() : currentSelection,
    [isOtherSelected, currentCustomValue, currentSelection]
  );

  const generateResults = useCallback(async (finalAnswers: Record<T, string>) => {
    setIsLoading(true);
    setError("");

    try {
      const requestBody = {
        mode: aiMode,
        responseFormat: "structured",
        inputs: getInputs(finalAnswers),
        message: aiMessage,
      };
      const cacheKey = getAIClientCacheKey(requestBody);
      const cachedData = readAIClientCache<Record<string, unknown>>(cacheKey);

      if (cachedData && Array.isArray(cachedData[resultKey])) {
        setResults(cachedData[resultKey] as unknown[]);
        return;
      }

      const payload = await requestAI<Record<string, unknown>>(requestBody);

      if (!Array.isArray(payload[resultKey]) || !payload[resultKey].length) {
        throw new Error(`The AI returned no ${resultKey} matches. Please try again.`);
      }

      writeAIClientCache(cacheKey, payload);
      setResults(payload[resultKey] as unknown[]);
    } catch (err) {
      console.error(`${aiMode} AI error:`, err);
      setError("We couldn't refresh your AI matches right now. Please try again shortly.");
    } finally {
      setIsLoading(false);
    }
  }, [aiMode, aiMessage, getInputs, resultKey]);

  const selectOption = useCallback((value: string) => {
    setAnswers(prev => ({ ...prev, [currentAnswerKey]: value }));
  }, [currentAnswerKey]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setShowAllOptions(false);
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const nextStep = useCallback(() => {
    if (!canContinue) return;

    const resolvedValue = getResolvedSelection();
    const updatedAnswers = { ...answers, [currentAnswerKey]: resolvedValue };
    setAnswers(updatedAnswers);

    if (currentStepIndex < steps.length - 1) {
      setShowAllOptions(false);
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setShowResults(true);
      generateResults(updatedAnswers as Record<T, string>);
    }
  }, [canContinue, currentAnswerKey, currentStepIndex, steps.length, answers, getResolvedSelection, generateResults]);

  const clearSelection = useCallback(() => {
    setCurrentStepIndex(0);
    setAnswers({});
    setCustomAnswers({});
    setShowResults(false);
    setResults(null);
    setError("");
    setIsLoading(false);
    clearAIClientCache();
  }, []);

  const handleCustomChange = useCallback((value: string) => {
    setCustomAnswers(prev => ({ ...prev, [currentAnswerKey]: value }));
  }, [currentAnswerKey]);

  return {
    step: currentStepIndex + 1,
    totalSteps: steps.length,
    currentStep,
    currentSelection,
    currentCustomValue,
    isOtherSelected,
    canContinue,
    visibleOptions,
    showAllOptions,
    setShowAllOptions,
    showResults,
    setShowResults,
    results,
    isLoading,
    error,
    answers: answers as Record<T, string>,
    selectOption,
    previousStep,
    nextStep,
    clearSelection,
    handleCustomChange,
    progress: Math.round(((currentStepIndex + 1) / steps.length) * 100),
  };
}