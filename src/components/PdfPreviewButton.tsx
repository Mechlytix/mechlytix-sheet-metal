"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { QuotePdfDocument } from "./QuotePdfDocument";

// We dynamically import BlobProvider to prevent SSR issues with react-pdf
const BlobProvider = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.BlobProvider),
  { ssr: false, loading: () => <button className="btn-secondary" disabled style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "600", fontSize: "14px" }}>Loading...</button> }
);

interface PdfPreviewButtonProps {
  quote: any;
  profile: any;
  mat: any;
  mach: any;
}

export function PdfPreviewButton({ quote, profile, mat, mach }: PdfPreviewButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <button className="btn-secondary" disabled style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "600", fontSize: "14px" }}>Loading...</button>;
  }

  return (
    <BlobProvider document={<QuotePdfDocument quote={quote} profile={profile} mat={mat} mach={mach} />}>
      {({ url, loading, error }) => {
        if (loading) {
          return <button className="btn-secondary" disabled style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "600", fontSize: "14px" }}>Loading PDF...</button>;
        }
        if (error) {
          return <button className="btn-secondary" disabled style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "600", fontSize: "14px" }}>Error</button>;
        }
        return (
          <a
            href={url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: "8px 16px", borderRadius: "8px", fontWeight: "600", fontSize: "14px" }}
          >
            👁 Preview Quote
          </a>
        );
      }}
    </BlobProvider>
  );
}
