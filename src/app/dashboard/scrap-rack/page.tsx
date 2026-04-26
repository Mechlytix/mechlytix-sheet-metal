import Link from "next/link";

// Scrap Rack page — Phase 3 placeholder

export default function ScrapRackPage() {
  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <h1 className="dash-page-title">Digital Scrap Rack</h1>
        <span className="coming-soon-badge">Phase 3</span>
      </div>
      <div className="coming-soon-card">
        <div className="cs-icon">♻️</div>
        <h2>Stop Throwing Away Profit</h2>
        <p>Track every offcut and remnant. Scan QR codes on the shop floor to find and reuse material instantly.</p>
        <ul className="cs-feature-list">
          <li>✦ Log remnants with dimensions, material, and location</li>
          <li>✦ Auto-generate printable QR code labels</li>
          <li>✦ Scan with any smartphone — no app needed</li>
          <li>✦ Quoter automatically checks remnants before costing a full sheet</li>
          <li>✦ Track scrap value vs. material cost</li>
          <li>✦ &quot;Found-via-scan&quot; — anyone can scan to verify material grade</li>
        </ul>
        <p className="cs-hint">
          Based on a 15% scrap rate on £400k material spend, recovering just 5% adds{" "}
          <strong>£20k/year</strong> to your bottom line.
        </p>
        <p className="cs-hint">
          Set up your <Link href="/dashboard/materials">materials</Link> first — the scrap rack uses them for alloy identification and valuation.
        </p>
      </div>
    </div>
  );
}
