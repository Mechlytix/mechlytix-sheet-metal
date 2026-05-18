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

interface NestingPreviewProps {
  /** All tier results (used to drive tier selector) */
  tierResults: TierNestingResult[];
  /** Which tier qty is currently selected */
  selectedTierQty: number | null;
  onTierChange: (qty: number) => void;
  /** Nesting mode */
  nestingMode: NestingMode;
  onNestingModeChange: (mode: NestingMode) => void;
  /** Current kerf gap */
  kerfGapMm: number;
  onKerfChange?: (val: number) => void;
  /** Whether rotation is enabled */
  allowRotation: boolean;
  onRotationToggle?: () => void;
  /** Whether grain lock is active */
  grainLocked: boolean;
  onGrainLockToggle?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────

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
  { fill: "rgba(255,102,0,0.25)",   stroke: "rgba(255,102,0,0.9)" },
  { fill: "rgba(59,130,246,0.25)",  stroke: "rgba(59,130,246,0.9)" },
  { fill: "rgba(34,197,94,0.25)",   stroke: "rgba(34,197,94,0.9)" },
  { fill: "rgba(168,85,247,0.25)",  stroke: "rgba(168,85,247,0.9)" },
  { fill: "rgba(239,68,68,0.25)",   stroke: "rgba(239,68,68,0.9)" },
  { fill: "rgba(234,179,8,0.25)",   stroke: "rgba(234,179,8,0.9)" },
  { fill: "rgba(20,184,166,0.25)",  stroke: "rgba(20,184,166,0.9)" },
  { fill: "rgba(236,72,153,0.25)",  stroke: "rgba(236,72,153,0.9)" },
];

// ─── Placed Part SVG element ─────────────────────────────

