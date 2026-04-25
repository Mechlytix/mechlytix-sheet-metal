import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mechlytix — Sheet Metal Unfolder",
  description:
    "Interactive 3D sheet metal visualization. Upload a STEP file and watch it unfold to a flat pattern in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
