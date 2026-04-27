import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────
// POST /pricing/waitlist — Inserts email into waitlist table
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("waitlist_submissions")
      .insert({ email });

    // Treat duplicate inserts as success (idempotent)
    if (error && !error.message.includes("duplicate")) {
      console.error("Waitlist insert error:", error);
      return NextResponse.json({ error: "Failed to save." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
