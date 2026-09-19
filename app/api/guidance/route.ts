import { NextRequest, NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase";

const fields = ["firstName", "lastName", "email", "phone", "educationLevel", "school", "country", "university", "course"] as const;
const zohoUrl = "https://forms.zohopublic.in/onewindow/form/StudyAbroadApplicationForm/formperma/jGJIp30LCf30UXhfAyzC82bep7S1ZSGZNrIfqN28bJ4";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || fields.some((field) => typeof body[field] !== "string") || !body.firstName.trim() || !body.lastName.trim() || !body.email.trim() || !body.phone.trim() || !body.educationLevel.trim()) return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.length > 320) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    const prefill = new URLSearchParams({
      Name_First: body.firstName.trim().slice(0, 100), Name_Last: body.lastName.trim().slice(0, 100), Email: body.email.trim().toLowerCase(),
      PhoneNumber: body.phone.trim().slice(0, 40), Dropdown: body.educationLevel.trim().slice(0, 80), SingleLine: body.school.trim().slice(0, 200),
      SingleLine1: body.country.trim().slice(0, 120), SingleLine2: body.university.trim().slice(0, 200), SingleLine3: body.course.trim().slice(0, 160),
    });
    return NextResponse.json({ ok: true, zohoUrl: `${zohoUrl}?${prefill}` });
  } catch (error) {
    console.error(JSON.stringify({ event: "guidance_submission_failed", code: error instanceof Error ? error.message : "unknown" }));
    const { error: backupError } = await createAdminSupabase().from("future_atlas_guidance_submissions").insert({
      first_name: body.firstName.trim().slice(0, 100), last_name: body.lastName.trim().slice(0, 100), email: body.email.trim().toLowerCase(), phone: body.phone.trim().slice(0, 40), education_level: body.educationLevel.trim().slice(0, 80), school: body.school.trim().slice(0, 200), country: body.country.trim().slice(0, 120), university: body.university.trim().slice(0, 200), course: body.course.trim().slice(0, 160),
    });
    if (backupError) console.error(JSON.stringify({ event: "guidance_backup_failed", code: backupError.message }));
    return NextResponse.json({ error: "We could not submit your application. Please try again." }, { status: 503 });
  }
}
