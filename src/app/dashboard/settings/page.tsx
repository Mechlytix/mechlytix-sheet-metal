import { redirect } from "next/navigation";

// /dashboard/settings → redirect to the first settings sub-page
export default function SettingsIndex() {
  redirect("/dashboard/settings/profile");
}
