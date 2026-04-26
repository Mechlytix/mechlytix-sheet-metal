import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "Mechlytix — Sheet Metal Engineering Tools",
  description:
    "Upload a STEP or DXF file and get instant sheet metal quotes, 3D visualization, flat patterns, and scrap tracking — all in your browser. Powered by OpenCASCADE.",
  openGraph: {
    title: "Mechlytix — Sheet Metal Engineering Tools",
    description:
      "Instant sheet metal quoting, 3D unfold visualization, and scrap rack management. No downloads, no plugins.",
    type: "website",
  },
};

export default function MarketingPage() {
  return <LandingClient />;
}
