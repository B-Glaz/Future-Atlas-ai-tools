import assert from "node:assert/strict";
import { getStructuredResult, isStructuredOutput } from "../lib/ai/structured-output.ts";

const country = { countries: [{ name: "Canada", code: "CA", score: 90, description: "Good fit.", tags: ["Research"] }] };
assert.equal(isStructuredOutput("country", country), true);
assert.deepEqual(getStructuredResult({ data: country }, "countries"), country.countries);

const cost = {
  tuition: "Varies", accommodation: "Varies", living: "Varies", insurance: "Varies",
  visa: "Varies", travel: "Varies", other: "Varies", total: "Varies", aiAnalysis: "Verify costs.",
  budgetStatus: { label: "Needs review", description: "Compare official estimates." },
};
assert.equal(isStructuredOutput("cost", cost), true);
assert.deepEqual(getStructuredResult({ data: cost }, "data"), cost);
assert.equal(isStructuredOutput("country", { countries: [{ name: "Missing fields" }] }), false);

console.log("Structured AI contracts passed.");
