import { NextRequest, NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase";

const fields = ["firstName", "lastName", "email", "phone", "educationLevel", "school", "country", "university", "course"] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || fields.some((field) => typeof body[field] !== "string") || !body.firstName.trim() || !body.lastName.trim() || !body.email.trim() || !body.phone.trim() || !body.educationLevel.trim()) return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.length > 320) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    const { error } = await createAdminSupabase().from("future_atlas_guidance_submissions").insert({
      first_name: body.firstName.trim().slice(0, 100), last_name: body.lastName.trim().slice(0, 100), email: body.email.trim().toLowerCase(), phone: body.phone.trim().slice(0, 40), education_level: body.educationLevel.trim().slice(0, 80), school: body.school.trim().slice(0, 200), country: body.country.trim().slice(0, 120), university: body.university.trim().slice(0, 200), course: body.course.trim().slice(0, 160),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({ event: "guidance_submission_failed", code: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "We could not submit your application. Please try again." }, { status: 503 });
  }
}
