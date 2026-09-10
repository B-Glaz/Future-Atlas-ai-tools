import type { AIMode } from "@/lib/ai/types";

function value(inputs: unknown, key: string, fallback: string) {
  if (!inputs || typeof inputs !== "object") return fallback;
  const item = (inputs as Record<string, unknown>)[key];
  return typeof item === "string" && item.trim() ? item.trim() : fallback;
}

export function createStructuredFallback(mode: AIMode, inputs: unknown) {
  const study = value(inputs, "study", value(inputs, "course", "your chosen field"));
  const country = value(inputs, "country", "your preferred destination");
  const budget = value(inputs, "budget", "your selected budget");

  if (mode === "country") {
    return {
      countries: [
        { name: "Germany", code: "DE", score: 90, description: `Strong value and study options for ${study}; verify programme-specific entry requirements.`, tags: ["Value focused", "International programmes", "Career options"] },
        { name: "Ireland", code: "IE", score: 84, description: `English-taught ${study} options with an active international student environment.`, tags: ["English speaking", "Technology sector", "Student community"] },
        { name: "Netherlands", code: "NL", score: 80, description: `Broad English-taught choices for ${study}, subject to your ${budget} plan.`, tags: ["English-taught", "Research focused", "International outlook"] },
      ],
      summary: "These are practical starting points. Confirm current tuition, visa, and course requirements before applying.",
    };
  }

  if (mode === "university") {
    return {
      universities: [
        { name: "Technical University of Munich", shortName: "TUM", country: "Germany", location: "Munich, Germany", ranking: "Verify current ranking", tuition: "Check current programme fees", match: 90, type: "Public research university", highlights: [study, "Research focused", "International programmes"] },
        { name: "University College Dublin", shortName: "UCD", country: "Ireland", location: "Dublin, Ireland", ranking: "Verify current ranking", tuition: "Check current programme fees", match: 84, type: "Public research university", highlights: [study, "International community", "Career support"] },
        { name: "University of Twente", shortName: "UT", country: "Netherlands", location: "Enschede, Netherlands", ranking: "Verify current ranking", tuition: "Check current programme fees", match: 80, type: "Public technical university", highlights: [study, "Applied learning", "International programmes"] },
      ],
      summary: `Use this shortlist to compare verified ${study} requirements, fees, and deadlines in ${country}.`,
    };
  }

  if (mode === "scholarship") {
    return {
      scholarships: [
        { name: "University merit scholarships", provider: "Individual universities", country, amount: "Varies", coverage: "May reduce tuition", deadline: "Check each university deadline", match: 88, type: "Merit based", tags: ["University funding", "Academic merit", study] },
        { name: "Government study scholarships", provider: "Destination government", country, amount: "Varies", coverage: "May include tuition or living support", deadline: "Deadlines vary by programme", match: 82, type: "Government funding", tags: ["Government", "Competitive", "International students"] },
        { name: "External education grants", provider: "Foundations and education bodies", country, amount: "Varies", coverage: "Partial study support", deadline: "Check official provider schedules", match: 76, type: "External funding", tags: ["Foundation", "Partial funding", "Eligibility varies"] },
      ],
      summary: "Start with official university and government scholarship pages, then verify eligibility and deadlines.",
    };
  }

  if (mode === "eligibility") {
    return {
      score: 72,
      status: "Promising profile - verify requirements",
      summary: `Your profile may support ${study} applications in ${country}. Exact eligibility depends on each programme's current rules.`,
      breakdown: [
        { title: "Academic Profile", status: "positive", description: `Your stated academic background provides a useful starting point for ${study}.` },
        { title: "English Requirement", status: "caution", description: "Compare your test result with each programme's official minimum score." },
        { title: "Programme Fit", status: "positive", description: "Review prerequisites and module requirements before building your shortlist." },
      ],
      nextSteps: ["Check official programme entry requirements", "Prepare academic and English-language documents", "Shortlist realistic and ambitious options"],
    };
  }

  return {
    tuition: "Check current university fee ranges",
    accommodation: "Varies by city and housing type",
    living: "Varies by lifestyle and destination",
    insurance: "Check destination and visa requirements",
    visa: "Check current official application fees",
    travel: "Compare current fares for your travel period",
    other: "Allow a contingency for deposits and setup costs",
    total: `Build a verified total against ${budget}`,
    budgetStatus: { label: "Needs verified local costs", description: `Compare current fees and living costs for ${country} before committing funds.` },
    aiAnalysis: `Use this as a planning checklist for ${study}. Confirm live prices with official university, government, housing, and travel sources.`,
  };
}
