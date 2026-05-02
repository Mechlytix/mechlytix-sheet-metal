import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { EditCustomerClient } from "./EditCustomerClient";
import type { Metadata } from "next";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("name").eq("id", id).single();
  return { title: data ? `Edit ${data.name} | Mechlytix` : "Edit Customer | Mechlytix" };
}

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!customer) notFound();

  return <EditCustomerClient customer={customer} />;
}
