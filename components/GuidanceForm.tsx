"use client";

import { useState, type FormEvent, type ReactNode } from "react";

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  currentEducation: string;
  schoolCollege: string;
  preferredCountry: string;
  preferredUniversity: string;
  preferredCourse: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  currentEducation: "",
  schoolCollege: "",
  preferredCountry: "",
  preferredUniversity: "",
  preferredCourse: "",
};

const educationOptions = ["School", "College", "Undergraduate", "Postgraduate", "Other"];
const zohoFormUrl = "https://forms.zohopublic.in/onewindow/form/StudyAbroadApplicationForm/formperma/jGJIp30LCf30UXhfAyzC82bep7S1ZSGZNrIfqN28bJ4";

export default function GuidanceForm() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAllEducationOptions, setShowAllEducationOptions] = useState(false);
  const visibleEducationOptions = showAllEducationOptions
    ? educationOptions
    : [...educationOptions.slice(0, 4), "__more__"];

  const updateValue = (name: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setIsSubmitted(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const nextErrors: FormErrors = {};
    if (!values.firstName.trim()) nextErrors.firstName = "Enter your first name.";
    if (!values.lastName.trim()) nextErrors.lastName = "Enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = "Enter a valid email address.";
    if (!/^[+\d][\d\s()-]{6,19}$/.test(values.mobile.trim())) nextErrors.mobile = "Enter a valid mobile number.";
    if (!values.currentEducation) nextErrors.currentEducation = "Select your current education level.";
    if (!values.schoolCollege.trim()) nextErrors.schoolCollege = "Enter your school or college name.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.preventDefault();
      return;
    }

    setIsSubmitted(true);
  };

  return (
    <form action={zohoFormUrl} method="post" target="zoho-guidance-submit" onSubmit={handleSubmit} noValidate className="space-y-5">
      <input type="hidden" name="formName" value="StudyAbroadApplicationForm" />
      <input type="hidden" name="formPerma" value="jGJIp30LCf30UXhfAyzC82bep7S1ZSGZNrIfqN28bJ4" />
      <input type="hidden" name="isPaymentForm" value="false" />
      <input type="hidden" name="formType" value="0" />
      <input type="hidden" name="isDocsPublicForm" value="false" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First Name" required error={errors.firstName}>
          <Input name="Name_First" value={values.firstName} onChange={(value) => updateValue("firstName", value)} autoComplete="given-name" />
        </Field>
        <Field label="Last Name" required error={errors.lastName}>
          <Input name="Name_Last" value={values.lastName} onChange={(value) => updateValue("lastName", value)} autoComplete="family-name" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email Address" required error={errors.email}>
          <Input name="Email" type="email" value={values.email} onChange={(value) => updateValue("email", value)} autoComplete="email" />
        </Field>
        <Field label="Mobile Number" required error={errors.mobile}>
          <Input name="PhoneNumber" type="tel" value={values.mobile} onChange={(value) => updateValue("mobile", value)} autoComplete="tel" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Current Education Level" required error={errors.currentEducation}>
          <select
            value={values.currentEducation}
            onChange={(event) => {
              if (event.target.value === "__more__") {
                setShowAllEducationOptions(true);
                return;
              }
              updateValue("currentEducation", event.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            name="Dropdown"
            required
          >
            <option value="">Select your current education level</option>
            {visibleEducationOptions.map((option) => (
              <option key={option} value={option}>
                {option === "__more__" ? "More" : option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="School / College Name" required error={errors.schoolCollege}>
          <Input name="SingleLine" value={values.schoolCollege} onChange={(value) => updateValue("schoolCollege", value)} autoComplete="organization" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Preferred Country">
          <Input name="SingleLine1" value={values.preferredCountry} onChange={(value) => updateValue("preferredCountry", value)} />
        </Field>
        <Field label="Preferred University">
          <Input name="SingleLine2" value={values.preferredUniversity} onChange={(value) => updateValue("preferredUniversity", value)} />
        </Field>
        <Field label="Preferred Course">
          <Input name="SingleLine3" value={values.preferredCourse} onChange={(value) => updateValue("preferredCourse", value)} />
        </Field>
      </div>

      <button type="submit" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
        Submit Application
      </button>

      {isSubmitted && (
        <p className="text-sm font-medium text-emerald-700" role="status">
          Thank you. Your application details are ready.
        </p>
      )}
      <iframe className="hidden" name="zoho-guidance-submit" title="Application submission response" />
    </form>
  );
}

function Input({ name, value, onChange, type = "text", autoComplete }: { name: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      name={name}
      type={type}
      autoComplete={autoComplete}
    />
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}{required && <span className="ml-1 text-rose-500">*</span>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </label>
  );
}
