"use client";

import React, { useMemo, useState } from "react";
import type {
  NestingResult,
  SheetLayout,
  SheetPlacement,
  RemnantCandidate,
  FileNestingResult,
  TierNestingResult,
  NestingMode,
} from "@/lib/pricing/types";

// ─────────────────────────────────────────────────────────────
// NestingPreview — Pure canvas component
// All controls (algorithm, mode, tier, sheet size, kerf…) live
// in the right drawer. This component only renders the SVG and
// the overlay chrome (sheet tabs, utilisation bar, stats strip).
// ─────────────────────────────────────────────────────────────

interface NestingPreviewProps {
  tierResults: TierNestingResult[];
  selectedTierQty: number | null;
  nestingMode: NestingMode;
  onSaveLeftover?: (width: number, height: number) => void;
}

// ─── Colour Helpers ──────────────────────────────────────

function utilisationColor(pct: number): string {
  if (pct >= 80) return "var(--color-green, #22c55e)";
  if (pct >= 60) return "var(--color-amber, #f59e0b)";
  return "var(--color-red, #ef4444)";
}

function utilisationClass(pct: number): string {
  if (pct >= 80) return "nest-util-green";
  if (pct >= 60) return "nest-util-amber";
  return "nest-util-red";
}

const PART_PALETTE = [
  { fill: "rgba(255,102,0,0.22)",   stroke: "rgba(255,102,0,0.85)" },
  { fill: "rgba(59,130,246,0.22)",  stroke: "rgba(59,130,246,0.85)" },
  { fill: "rgba(34,197,94,0.22)",   stroke: "rgba(34,197,94,0.85)" },
  { fill: "rgba(168,85,247,0.22)",  stroke: "rgba(168,85,247,0.85)" },
  { fill: "rgba(239,68,68,0.22)",   stroke: "rgba(239,68,68,0.85)" },
  { fill: "rgba(234,179,8,0.22)",   stroke: "rgba(234,179,8,0.85)" },
  { fill: "rgba(20,184,166,0.22)",  stroke: "rgba(20,184,166,0.85)" },
  { fill: "rgba(236,72,153,0.22)",  stroke: "rgba(236,72,153,0.85)" },
];

// ─── Placed Part ─────────────────────────────────────────

