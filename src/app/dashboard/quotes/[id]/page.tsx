import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { parseDXFGeometry } from "@/lib/dxf/parse-dxf";
import { QuoteDetailClient } from "@/components/QuoteDetailClient";
import type { Metadata } from "next";
import type { PricingGeometry } from "@/lib/pricing/types";

// ─────────────────────────────────────────────────────────
// /dashboard/quotes/[id] — Quote Detail (Server wrapper)
// ─────────────────────────────────────────────────────────

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Quote — Mechlytix` };
}

export default async function QuoteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(`
      *,
      materials ( id, name, grade, category, color_hex, cost_per_kg, density_kg_m3, scrap_value_per_kg ),
      machine_profiles:machine_id ( id, name, machine_type, hourly_rate, power_kw, feed_rates, pierce_time_seconds, setup_time_minutes, cost_per_bend ),
      quote_attachments ( id, filename, created_at, uploads ( storage_path, file_size_bytes ) ),
      uploads:upload_id ( storage_path )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !quote) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("brand_color")
    .eq("user_id", user.id)
    .maybeSingle();

  const brandColor = settings?.brand_color ?? '#ff6600';

  // Fetch linked customer (with company_name)
  const customerId = (quote as Record<string, unknown>).customer_id as string | null;
  let customer = null;
  if (customerId) {
    const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
    customer = c;
  }

  // Fetch all materials & machines for edit dropdowns
  const { data: materials } = await supabase
    .from("materials")
    .select("id, name, grade, category, color_hex, cost_per_kg, density_kg_m3, scrap_value_per_kg")
    .or(`user_id.eq.${user.id},is_system.eq.true`)
    .eq("is_active", true)
    .order("name");

  const { data: machines } = await supabase
    .from("machine_profiles")
    .select("id, name, machine_type, hourly_rate, power_kw, feed_rates, pierce_time_seconds, setup_time_minutes, cost_per_bend")
    .or(`user_id.eq.${user.id},is_system.eq.true`)
    .order("name");

  const createdDate = quote.created_at
    ? new Date(quote.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const expiresDate = quote.expires_at
    ? new Date(quote.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Fetch all quotes in the same batch if grouped
  let batchQuotes = [quote];
  if (quote.group_id) {
    const { data: batch } = await supabase
      .from("quotes")
      .select(`
        *,
        materials ( id, name, grade, category, color_hex, cost_per_kg, density_kg_m3, scrap_value_per_kg ),
        machine_profiles:machine_id ( id, name, machine_type, hourly_rate, power_kw, feed_rates, pierce_time_seconds, setup_time_minutes, cost_per_bend ),
        uploads:upload_id ( storage_path )
      `)
      .eq("group_id", quote.group_id)
      .order("created_at", { ascending: true });
    if (batch && batch.length > 0) batchQuotes = batch;
  }

  // Fetch DXF previews for ALL batch quotes (not just the primary)
  const dxfPreviews: Record<string, PricingGeometry> = {};
  for (const bq of batchQuotes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bqAny = bq as any;
    if (bqAny.input_type === "dxf" && bqAny.uploads?.storage_path) {
      try {
        const { data: fileData } = await supabase.storage
          .from("step-files")
          .download(bqAny.uploads.storage_path);
        if (fileData) {
          const text = await fileData.text();
          const geo = parseDXFGeometry(text);
          dxfPreviews[bqAny.id] = geo;
        }
      } catch {
        // Skip if download fails
      }
    }
  }

  return (
    <QuoteDetailClient
      quote={quote}
      batchQuotes={batchQuotes}
      customer={customer}
      profile={profile}
      brandColor={brandColor}
      userId={user.id}
      createdDate={createdDate}
      expiresDate={expiresDate}
      dxfPreviews={dxfPreviews}
      materials={materials ?? []}
      machines={machines ?? []}
    />
  );
}
