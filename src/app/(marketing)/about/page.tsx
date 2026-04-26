import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About — Mechlytix",
  description:
    "Mechlytix is building the next generation of sheet metal engineering tools. Learn about our mission, technology, and team.",
};

export default function AboutPage() {
  return <AboutClient />;
}
