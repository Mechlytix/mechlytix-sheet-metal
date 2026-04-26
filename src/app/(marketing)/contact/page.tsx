import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact — Mechlytix",
  description:
    "Get in touch with the Mechlytix team. Whether you have a question, want a demo, or need enterprise pricing — we'd love to hear from you.",
};

export default function ContactPage() {
  return <ContactClient />;
}
