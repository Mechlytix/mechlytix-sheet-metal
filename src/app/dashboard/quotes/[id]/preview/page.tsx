import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CustomerQuoteView } from "@/components/CustomerQuoteView";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: "Quote Preview — Mechlytix",
    robots: { index: false },
  };
}

export default async function QuotePreviewPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) notFound();

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
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !quote) notFound();

  const { data: shopProfile } = await supabase
    .from("profiles")
    .select("company, logo_url, phone, website, address_line1, address_line2")
    .eq("id", user.id)
    .single();

  return <CustomerQuoteView quote={quote} shopProfile={shopProfile} displayToken={id.slice(0, 8).toUpperCase()} />;
}
