"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { QuotePdfDocument } from "./QuotePdfDocument";

// We dynamically import BlobProvider to prevent SSR issues with react-pdf
const BlobProvider = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.BlobProvider),
  { ssr: false, loading: () => <button className="btn-ghost" disabled>Loading...</button> }
);

interface PdfPreviewButtonProps {
  quotes: any[];
  profile: any;
  brandColor?: string;
  customer?: any;
}

export function PdfPreviewButton({ quotes, profile, brandColor, customer }: PdfPreviewButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !quotes || quotes.length === 0) {
    return <button className="btn-ghost" disabled>Loading...</button>;
  }

  return (
    <BlobProvider document={<QuotePdfDocument quotes={quotes} profile={profile} brandColor={brandColor} customer={customer} />}>
      {({ url, loading, error }) => {
        if (loading) {
          return <button className="btn-ghost" disabled>Loading PDF...</button>;
        }
        if (error) {
          return <button className="btn-ghost" disabled>Error</button>;
        }
        return (
          <a
            href={url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            👁 Preview Quote
          </a>
        );
      }}
    </BlobProvider>
  );
}
