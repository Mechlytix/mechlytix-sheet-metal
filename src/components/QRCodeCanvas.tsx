"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

// ─────────────────────────────────────────────────────────
// QRCodeCanvas — renders a QR code onto an HTML canvas
// ─────────────────────────────────────────────────────────

interface QRCodeCanvasProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  margin?: number;
}

export function QRCodeCanvas({
  value,
  size = 200,
  bgColor = "#ffffff",
  fgColor = "#111111",
  margin = 1,
}: QRCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin,
      color: { dark: fgColor, light: bgColor },
      errorCorrectionLevel: "M",
    }).catch(console.error);
  }, [value, size, bgColor, fgColor, margin]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", borderRadius: 4 }}
    />
  );
}

/** Generate a QR code as a data URL (for print / img src) */
export async function generateQRDataURL(value: string, size = 300): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 1,
    color: { dark: "#111111", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

/** Build the public scan URL for a remnant */
export function buildScanUrl(remnantId: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/scan/${remnantId}`;
}