function PlacedPart({ p, colorIdx, isHovered, strokeW, onMouseEnter, onMouseLeave }: {
  p: SheetPlacement;
  colorIdx: number;
  isHovered: boolean;
  strokeW: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const color = PART_PALETTE[colorIdx % PART_PALETTE.length];
  const svgMinX = p.svgMinX ?? 0;
  const svgMinY = p.svgMinY ?? 0;
  const hasPaths = p.svgPaths && p.svgPaths.length > 0;
  const partH = p.originalHeight;
  const pathTransform = `translate(0, ${partH}) scale(1, -1) translate(${-svgMinX}, ${-svgMinY})`;

  return (
    <g
      transform={`translate(${p.x}, ${p.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={0} y={0} width={p.width} height={p.height}
        fill={isHovered ? color.fill.replace("0.22", "0.42") : color.fill}
        stroke={isHovered ? color.stroke : color.stroke.replace("0.85", "0.5")}
        strokeWidth={isHovered ? strokeW * 2.5 : strokeW * 1.2}
        rx={strokeW * 0.5}
        style={{ transition: "fill 0.1s, stroke 0.1s, stroke-width 0.1s" }}
      />
      {hasPaths && (
        <clipPath id={`clip-${p.partId}-${Math.round(p.x)}-${Math.round(p.y)}`}>
          <rect x={0} y={0} width={p.width} height={p.height} />
        </clipPath>
      )}
      {hasPaths && (
        <g clipPath={`url(#clip-${p.partId}-${Math.round(p.x)}-${Math.round(p.y)})`}>
          <g transform={pathTransform}>
            {p.svgPaths!.map((d, si) => (
              <path key={si} d={d} fill="none"
                stroke={isHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)"}
                strokeWidth={strokeW * 0.8} strokeLinecap="round" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </g>
      )}
      {p.rotated && (
        <circle cx={p.width - strokeW * 4} cy={strokeW * 4} r={strokeW * 2.5}
          fill={color.stroke} opacity={0.8} />
      )}
      <text x={p.width / 2} y={p.height / 2}
        fontSize={Math.min(strokeW * 8, p.height * 0.28, p.width * 0.28)}
        fill="rgba(255,255,255,0.45)" textAnchor="middle" dominantBaseline="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}>
        {p.filename.replace(/\.[^.]+$/, "").substring(0, 12)}
      </text>
    </g>
  );
}

// ─── Sheet SVG ───────────────────────────────────────────

function SheetSVG({ layout, activePartId, onPartHover }: {
  layout: SheetLayout;
  activePartId: string | null;
  onPartHover: (id: string | null) => void;
}) {
  const { sheetWidth, sheetHeight, placements } = layout;
  const pad = Math.max(sheetWidth, sheetHeight) * 0.05;
  const vbW = sheetWidth + pad * 2, vbH = sheetHeight + pad * 2;
  const strokeW = Math.max(sheetWidth, sheetHeight) / 600;
  const gridSize = Math.max(sheetWidth, sheetHeight) / 12;
  const gridId = `nest-grid-${layout.index}-${sheetWidth}-${sheetHeight}`;

  const partColorIdx = useMemo(() => {
    const ids = [...new Set(placements.map(p => p.partId))];
    const map: Record<string, number> = {};
    ids.forEach((id, i) => { map[id] = i; });
    return map;
  }, [placements]);

  return (
    <svg viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      className="nest-sheet-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id={gridId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <line x1={0} y1={0} x2={gridSize} y2={0} stroke="rgba(255,255,255,0.035)" strokeWidth={strokeW * 0.4} />
          <line x1={0} y1={0} x2={0} y2={gridSize} stroke="rgba(255,255,255,0.035)" strokeWidth={strokeW * 0.4} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={sheetWidth} height={sheetHeight}
        fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.2)" strokeWidth={strokeW * 1.5} />
      <rect x={0} y={0} width={sheetWidth} height={sheetHeight} fill={`url(#${gridId})`} />
      {placements.map((p, i) => (
        <PlacedPart key={`${p.partId}-${i}`} p={p}
          colorIdx={partColorIdx[p.partId] ?? 0}
          isHovered={activePartId === p.partId}
          strokeW={strokeW}
          onMouseEnter={() => onPartHover(p.partId)}
          onMouseLeave={() => onPartHover(null)}
        />
      ))}
      {/* Dimension labels */}
      <text x={sheetWidth / 2} y={-pad * 0.4} fontSize={strokeW * 8}
        fill="rgba(255,255,255,0.35)" textAnchor="middle" dominantBaseline="auto">
        {sheetWidth.toFixed(0)}mm
      </text>
      <text x={-pad * 0.4} y={sheetHeight / 2} fontSize={strokeW * 8}
        fill="rgba(255,255,255,0.35)" textAnchor="middle" dominantBaseline="middle"
        transform={`rotate(-90, ${-pad * 0.4}, ${sheetHeight / 2})`}>
        {sheetHeight.toFixed(0)}mm
      </text>
    </svg>
  );
}

// ─── Remnant card ────────────────────────────────────────

function RemnantSuggestion({ candidate }: { candidate: RemnantCandidate }) {
  return (
    <div className="nest-remnant-card">
      <div className="nest-remnant-icon">♻️</div>
      <div className="nest-remnant-info">
        <span className="nest-remnant-title">Scrap Rack — {candidate.materialName}</span>
        <span className="nest-remnant-dims">{candidate.width} × {candidate.height}mm
          {candidate.location && <> · 📍 {candidate.location}</>}
        </span>
        <span className="nest-remnant-fit">
          Fits <strong>{candidate.partsFit}</strong> part{candidate.partsFit !== 1 ? "s" : ""}
          {candidate.savingsEstimate > 0 && <> · Save <strong>£{candidate.savingsEstimate.toFixed(2)}</strong></>}
        </span>
      </div>
    </div>
  );
}

// ─── Single result viewer ────────────────────────────────

function ResultViewer({ result, label, onSaveLeftover }: { result: NestingResult; label?: string; onSaveLeftover?: (w: number, h: number) => void }) {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

  if (result.sheets.length === 0) return null;
  const safeIdx = Math.min(activeSheetIdx, result.sheets.length - 1);
  const activeSheet = result.sheets[safeIdx];

  const maxX = activeSheet.placements.reduce((max, p) => Math.max(max, p.x + p.width), 0);
  const remWidth = Math.round(activeSheet.sheetWidth - maxX);
  const remHeight = Math.round(activeSheet.sheetHeight);
  const canSaveRemnant = remWidth >= 100;

  return (
    <div className="nest-result-viewer">
      {label && <div className="nest-file-label">{label}</div>}

      {/* Canvas */}
      <div className="nest-svg-container">
        <SheetSVG layout={activeSheet} activePartId={hoveredPartId} onPartHover={setHoveredPartId} />

        {/* Overlay: utilisation bar at bottom of canvas */}
        <div className="nest-canvas-overlay">
          <div className="nest-canvas-util-bar">
            <div className="nest-canvas-util-fill"
              style={{ width: `${activeSheet.utilisation}%`, background: utilisationColor(activeSheet.utilisation) }} />
          </div>
          <span className={`nest-canvas-util-label ${utilisationClass(activeSheet.utilisation)}`}>
            {activeSheet.placements.length} part{activeSheet.placements.length !== 1 ? "s" : ""} · {activeSheet.utilisation}% utilised
            {canSaveRemnant && onSaveLeftover && (
              <button
                onClick={() => onSaveLeftover(remWidth, remHeight)}
                style={{
                  marginLeft: "12px",
                  background: "rgba(255,102,0,0.15)",
                  border: "1px solid rgba(255,102,0,0.4)",
                  color: "#ff6600",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,102,0,0.25)";
                  e.currentTarget.style.borderColor = "#ff6600";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,102,0,0.15)";
                  e.currentTarget.style.borderColor = "rgba(255,102,0,0.4)";
                }}
              >
                ♻️ Save Leftover ({remWidth} × {remHeight}mm)
              </button>
            )}
          </span>

          {/* Sheet navigation pills */}
          {result.sheets.length > 1 && (
            <div className="nest-canvas-sheet-pills">
              {result.sheets.map((s, i) => (
                <button key={i}
                  className={`nest-canvas-sheet-pill ${safeIdx === i ? "active" : ""}`}
                  onClick={() => setActiveSheetIdx(i)}
                  style={safeIdx === i ? { borderColor: utilisationColor(s.utilisation) } : undefined}
                >
                  {i + 1}
                  <span className="nest-pill-util" style={{ color: utilisationColor(s.utilisation) }}>
                    {s.utilisation}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remnants */}
      {result.remnantCandidates.length > 0 && (
        <div className="nest-remnants-section">
          <p className="nest-remnants-title">💡 Scrap Rack Matches ({result.remnantCandidates.length})</p>
          {result.remnantCandidates.slice(0, 2).map(c => (
            <RemnantSuggestion key={c.id} candidate={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function NestingPreview({ tierResults, selectedTierQty, nestingMode, onSaveLeftover }: NestingPreviewProps) {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const activeTier = tierResults.find(t => t.quantity === selectedTierQty) ?? tierResults[0] ?? null;
  const combinedResult = activeTier?.combined ?? null;
  const perFileResults: FileNestingResult[] = activeTier?.perFile ?? [];
  const resolvedFileId = activeFileId ?? perFileResults[0]?.itemId ?? null;
  const activeFileResult = perFileResults.find(f => f.itemId === resolvedFileId) ?? perFileResults[0] ?? null;

  const hasData = nestingMode === "combined"
    ? combinedResult && combinedResult.sheets.length > 0
    : perFileResults.length > 0;

  if (!hasData) {
    return (
      <div className="nest-empty">
        <div className="nest-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" />
          </svg>
        </div>
        <p className="nest-empty-title">Select a sheet size to calculate nesting</p>
        <p className="nest-empty-sub">Choose material, thickness and sheet size in the Nesting panel →</p>
      </div>
    );
  }

  if (nestingMode === "combined" && combinedResult) {
    return <ResultViewer result={combinedResult} onSaveLeftover={onSaveLeftover} />;
  }

  if (nestingMode === "individual" && perFileResults.length > 0) {
    return (
      <div className="nest-individual-wrapper">
        {perFileResults.length > 1 && (
          <div className="nest-file-tabs">
            {perFileResults.map(f => (
              <button key={f.itemId}
                className={`nest-file-tab ${resolvedFileId === f.itemId ? "active" : ""}`}
                onClick={() => setActiveFileId(f.itemId)}>
                <span className="nest-file-tab-name">{f.filename.replace(/\.[^.]+$/, "")}</span>
                <span className="nest-file-tab-sheets">{f.result.totalSheets} sh</span>
              </button>
            ))}
          </div>
        )}
        {activeFileResult && <ResultViewer result={activeFileResult.result} label={activeFileResult.filename} onSaveLeftover={onSaveLeftover} />}
      </div>
    );
  }

  return null;
}
