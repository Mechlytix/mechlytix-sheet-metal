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

// ─── Sheet SVG Renderer ─────────────────────────────────

function SheetSVG({ layout, activePartId, onPartHover }: {
  layout: SheetLayout;
  activePartId: string | null;
  onPartHover: (id: string | null) => void;
}) {
  const { sheetWidth, sheetHeight, placements } = layout;
  const pad = Math.max(sheetWidth, sheetHeight) * 0.03;

  const vbX = -pad;
  const vbY = -pad;
  const vbW = sheetWidth + pad * 2;
  const vbH = sheetHeight + pad * 2;

  // Generate distinct colours per partId
  const partColors = useMemo(() => {
    const ids = [...new Set(placements.map(p => p.partId))];
    const palette = [
      "hsla(25, 95%, 55%, 0.65)",   // orange
      "hsla(210, 80%, 55%, 0.65)",  // blue
      "hsla(150, 70%, 45%, 0.65)",  // green
      "hsla(280, 65%, 55%, 0.65)",  // purple
      "hsla(350, 80%, 55%, 0.65)",  // red
      "hsla(45, 90%, 50%, 0.65)",   // gold
      "hsla(180, 70%, 45%, 0.65)",  // teal
      "hsla(320, 70%, 55%, 0.65)",  // pink
    ];
    const map: Record<string, string> = {};
    ids.forEach((id, i) => { map[id] = palette[i % palette.length]; });
    return map;
  }, [placements]);

  const strokeW = Math.max(sheetWidth, sheetHeight) / 500;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className="nest-sheet-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Sheet outline */}
      <rect
        x={0} y={0}
        width={sheetWidth} height={sheetHeight}
        className="nest-sheet-rect"
        strokeWidth={strokeW * 2}
      />

      {/* Sheet grid */}
      <defs>
        <pattern
          id={`nest-grid-${layout.index}`}
          width={sheetWidth / 10}
          height={sheetHeight / 10}
          patternUnits="userSpaceOnUse"
        >
          <line x1={0} y1={0} x2={sheetWidth / 10} y2={0}
            stroke="var(--border-subtle, #2a2f38)" strokeWidth={strokeW * 0.3} />
          <line x1={0} y1={0} x2={0} y2={sheetHeight / 10}
            stroke="var(--border-subtle, #2a2f38)" strokeWidth={strokeW * 0.3} />
        </pattern>
      </defs>
      <rect
        x={0} y={0}
        width={sheetWidth} height={sheetHeight}
        fill={`url(#nest-grid-${layout.index})`}
      />

      {/* Placed parts */}
      {placements.map((p, i) => {
        const isHovered = activePartId === p.partId;
        const fill = partColors[p.partId] ?? "hsla(0, 0%, 50%, 0.5)";

        return (
          <g
            key={`${p.partId}-${i}`}
            transform={`translate(${p.x}, ${p.y})`}
            onMouseEnter={() => onPartHover(p.partId)}
            onMouseLeave={() => onPartHover(null)}
            style={{ cursor: "pointer" }}
          >
            {/* Part bounding box */}
            <rect
              x={0} y={0}
              width={p.width} height={p.height}
              fill={fill}
              stroke={isHovered ? "var(--accent, #ff6600)" : "rgba(255,255,255,0.3)"}
              strokeWidth={isHovered ? strokeW * 3 : strokeW}
              rx={strokeW}
              className="nest-part-rect"
              style={{
                filter: isHovered ? "brightness(1.3)" : undefined,
                transition: "filter 0.15s, stroke-width 0.15s",
              }}
            />

            {/* SVG outline if available (DXF parts) */}
            {p.svgPaths && p.svgPaths.length > 0 && (
              <g
                transform={
                  p.rotated
                    ? `translate(${p.width / 2}, ${p.height / 2}) rotate(90) translate(${-p.originalWidth / 2}, ${-p.originalHeight / 2})`
                    : undefined
                }
                opacity={0.7}
              >
                {p.svgPaths.map((d, si) => (
                  <path
                    key={si}
                    d={d}
                    fill="none"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={strokeW * 0.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )}

            {/* Rotation indicator */}
            {p.rotated && (
              <text
                x={p.width - strokeW * 5}
                y={strokeW * 8}
                fontSize={strokeW * 6}
                fill="rgba(255,255,255,0.7)"
                textAnchor="end"
                dominantBaseline="middle"
              >
                ↻
              </text>
            )}
          </g>
        );
      })}

      {/* Dimension labels */}
      <text
        x={sheetWidth / 2} y={-pad * 0.4}
        fontSize={strokeW * 7}
        fill="var(--text-dim, #888)"
        textAnchor="middle"
        dominantBaseline="auto"
      >
        {sheetWidth.toFixed(0)}mm
      </text>
      <text
        x={-pad * 0.4} y={sheetHeight / 2}
        fontSize={strokeW * 7}
        fill="var(--text-dim, #888)"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(-90, ${-pad * 0.4}, ${sheetHeight / 2})`}
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

  const activeSheet = result.sheets[Math.min(activeSheetIdx, result.sheets.length - 1)];

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Grain Lock
        </button>
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

      {/* ── Sheet tabs ── */}
      {result.sheets.length > 1 && (
        <div className="nest-sheet-tabs">
          {result.sheets.map((s, i) => (
            <button
              key={i}
              className={`nest-sheet-tab ${activeSheetIdx === i ? "active" : ""}`}
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
          {activeSheet.placements.length} part{activeSheet.placements.length !== 1 ? "s" : ""} · {activeSheet.utilisation}% utilised
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
