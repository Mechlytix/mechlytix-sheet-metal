"use client";

import React, { useMemo, useState } from "react";
import type { NestingResult, SheetLayout, SheetPlacement } from "@/lib/pricing/types";
import type { RemnantCandidate } from "@/lib/pricing/types";

interface NestingPreviewProps {
  result: NestingResult | null;
  /** Current kerf gap for display */
  kerfGapMm: number;
  /** Whether rotation is enabled */
  allowRotation: boolean;
  /** Whether grain lock is active */
  grainLocked: boolean;
  /** Callbacks */
  onKerfChange?: (val: number) => void;
  onRotationToggle?: () => void;
  onGrainLockToggle?: () => void;
}

// ─── Utilisation colour helper ──────────────────────────

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

// ─── Part colour palette ─────────────────────────────────

const PART_PALETTE = [
  { fill: "rgba(255,102,0,0.25)",   stroke: "rgba(255,102,0,0.9)" },   // orange (brand)
  { fill: "rgba(59,130,246,0.25)",  stroke: "rgba(59,130,246,0.9)" },  // blue
  { fill: "rgba(34,197,94,0.25)",   stroke: "rgba(34,197,94,0.9)" },   // green
  { fill: "rgba(168,85,247,0.25)",  stroke: "rgba(168,85,247,0.9)" },  // purple
  { fill: "rgba(239,68,68,0.25)",   stroke: "rgba(239,68,68,0.9)" },   // red
  { fill: "rgba(234,179,8,0.25)",   stroke: "rgba(234,179,8,0.9)" },   // yellow
  { fill: "rgba(20,184,166,0.25)",  stroke: "rgba(20,184,166,0.9)" },  // teal
  { fill: "rgba(236,72,153,0.25)",  stroke: "rgba(236,72,153,0.9)" },  // pink
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

  // DXF coordinates: Y-axis is flipped vs SVG (DXF Y goes up, SVG Y goes down).
  // The paths are in absolute DXF coords starting at (svgMinX, svgMinY).
  // We need to:
  //   1. Translate by (-svgMinX, -svgMinY) to bring them to origin
  //   2. Flip Y: translate(0, partHeight) scale(1, -1) because SVG Y goes down
  // Combined transform (applied right-to-left):
  //   translate(0, partH) scale(1,-1) translate(-svgMinX, -svgMinY)
  const partW = p.originalWidth;
  const partH = p.originalHeight;

  // If the part is rotated, the engine swapped w/h. We need to flip appropriately.
  // The rotation is applied to the bounding box group, and the paths inside
  // describe the un-rotated part at originalWidth × originalHeight.
  const pathTransform = `translate(0, ${partH}) scale(1, -1) translate(${-svgMinX}, ${-svgMinY})`;

  // Rotation: the engine places part with swapped w/h but we still draw the outline
  // as if un-rotated, then rotate the whole group.
  // We rotate the inner shape 90° CW and translate to fit within the placed rect.
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
      {/* Bounding box fill */}
      <rect
        x={0} y={0}
        width={p.width} height={p.height}
        fill={isHovered ? color.fill.replace("0.25", "0.45") : color.fill}
        stroke={isHovered ? color.stroke : color.stroke.replace("0.9", "0.55")}
        strokeWidth={isHovered ? strokeW * 2.5 : strokeW * 1.2}
        rx={strokeW * 0.5}
        style={{ transition: "fill 0.12s, stroke 0.12s, stroke-width 0.12s" }}
      />

      {/* SVG part outline clipped to bounding box */}
      {hasPaths && (
        <clipPath id={`clip-${p.partId}-${p.x}-${p.y}`}>
          <rect x={0} y={0} width={p.width} height={p.height} />
        </clipPath>
      )}
      {hasPaths && (
        <g
          clipPath={`url(#clip-${p.partId}-${p.x}-${p.y})`}
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

      {/* Rotation indicator dot */}
      {p.rotated && (
        <circle
          cx={p.width - strokeW * 4}
          cy={strokeW * 4}
          r={strokeW * 2.5}
          fill={color.stroke}
          opacity={0.8}
        />
      )}

      {/* Part label (filename, truncated) */}
      <text
        x={p.width / 2}
        y={p.height / 2}
        fontSize={Math.min(strokeW * 8, p.height * 0.25, p.width * 0.25)}
        fill="rgba(255,255,255,0.55)"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {p.filename.replace(/\.[^.]+$/, "").substring(0, 12)}
      </text>
    </g>
  );
}

// ─── Sheet SVG Renderer ─────────────────────────────────

function SheetSVG({ layout, activePartId, onPartHover }: {
  layout: SheetLayout;
  activePartId: string | null;
  onPartHover: (id: string | null) => void;
}) {
  const { sheetWidth, sheetHeight, placements } = layout;
  const pad = Math.max(sheetWidth, sheetHeight) * 0.04;

  const vbX = -pad;
  const vbY = -pad;
  const vbW = sheetWidth + pad * 2;
  const vbH = sheetHeight + pad * 2;

  // Map each unique partId to a palette index
  const partColorIdx = useMemo(() => {
    const ids = [...new Set(placements.map(p => p.partId))];
    const map: Record<string, number> = {};
    ids.forEach((id, i) => { map[id] = i; });
    return map;
  }, [placements]);

  const strokeW = Math.max(sheetWidth, sheetHeight) / 600;
  const gridSize = Math.max(sheetWidth, sheetHeight) / 10;
  const gridId = `nest-grid-${layout.index}`;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className="nest-sheet-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Subtle grid */}
        <pattern id={gridId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <line
            x1={0} y1={0} x2={gridSize} y2={0}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={strokeW * 0.5}
          />
          <line
            x1={0} y1={0} x2={0} y2={gridSize}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={strokeW * 0.5}
          />
        </pattern>
      </defs>

      {/* Sheet background */}
      <rect
        x={0} y={0}
        width={sheetWidth} height={sheetHeight}
        fill="rgba(255,255,255,0.03)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={strokeW * 1.5}
      />

      {/* Grid */}
      <rect x={0} y={0} width={sheetWidth} height={sheetHeight} fill={`url(#${gridId})`} />

      {/* Parts */}
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

      {/* Dimension labels */}
      <text
        x={sheetWidth / 2} y={-pad * 0.45}
        fontSize={strokeW * 8}
        fill="rgba(255,255,255,0.4)"
        textAnchor="middle"
        dominantBaseline="auto"
      >
        {sheetWidth.toFixed(0)}mm
      </text>
      <text
        x={-pad * 0.45} y={sheetHeight / 2}
        fontSize={strokeW * 8}
        fill="rgba(255,255,255,0.4)"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90, ${-pad * 0.45}, ${sheetHeight / 2})`}
      >
        {sheetHeight.toFixed(0)}mm
      </text>
    </svg>
  );
}

// ─── Remnant Suggestion Card ────────────────────────────

function RemnantSuggestion({ candidate }: { candidate: RemnantCandidate }) {
  return (
    <div className="nest-remnant-card">
      <div className="nest-remnant-icon">♻️</div>
      <div className="nest-remnant-info">
        <span className="nest-remnant-title">
          Scrap Rack Match — {candidate.materialName}
        </span>
        <span className="nest-remnant-dims">
          {candidate.width} × {candidate.height}mm
          {candidate.location && <> · 📍 {candidate.location}</>}
        </span>
        <span className="nest-remnant-fit">
          Fits <strong>{candidate.partsFit}</strong> part{candidate.partsFit !== 1 ? "s" : ""}
          {candidate.savingsEstimate > 0 && (
            <> · Save <strong>£{candidate.savingsEstimate.toFixed(2)}</strong></>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function NestingPreview({
  result,
  kerfGapMm,
  allowRotation,
  grainLocked,
  onKerfChange,
  onRotationToggle,
  onGrainLockToggle,
}: NestingPreviewProps) {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

  if (!result || result.sheets.length === 0) {
    return (
      <div className="nest-empty">
        <div className="nest-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>
        </div>
        <p className="nest-empty-title">No nesting data</p>
        <p className="nest-empty-sub">Select a sheet size to calculate nesting layout</p>
      </div>
    );
  }

  const safeIdx = Math.min(activeSheetIdx, result.sheets.length - 1);
  const activeSheet = result.sheets[safeIdx];
  const totalParts = result.sheets.reduce((s, sh) => s + sh.placements.length, 0);

  return (
    <div className="nest-preview">

      {/* ── Controls bar ── */}
      <div className="nest-controls">
        <div className="nest-control-group">
          <label className="nest-control-label">Kerf Gap</label>
          <div className="nest-control-input-wrap">
            <input
              type="number"
              className="nest-control-input"
              value={kerfGapMm}
              onChange={(e) => onKerfChange?.(Math.max(0, parseFloat(e.target.value) || 0))}
              step={0.5}
              min={0}
              max={20}
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
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            <polyline points="22 2 22 8 16 8" />
          </svg>
          Rotation
        </button>

        <button
          className={`nest-toggle-btn ${grainLocked ? "active warn" : ""}`}
          onClick={onGrainLockToggle}
          title="Lock grain direction (disables rotation)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Grain Lock
        </button>

        {/* Summary pill */}
        <span className="nest-summary-pill">
          {totalParts} piece{totalParts !== 1 ? "s" : ""} on {result.totalSheets} sheet{result.totalSheets !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Stats strip ── */}
      <div className="nest-stats">
        <div className="nest-stat">
          <span className="nest-stat-value">{result.totalSheets}</span>
          <span className="nest-stat-label">Sheet{result.totalSheets !== 1 ? "s" : ""}</span>
        </div>
        <div className="nest-stat">
          <span className={`nest-stat-value ${utilisationClass(result.overallUtilisation)}`}>
            {result.overallUtilisation}%
          </span>
          <span className="nest-stat-label">Utilisation</span>
        </div>
        <div className="nest-stat">
          <span className="nest-stat-value">
            {(result.totalScrapArea / 1e6).toFixed(3)} m²
          </span>
          <span className="nest-stat-label">Scrap</span>
        </div>
        {result.totalMaterialCost != null && (
          <div className="nest-stat">
            <span className="nest-stat-value nest-util-green">
              £{result.totalMaterialCost.toFixed(2)}
            </span>
            <span className="nest-stat-label">Sheet Cost</span>
          </div>
        )}
      </div>

      {/* ── Sheet tabs (only shown when >1 sheet) ── */}
      {result.sheets.length > 1 && (
        <div className="nest-sheet-tabs">
          {result.sheets.map((s, i) => (
            <button
              key={i}
              className={`nest-sheet-tab ${safeIdx === i ? "active" : ""}`}
              onClick={() => setActiveSheetIdx(i)}
            >
              <span className="nest-tab-label">Sheet {i + 1}</span>
              <span
                className="nest-tab-util"
                style={{ color: utilisationColor(s.utilisation) }}
              >
                {s.utilisation}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Utilisation bar ── */}
      <div className="nest-util-bar-wrap">
        <div className="nest-util-bar">
          <div
            className="nest-util-fill"
            style={{
              width: `${activeSheet.utilisation}%`,
              background: utilisationColor(activeSheet.utilisation),
            }}
          />
        </div>
        <span className="nest-util-label">
          {activeSheet.placements.length} part{activeSheet.placements.length !== 1 ? "s" : ""} on this sheet · {activeSheet.utilisation}% utilised
        </span>
      </div>

      {/* ── SVG Preview ── */}
      <div className="nest-svg-container">
        <SheetSVG
          layout={activeSheet}
          activePartId={hoveredPartId}
          onPartHover={setHoveredPartId}
        />
      </div>

      {/* ── Remnant suggestions ── */}
      {result.remnantCandidates.length > 0 && (
        <div className="nest-remnants-section">
          <p className="nest-remnants-title">
            💡 Scrap Rack Matches ({result.remnantCandidates.length})
          </p>
          {result.remnantCandidates.slice(0, 3).map((c) => (
            <RemnantSuggestion key={c.id} candidate={c} />
          ))}
        </div>
      )}
    </div>
  );
}
