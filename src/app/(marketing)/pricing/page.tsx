import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Mechlytix",
  description:
    "Simple, transparent pricing for sheet metal engineering tools. Start free, upgrade when you need to.",
};

export default function PricingPage() {
  return <PricingClient />;
}
