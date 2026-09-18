"use client";

import { FormEvent, useState } from "react";

const initial = { firstName: "", lastName: "", email: "", phone: "", educationLevel: "", school: "", country: "", university: "", course: "" };

export default function ZohoGuidanceForm() {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (field: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/guidance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Submission failed.");
      setForm(initial);
      setStatus("Thanks. Your study-abroad request has been received.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not submit your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" required value={form.firstName} onChange={(value) => update("firstName", value)} />
        <Field label="Last name" required value={form.lastName} onChange={(value) => update("lastName", value)} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email address" type="email" required value={form.email} onChange={(value) => update("email", value)} />
        <Field label="Mobile number" type="tel" required value={form.phone} onChange={(value) => update("phone", value)} />
      </div>
      <label className="block text-sm font-medium text-slate-700">Current education level <span className="text-rose-500">*</span>
        <select required value={form.educationLevel} onChange={(event) => update("educationLevel", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
          <option value="">Select your education level</option><option>School</option><option>College</option><option>Undergraduate</option><option>Postgraduate</option><option>Other</option>
        </select>
      </label>
      <Field label="School / college name" value={form.school} onChange={(value) => update("school", value)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Preferred country" value={form.country} onChange={(value) => update("country", value)} />
        <Field label="Preferred university" value={form.university} onChange={(value) => update("university", value)} />
      </div>
      <Field label="Preferred course" value={form.course} onChange={(value) => update("course", value)} />
      {status && <p role="status" className="text-sm text-slate-600">{status}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">{busy ? "Submitting..." : "Submit application"}</button>
    </form>
  );
}

function Field({ label, type = "text", required = false, value, onChange }: { label: string; type?: string; required?: boolean; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label} {required && <span className="text-rose-500">*</span>}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></label>;
}
