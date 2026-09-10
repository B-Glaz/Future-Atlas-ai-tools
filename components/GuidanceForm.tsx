"use client";

import { useState, type FormEvent, type ReactNode } from "react";

type FormValues = {
  name: string;
  email: string;
  currentEducation: string;
  expectedCountry: string;
  expectedCollege: string;
  expectedCourse: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  name: "",
  email: "",
  currentEducation: "",
  expectedCountry: "",
  expectedCollege: "",
  expectedCourse: "",
};

const educationOptions = [
  "High school",
  "Diploma",
  "Undergraduate degree",
  "Postgraduate degree",
  "Other",
];

export default function GuidanceForm() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAllEducationOptions, setShowAllEducationOptions] = useState(false);
  const visibleEducationOptions = showAllEducationOptions ? educationOptions : [...educationOptions.slice(0, 4), "__more__"];

  const updateValue = (name: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setIsSubmitted(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!values.name.trim()) nextErrors.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!values.currentEducation) {
      nextErrors.currentEducation = "Select your current education.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setIsSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <input
            value={values.name}
            onChange={(event) => updateValue("name", event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            name="name"
            type="text"
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
      </div>

      <Field label="Current Education" error={errors.currentEducation}>
        <select
          value={values.currentEducation}
          onChange={(event) => {
            if (event.target.value === "__more__") { setShowAllEducationOptions(true); return; }
            updateValue("currentEducation", event.target.value);
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          name="currentEducation"
          required
        >
          <option value="">Select your current education</option>
          {visibleEducationOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Expected Country">
          <input value={values.expectedCountry} onChange={(event) => updateValue("expectedCountry", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200" name="expectedCountry" type="text" />
        </Field>
        <Field label="Expected College">
          <input value={values.expectedCollege} onChange={(event) => updateValue("expectedCollege", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200" name="expectedCollege" type="text" />
        </Field>
        <Field label="Expected Course">
          <input value={values.expectedCourse} onChange={(event) => updateValue("expectedCourse", event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200" name="expectedCourse" type="text" />
        </Field>
      </div>

      <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
        Submit
      </button>

      {isSubmitted && (
        <p className="text-sm font-medium text-emerald-700" role="status">
          Thank you. Your guidance request has been recorded.
        </p>
      )}
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </label>
  );
}