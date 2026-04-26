import type { Metadata } from "next";
import FeaturesClient from "./FeaturesClient";

export const metadata: Metadata = {
  title: "Features — Mechlytix",
  description:
    "Explore Mechlytix capabilities: 3D STEP visualization, animated unfold, instant quoting, scrap rack tracking, material management, and more.",
};

export default function FeaturesPage() {
  return <FeaturesClient />;
}
