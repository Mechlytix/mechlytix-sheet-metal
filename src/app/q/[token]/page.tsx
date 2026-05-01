import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CustomerQuoteView } from "@/components/CustomerQuoteView";

// ─────────────────────────────────────────────────────────
// /q/[token] — Public customer-facing quote share page
// No auth. Token must match a quote with share_enabled=true.
// ─────────────────────────────────────────────────────────

interface Props { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Your Quote — Mechlytix",
    description: "Your sheet metal fabrication quote, powered by Mechlytix.",
    robots: { index: false }, // don't index share links
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "#6b7280" },
  sent:     { label: "Sent",     color: "#60a5fa" },
  accepted: { label: "Accepted", color: "#4ade80" },
  rejected: { label: "Rejected", color: "#f87171" },
  expired:  { label: "Expired",  color: "#9ca3af" },
};

function row(label: string, value: string | null | undefined) {
  if (!value) return null;
  return { label, value };
}

export default async function QuoteSharePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(`
      id, filename, input_type, status, user_id,
      bounding_width_mm, bounding_height_mm, thickness_mm,
      perimeter_mm, pierce_count, bend_count, part_area_mm2,
      quantity, unit_price, total_price, markup_percent,
      customer_name, customer_email, customer_ref, notes, expires_at, created_at,
      materials ( name, grade, category, color_hex ),
      machine_profiles:machine_id ( name )
    `)
    .eq("share_token", token)
    .eq("share_enabled", true)
    .single();

  if (error || !quote) notFound();

  // Load the shop's branding profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopUserId = (quote as any).user_id as string | null;
  const { data: shopProfile } = shopUserId
    ? await supabase
        .from("profiles")
        .select("company, logo_url, phone, website, address_line1, address_line2")
        .eq("id", shopUserId)
        .single()
    : { data: null };

  const shopName    = shopProfile?.company ?? "Mechlytix";
  const shopLogoUrl = shopProfile?.logo_url;
  const shopPhone   = shopProfile?.phone;
  const shopWebsite = shopProfile?.website;
  const shopAddr1   = shopProfile?.address_line1;
  const shopAddr2   = shopProfile?.address_line2;

  return <CustomerQuoteView quote={quote} shopProfile={shopProfile} displayToken={token.slice(0, 8).toUpperCase()} />;
}