function PlacedPart({
  p,
  colorIdx,
  isHovered,
  strokeW,
  onMouseEnter,
  onMouseLeave,
}: {
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
  const partW = p.originalWidth;
  const partH = p.originalHeight;

  // Normalise DXF coords: flip Y axis + offset to origin
  const pathTransform = `translate(0, ${partH}) scale(1, -1) translate(${-svgMinX}, ${-svgMinY})`;
  const innerTransform = p.rotated
    ? `rotate(90, ${partW / 2}, ${partH / 2}) translate(${(partW - partH) / 2}, ${(partH - partW) / 2})`
    : undefined;

  return (
    <g
      transform={`translate(${p.x}, ${p.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={0} y={0}
        width={p.width} height={p.height}
        fill={isHovered ? color.fill.replace("0.25", "0.45") : color.fill}
        stroke={isHovered ? color.stroke : color.stroke.replace("0.9", "0.55")}
        strokeWidth={isHovered ? strokeW * 2.5 : strokeW * 1.2}
        rx={strokeW * 0.5}
        style={{ transition: "fill 0.12s, stroke 0.12s, stroke-width 0.12s" }}
      />

      {hasPaths && (
        <clipPath id={`clip-${p.partId}-${Math.round(p.x)}-${Math.round(p.y)}`}>
          <rect x={0} y={0} width={p.width} height={p.height} />
        </clipPath>
      )}
      {hasPaths && (
        <g
          clipPath={`url(#clip-${p.partId}-${Math.round(p.x)}-${Math.round(p.y)})`}
          transform={innerTransform}
        >
          <g transform={pathTransform}>
            {p.svgPaths!.map((d, si) => (
              <path
                key={si}
                d={d}
                fill="none"
                stroke={isHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"}
                strokeWidth={strokeW * 0.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </g>
      )}

      {p.rotated && (
        <circle
          cx={p.width - strokeW * 4}
          cy={strokeW * 4}
          r={strokeW * 2.5}
          fill={color.stroke}
          opacity={0.8}
        />
      )}

      <text
        x={p.width / 2}
        y={p.height / 2}
        fontSize={Math.min(strokeW * 8, p.height * 0.25, p.width * 0.25)}
        fill="rgba(255,255,255,0.5)"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
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
  const pad = Math.max(sheetWidth, sheetHeight) * 0.04;
  const vbX = -pad, vbY = -pad;
  const vbW = sheetWidth + pad * 2, vbH = sheetHeight + pad * 2;

  const partColorIdx = useMemo(() => {
    const ids = [...new Set(placements.map(p => p.partId))];
    const map: Record<string, number> = {};
    ids.forEach((id, i) => { map[id] = i; });
    return map;
  }, [placements]);

  const strokeW = Math.max(sheetWidth, sheetHeight) / 600;
  const gridSize = Math.max(sheetWidth, sheetHeight) / 10;
  const gridId = `nest-grid-${layout.index}-${sheetWidth}`;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className="nest-sheet-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={gridId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <line x1={0} y1={0} x2={gridSize} y2={0} stroke="rgba(255,255,255,0.04)" strokeWidth={strokeW * 0.5} />
          <line x1={0} y1={0} x2={0} y2={gridSize} stroke="rgba(255,255,255,0.04)" strokeWidth={strokeW * 0.5} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={sheetWidth} height={sheetHeight}
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.25)" strokeWidth={strokeW * 1.5} />
      <rect x={0} y={0} width={sheetWidth} height={sheetHeight} fill={`url(#${gridId})`} />
      {placements.map((p, i) => (
        <PlacedPart
          key={`${p.partId}-${i}`}
          p={p}
          colorIdx={partColorIdx[p.partId] ?? 0}
          isHovered={activePartId === p.partId}
          strokeW={strokeW}
          onMouseEnter={() => onPartHover(p.partId)}
          onMouseLeave={() => onPartHover(null)}
        />
      ))}
      <text x={sheetWidth / 2} y={-pad * 0.45} fontSize={strokeW * 8}
        fill="rgba(255,255,255,0.4)" textAnchor="middle" dominantBaseline="auto">
        {sheetWidth.toFixed(0)}mm
      </text>
      <text x={-pad * 0.45} y={sheetHeight / 2} fontSize={strokeW * 8}
        fill="rgba(255,255,255,0.4)" textAnchor="middle" dominantBaseline="middle"
        transform={`rotate(-90, ${-pad * 0.45}, ${sheetHeight / 2})`}>
        {sheetHeight.toFixed(0)}mm
      </text>
    </svg>
  );
}

// ─── Remnant Card ────────────────────────────────────────

function RemnantSuggestion({ candidate }: { candidate: RemnantCandidate }) {
  return (
    <div className="nest-remnant-card">
      <div className="nest-remnant-icon">♻️</div>
      <div className="nest-remnant-info">
        <span className="nest-remnant-title">Scrap Rack Match — {candidate.materialName}</span>
        <span className="nest-remnant-dims">
          {candidate.width} × {candidate.height}mm
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

// ─── Single NestingResult Viewer ─────────────────────────

function ResultViewer({ result, label }: { result: NestingResult; label?: string }) {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

  const safeIdx = Math.min(activeSheetIdx, result.sheets.length - 1);
  const activeSheet = result.sheets[safeIdx];

  return (
    <div className="nest-result-viewer">
      {label && <div className="nest-file-label">{label}</div>}

      {/* Utilisation bar */}
      <div className="nest-util-bar-wrap">
        <div className="nest-util-bar">
          <div
            className="nest-util-fill"
            style={{ width: `${activeSheet.utilisation}%`, background: utilisationColor(activeSheet.utilisation) }}
          />
        </div>
        <span className="nest-util-label">
          {activeSheet.placements.length} part{activeSheet.placements.length !== 1 ? "s" : ""} on this sheet · {activeSheet.utilisation}% utilised
        </span>
      </div>

      {/* Sheet tabs */}
      {result.sheets.length > 1 && (
        <div className="nest-sheet-tabs">
          {result.sheets.map((s, i) => (
            <button
              key={i}
              className={`nest-sheet-tab ${safeIdx === i ? "active" : ""}`}
              onClick={() => setActiveSheetIdx(i)}
            >
              <span className="nest-tab-label">Sheet {i + 1}</span>
              <span className="nest-tab-util" style={{ color: utilisationColor(s.utilisation) }}>
                {s.utilisation}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* SVG canvas */}
      <div className="nest-svg-container">
        <SheetSVG
          layout={activeSheet}
          activePartId={hoveredPartId}
          onPartHover={setHoveredPartId}
        />
      </div>

      {/* Remnant suggestions */}
      {result.remnantCandidates.length > 0 && (
        <div className="nest-remnants-section">
          <p className="nest-remnants-title">💡 Scrap Rack Matches ({result.remnantCandidates.length})</p>
          {result.remnantCandidates.slice(0, 3).map((c) => (
            <RemnantSuggestion key={c.id} candidate={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function NestingPreview({
  tierResults,
  selectedTierQty,
  onTierChange,
  nestingMode,
  onNestingModeChange,
  kerfGapMm,
  onKerfChange,
  allowRotation,
  onRotationToggle,
  grainLocked,
  onGrainLockToggle,
}: NestingPreviewProps) {
  // Individual mode: which file is being viewed
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const activeTier = tierResults.find(t => t.quantity === selectedTierQty) ?? tierResults[0] ?? null;

  // Resolve what to render
  const combinedResult = activeTier?.combined ?? null;
  const perFileResults: FileNestingResult[] = activeTier?.perFile ?? [];

  // Auto-select first file in individual mode
  const resolvedFileId = activeFileId ?? perFileResults[0]?.itemId ?? null;
  const activeFileResult = perFileResults.find(f => f.itemId === resolvedFileId) ?? perFileResults[0] ?? null;

  const hasData = nestingMode === "combined"
    ? combinedResult && combinedResult.sheets.length > 0
    : perFileResults.length > 0;

  // Stats for the controls bar summary
  const summarySheets = nestingMode === "combined"
    ? combinedResult?.totalSheets ?? 0
    : perFileResults.reduce((s, f) => s + f.result.totalSheets, 0);
  const summaryParts = nestingMode === "combined"
    ? combinedResult?.sheets.reduce((s, sh) => s + sh.placements.length, 0) ?? 0
    : perFileResults.reduce((s, f) => s + f.result.sheets.reduce((ss, sh) => ss + sh.placements.length, 0), 0);

  return (
    <div className="nest-preview">

      {/* ── Controls ── */}
      <div className="nest-controls">
        <div className="nest-control-group">
          <label className="nest-control-label">Kerf Gap</label>
          <div className="nest-control-input-wrap">
            <input
              type="number"
              className="nest-control-input"
              value={kerfGapMm}
              onChange={(e) => onKerfChange?.(Math.max(0, parseFloat(e.target.value) || 0))}
              step={0.5} min={0} max={20}
            />
            <span className="nest-control-unit">mm</span>
          </div>
        </div>

        <button
          className={`nest-toggle-btn ${allowRotation ? "active" : ""}`}
          onClick={onRotationToggle}
          title="Allow 90° rotation"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="22 2 22 8 16 8" />
          </svg>
          Rotation
        </button>

        <button
          className={`nest-toggle-btn ${grainLocked ? "active warn" : ""}`}
          onClick={onGrainLockToggle}
          title="Lock grain direction"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Grain Lock
        </button>

        {hasData && (
          <span className="nest-summary-pill">
            {summaryParts} piece{summaryParts !== 1 ? "s" : ""} · {summarySheets} sheet{summarySheets !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── No data state ── */}
      {!hasData && (
        <div className="nest-empty">
          <div className="nest-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" />
            </svg>
          </div>
          <p className="nest-empty-title">No nesting data</p>
          <p className="nest-empty-sub">Select a sheet size in the right panel to calculate nesting layout</p>
        </div>
      )}

      {/* ── Stats strip ── */}
      {hasData && nestingMode === "combined" && combinedResult && (
        <div className="nest-stats">
          <div className="nest-stat">
            <span className="nest-stat-value">{combinedResult.totalSheets}</span>
            <span className="nest-stat-label">Sheet{combinedResult.totalSheets !== 1 ? "s" : ""}</span>
          </div>
          <div className="nest-stat">
            <span className={`nest-stat-value ${utilisationClass(combinedResult.overallUtilisation)}`}>
              {combinedResult.overallUtilisation}%
            </span>
            <span className="nest-stat-label">Utilisation</span>
          </div>
          <div className="nest-stat">
            <span className="nest-stat-value">{(combinedResult.totalScrapArea / 1e6).toFixed(3)} m²</span>
            <span className="nest-stat-label">Scrap</span>
          </div>
          {combinedResult.totalMaterialCost != null && (
            <div className="nest-stat">
              <span className="nest-stat-value nest-util-green">£{combinedResult.totalMaterialCost.toFixed(2)}</span>
              <span className="nest-stat-label">Sheet Cost</span>
            </div>
          )}
        </div>
      )}

      {/* ── Combined mode viewer ── */}
      {hasData && nestingMode === "combined" && combinedResult && combinedResult.sheets.length > 0 && (
        <ResultViewer result={combinedResult} />
      )}

      {/* ── Individual mode: file tabs + per-file viewer ── */}
      {hasData && nestingMode === "individual" && perFileResults.length > 0 && (
        <div className="nest-individual-wrapper">
          {/* File tabs */}
          {perFileResults.length > 1 && (
            <div className="nest-file-tabs">
              {perFileResults.map(f => (
                <button
                  key={f.itemId}
                  className={`nest-file-tab ${resolvedFileId === f.itemId ? "active" : ""}`}
                  onClick={() => setActiveFileId(f.itemId)}
                >
                  <span className="nest-file-tab-name">{f.filename.replace(/\.[^.]+$/, "")}</span>
                  <span className="nest-file-tab-sheets">
                    {f.result.totalSheets} sh
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Stats for active file */}
          {activeFileResult && (
            <div className="nest-stats" style={{ marginTop: 4 }}>
              <div className="nest-stat">
                <span className="nest-stat-value">{activeFileResult.result.totalSheets}</span>
                <span className="nest-stat-label">Sheets</span>
              </div>
              <div className="nest-stat">
                <span className={`nest-stat-value ${utilisationClass(activeFileResult.result.overallUtilisation)}`}>
                  {activeFileResult.result.overallUtilisation}%
                </span>
                <span className="nest-stat-label">Utilisation</span>
              </div>
              <div className="nest-stat">
                <span className="nest-stat-value">{(activeFileResult.result.totalScrapArea / 1e6).toFixed(3)} m²</span>
                <span className="nest-stat-label">Scrap</span>
              </div>
              {activeFileResult.result.totalMaterialCost != null && (
                <div className="nest-stat">
                  <span className="nest-stat-value nest-util-green">
                    £{activeFileResult.result.totalMaterialCost.toFixed(2)}
                  </span>
                  <span className="nest-stat-label">Sheet Cost</span>
                </div>
              )}
            </div>
          )}

          {activeFileResult && (
            <ResultViewer result={activeFileResult.result} label={activeFileResult.filename} />
          )}
        </div>
      )}
    </div>
  );
}
