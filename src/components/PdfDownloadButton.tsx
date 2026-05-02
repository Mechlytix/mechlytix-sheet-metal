"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { QuotePdfDocument } from "./QuotePdfDocument";

// We dynamically import PDFDownloadLink to prevent SSR issues with react-pdf
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <button className="btn-ghost" disabled>Loading PDF...</button> }
);

interface PdfDownloadButtonProps {
  quote: any;
  profile: any;
  mat: any;
  mach: any;
  brandColor?: string;
  customer?: any;
}

export function PdfDownloadButton({ quote, profile, mat, mach, brandColor, customer }: PdfDownloadButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <button className="btn-ghost" disabled>Loading PDF...</button>;
  }

  const ref = quote.quote_number || quote.id.slice(0, 8).toUpperCase();

  return (
    <PDFDownloadLink
      document={<QuotePdfDocument quote={quote} profile={profile} mat={mat} mach={mach} brandColor={brandColor} customer={customer} />}
      fileName={`Quote-${ref}-${quote.filename}.pdf`}
      className="btn-ghost"
    >
      {({ loading }) =>
        loading ? "Generating PDF..." : "📥 Download PDF"
      }
    </PDFDownloadLink>
  );
}
