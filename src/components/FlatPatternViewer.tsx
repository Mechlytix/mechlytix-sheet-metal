"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";

interface FlatPatternViewerProps {
  geometry: {
    lines: Array<{ x1: number; y1: number; x2: number; y2: number; layer: string }>;
    arcs: Array<{ cx: number; cy: number; r: number; startAngle: number; endAngle: number; layer: string }>;
    circles: Array<{ cx: number; cy: number; r: number; layer: string }>;
    width: number;
    height: number;
  } | null;
}

function getDimensionLayout(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
  scale: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);

  if (L < 1e-6) {
    return null;
  }

  const ux = dx / L;
  const uy = dy / L;

  const nx = -uy;
  const ny = ux;

  const d1x = x1 + offset * nx;
  const d1y = y1 + offset * ny;
  const d2x = x2 + offset * nx;
  const d2y = y2 + offset * ny;

  const gap = 3 * scale;
  const overshoot = 4 * scale;
  const s = offset >= 0 ? 1 : -1;
  const absOffset = Math.abs(offset);
  const actualGap = Math.min(gap, absOffset);

  const e1sx = x1 + s * actualGap * nx;
  const e1sy = y1 + s * actualGap * ny;
  const e1ex = d1x + s * overshoot * nx;
  const e1ey = d1y + s * overshoot * ny;

  const e2sx = x2 + s * actualGap * nx;
  const e2sy = y2 + s * actualGap * ny;
  const e2ex = d2x + s * overshoot * nx;
  const e2ey = d2y + s * overshoot * ny;

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  const midX = (d1x + d2x) / 2;
  const midY = (d1y + d2y) / 2;

  return {
    d1: { x: d1x, y: d1y },
    d2: { x: d2x, y: d2y },
    e1s: { x: e1sx, y: e1sy },
    e1e: { x: e1ex, y: e1ey },
    e2s: { x: e2sx, y: e2sy },
    e2e: { x: e2ex, y: e2ey },
    mid: { x: midX, y: midY },
    angle,
    distance: L,
  };
}

function getOrthogonalLayout(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
  type: "horizontal" | "vertical",
  scale: number
) {
  const gap = 3 * scale;
  const overshoot = 4 * scale;
  const s = offset >= 0 ? 1 : -1;
  const absOffset = Math.abs(offset);
  const actualGap = Math.min(gap, absOffset);

  if (type === "horizontal") {
    // Measures X distance (horizontal dimension line at y_d)
    const dx = x2 - x1;
    const L = Math.abs(dx);
    if (L < 1e-6) return null;

    const yMid = (y1 + y2) / 2;
    const yd = yMid + offset;

    // Extension lines run vertically.
    const e1sy = y1 + s * actualGap;
    const e1ey = yd + s * overshoot;

    const e2sy = y2 + s * actualGap;
    const e2ey = yd + s * overshoot;

    const d1 = { x: x1, y: yd };
    const d2 = { x: x2, y: yd };

    const midX = (x1 + x2) / 2;
    const midY = yd;

    const angle = 0;

    return {
      d1,
      d2,
      e1s: { x: x1, y: e1sy },
      e1e: { x: x1, y: e1ey },
      e2s: { x: x2, y: e2sy },
      e2e: { x: x2, y: e2ey },
      mid: { x: midX, y: midY },
      angle,
      distance: L,
    };
  } else {
    // Measures Y distance (vertical dimension line at x_d)
    const dy = y2 - y1;
    const L = Math.abs(dy);
    if (L < 1e-6) return null;

    const xMid = (x1 + x2) / 2;
    const xd = xMid + offset;

    // Extension lines run horizontally.
    const e1sx = x1 + s * actualGap;
    const e1ex = xd + s * overshoot;

    const e2sx = x2 + s * actualGap;
    const e2ex = xd + s * overshoot;

    const d1 = { x: xd, y: y1 };
    const d2 = { x: xd, y: y2 };

    const midX = xd;
    const midY = (y1 + y2) / 2;

    const angle = -90;

    return {
      d1,
      d2,
      e1s: { x: e1sx, y: y1 },
      e1e: { x: e1ex, y: y1 },
      e2s: { x: e2sx, y: y2 },
      e2e: { x: e2ex, y: y2 },
      mid: { x: midX, y: midY },
      angle,
      distance: L,
    };
  }
}

export function FlatPatternViewer({ geometry }: FlatPatternViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    CUT_OUTER: true,
    CUT_INNER: true,
    BEND_UP: true,
    BEND_DOWN: true,
  });

  // Bounding box size
  const width = geometry?.width ?? 100;
  const height = geometry?.height ?? 100;

  // Default viewbox calculations with padding
  const defaultViewBox = useMemo(() => {
    const padX = Math.max(30, width * 0.2);
    const padY = Math.max(30, height * 0.2);
    return {
      x: -padX,
      y: -padY,
      w: width + padX * 2,
      h: height + padY * 2,
    };
  }, [width, height]);

  // Current viewbox state for pan/zoom
  const [vb, setVb] = useState(defaultViewBox);

  // Reset view when geometry changes
  useEffect(() => {
    setVb(defaultViewBox);
  }, [defaultViewBox]);

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);
  const [lastPt, setLastPt] = useState({ x: 0, y: 0 });

  // Measurement state
  const [measureMode, setMeasureMode] = useState<"aligned" | "orthogonal" | null>(null);
  const [startMeasurePt, setStartMeasurePt] = useState<{ x: number; y: number } | null>(null);
  const [secondMeasurePt, setSecondMeasurePt] = useState<{ x: number; y: number } | null>(null);
  const [hoverPt, setHoverPt] = useState<{
    x: number;
    y: number;
    snappedX: number;
    snappedY: number;
    label?: string;
    isSnapped: boolean;
  } | null>(null);
  const [customDimensions, setCustomDimensions] = useState<Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    offset: number;
    distance: number;
    type: "aligned" | "horizontal" | "vertical";
  }>>([]);

  // Keyboard shortcut to escape measurement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (secondMeasurePt) {
          setSecondMeasurePt(null);
        } else if (startMeasurePt) {
          setStartMeasurePt(null);
        } else if (measureMode !== null) {
          setMeasureMode(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startMeasurePt, secondMeasurePt, measureMode]);

  // Pre-calculate Snap Points in SVG space
  const snapPoints = useMemo(() => {
    if (!geometry) return [];
    const points: Array<{ x: number; y: number; label: string }> = [];
    const seen = new Set<string>();

    const addPoint = (x: number, y: number, label: string) => {
      const key = `${x.toFixed(3)},${y.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push({ x, y, label });
      }
    };

    // Lines
    geometry.lines.forEach((line) => {
      if (!visibleLayers[line.layer]) return;
      addPoint(line.x1, height - line.y1, "Endpoint");
      addPoint(line.x2, height - line.y2, "Endpoint");
    });

    // Arcs
    geometry.arcs.forEach((arc) => {
      if (!visibleLayers[arc.layer]) return;
      const startAngleRad = (arc.startAngle * Math.PI) / 180;
      const endAngleRad = (arc.endAngle * Math.PI) / 180;
      
      const x1 = arc.cx + arc.r * Math.cos(startAngleRad);
      const y1 = height - (arc.cy + arc.r * Math.sin(startAngleRad));
      const x2 = arc.cx + arc.r * Math.cos(endAngleRad);
      const y2 = height - (arc.cy + arc.r * Math.sin(endAngleRad));
      const cx = arc.cx;
      const cy = height - arc.cy;

      addPoint(x1, y1, "Endpoint");
      addPoint(x2, y2, "Endpoint");
      addPoint(cx, cy, "Center");
    });

    // Circles
    geometry.circles.forEach((circle) => {
      if (!visibleLayers[circle.layer]) return;
      addPoint(circle.cx, height - circle.cy, "Center");
    });

    return points;
  }, [geometry, visibleLayers, height]);

  // Convert client coords to SVG space with snapping
  const getSnappedPoint = (clientX: number, clientY: number) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const xNorm = (clientX - rect.left) / rect.width;
    const yNorm = (clientY - rect.top) / rect.height;
    const svgX = vb.x + xNorm * vb.w;
    const svgY = vb.y + yNorm * vb.h;

    const thresholdSVG = 15 * (vb.w / rect.width);
    let closestDist = thresholdSVG;
    let closestPoint: { x: number; y: number; label: string } | null = null;

    for (const pt of snapPoints) {
      const dist = Math.hypot(pt.x - svgX, pt.y - svgY);
      if (dist < closestDist) {
        closestDist = dist;
        closestPoint = pt;
      }
    }

    return {
      svgX,
      svgY,
      snapped: closestPoint ? { x: closestPoint.x, y: closestPoint.y, label: closestPoint.label } : null
    };
  };

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (measureMode !== null) {
      if (e.button === 0) {
        // Left click is reserved for starting/completing measurements
        return;
      }
      // Right (2) or Middle (1) click starts panning
      if (e.button === 1 || e.button === 2) {
        setIsDragging(true);
        setDragMoved(false);
        setLastPt({ x: e.clientX, y: e.clientY });
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } else {
      if (e.button !== 0) return; // Left click only for panning in normal mode
      setIsDragging(true);
      setDragMoved(false);
      setLastPt({ x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (measureMode !== null) {
      const snapResult = getSnappedPoint(e.clientX, e.clientY);
      if (snapResult) {
        setHoverPt({
          x: snapResult.svgX,
          y: snapResult.svgY,
          snappedX: snapResult.snapped ? snapResult.snapped.x : snapResult.svgX,
          snappedY: snapResult.snapped ? snapResult.snapped.y : snapResult.svgY,
          label: snapResult.snapped ? snapResult.snapped.label : undefined,
          isSnapped: !!snapResult.snapped,
        });
      }
    } else {
      if (hoverPt) setHoverPt(null);
    }

    if (!isDragging) return;
    const dx = e.clientX - lastPt.x;
    const dy = e.clientY - lastPt.y;

    if (!dragMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      setDragMoved(true);
    }

    if (dragMoved && svgRef.current) {
      setLastPt({ x: e.clientX, y: e.clientY });
      const rect = svgRef.current.getBoundingClientRect();
      const ratio = vb.w / rect.width;
      setVb((prev) => ({
        ...prev,
        x: prev.x - dx * ratio,
        y: prev.y - dy * ratio,
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (measureMode !== null && e.button === 0) {
      const snapResult = getSnappedPoint(e.clientX, e.clientY);
      if (snapResult) {
        const clickedPt = {
          x: snapResult.snapped ? snapResult.snapped.x : snapResult.svgX,
          y: snapResult.snapped ? snapResult.snapped.y : snapResult.svgY,
        };

        if (!startMeasurePt) {
          setStartMeasurePt(clickedPt);
        } else if (!secondMeasurePt) {
          if (Math.hypot(clickedPt.x - startMeasurePt.x, clickedPt.y - startMeasurePt.y) > 1e-3) {
            setSecondMeasurePt(clickedPt);
          }
        } else {
          if (measureMode === "aligned") {
            const dx = secondMeasurePt.x - startMeasurePt.x;
            const dy = secondMeasurePt.y - startMeasurePt.y;
            const L = Math.hypot(dx, dy);
            if (L > 1e-6) {
              const nx = -dy / L;
              const ny = dx / L;
              const wx = snapResult.svgX - startMeasurePt.x;
              const wy = snapResult.svgY - startMeasurePt.y;
              const offsetVal = wx * nx + wy * ny;

              setCustomDimensions((prev) => [
                ...prev,
                {
                  id: `dim-${Date.now()}-${Math.random()}`,
                  x1: startMeasurePt.x,
                  y1: startMeasurePt.y,
                  x2: secondMeasurePt.x,
                  y2: secondMeasurePt.y,
                  offset: offsetVal,
                  distance: L,
                  type: "aligned",
                },
              ]);
            }
          } else if (measureMode === "orthogonal") {
            const xMid = (startMeasurePt.x + secondMeasurePt.x) / 2;
            const yMid = (startMeasurePt.y + secondMeasurePt.y) / 2;
            const dx = snapResult.svgX - xMid;
            const dy = snapResult.svgY - yMid;

            let dimType: "horizontal" | "vertical" = "horizontal";
            let offsetVal = 0;
            let L = 0;

            if (Math.abs(dx) > Math.abs(dy)) {
              dimType = "vertical";
              offsetVal = dx;
              L = Math.abs(secondMeasurePt.y - startMeasurePt.y);
            } else {
              dimType = "horizontal";
              offsetVal = dy;
              L = Math.abs(secondMeasurePt.x - startMeasurePt.x);
            }

            if (L > 1e-6) {
              setCustomDimensions((prev) => [
                ...prev,
                {
                  id: `dim-${Date.now()}-${Math.random()}`,
                  x1: startMeasurePt.x,
                  y1: startMeasurePt.y,
                  x2: secondMeasurePt.x,
                  y2: secondMeasurePt.y,
                  offset: offsetVal,
                  distance: L,
                  type: dimType,
                },
              ]);
            }
          }
          setStartMeasurePt(null);
          setSecondMeasurePt(null);
        }
      }
    }
  };

  const handlePointerLeave = () => {
    setHoverPt(null);
  };

  // Handle Zoom (Wheel) — zoom toward cursor position
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = svgEl.getBoundingClientRect();
      const pxNorm = (e.clientX - rect.left) / rect.width;
      const pyNorm = (e.clientY - rect.top) / rect.height;

      const zoomFactor = Math.exp(e.deltaY * 0.0015);

      setVb((prev) => {
        const svgCursorX = prev.x + pxNorm * prev.w;
        const svgCursorY = prev.y + pyNorm * prev.h;

        const newW = prev.w * zoomFactor;
        const newH = prev.h * zoomFactor;

        const newX = svgCursorX - pxNorm * newW;
        const newY = svgCursorY - pyNorm * newH;

        return { x: newX, y: newY, w: newW, h: newH };
      });
    };

    svgEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => svgEl.removeEventListener("wheel", handleWheel);
  }, []);

  const handleReset = () => {
    setVb(defaultViewBox);
  };

  const handleZoomIn = () => {
    setVb((prev) => {
      const zoomFactor = 0.8;
      const newW = prev.w * zoomFactor;
      const newH = prev.h * zoomFactor;
      const newX = prev.x + (prev.w - newW) / 2;
      const newY = prev.y + (prev.h - newH) / 2;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  const handleZoomOut = () => {
    setVb((prev) => {
      const zoomFactor = 1.25;
      const newW = prev.w * zoomFactor;
      const newH = prev.h * zoomFactor;
      const newX = prev.x + (prev.w - newW) / 2;
      const newY = prev.y + (prev.h - newH) / 2;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  };

  // Determine stroke widths relative to zoom level
  const strokeWidthMultiplier = Math.max(vb.w, vb.h) / 500;
  const lineStrokeWidth = Math.max(0.5, strokeWidthMultiplier * 1.5);
  const bendStrokeWidth = Math.max(0.4, strokeWidthMultiplier * 1.2);
  const annotationStrokeWidth = Math.max(0.3, strokeWidthMultiplier * 0.8);
  const annotationTextSize = Math.max(3.0, strokeWidthMultiplier * 10);

  // Grid spacing calculation
  const gridSpacing = useMemo(() => {
    const maxDim = Math.max(vb.w, vb.h);
    const raw = maxDim / 10;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const candidates = [1, 2, 5, 10];
    for (const c of candidates) {
      if (c * mag >= raw * 0.5) return c * mag;
    }
    return 10 * mag;
  }, [vb.w, vb.h]);

  // Grid line generation
  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const gs = gridSpacing;
    const startX = Math.floor(vb.x / gs) * gs;
    const endX = Math.ceil((vb.x + vb.w) / gs) * gs;
    const startY = Math.floor(vb.y / gs) * gs;
    const endY = Math.ceil((vb.y + vb.h) / gs) * gs;
    const lines: React.ReactNode[] = [];
    
    if ((endX - startX) / gs > 100 || (endY - startY) / gs > 100) return null;

    for (let x = startX; x <= endX; x += gs) {
      lines.push(
        <line key={`gx-${x}`} x1={x} y1={startY} x2={x} y2={endY} vectorEffect="non-scaling-stroke" />
      );
    }
    for (let y = startY; y <= endY; y += gs) {
      lines.push(
        <line key={`gy-${y}`} x1={startX} y1={y} x2={endX} y2={y} vectorEffect="non-scaling-stroke" />
      );
    }
    return lines;
  }, [showGrid, gridSpacing, vb]);

  if (!geometry) {
    return (
      <div
        className="dxf-viewer-empty h-full w-full flex items-center justify-center border border-white/10 rounded-xl"
        style={{ background: "radial-gradient(circle at center, #252930 0%, #0f1013 100%)" }}
      >
        <div className="flex flex-col items-center gap-3 text-white/50">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#ff6600] animate-spin" />
          <span>Generating flat pattern geometry...</span>
        </div>
      </div>
    );
  }

  // Pre-calculate SVG path commands for arcs
  const svgArcs = geometry.arcs.map((arc, idx) => {
    const { cx, cy, r, startAngle, endAngle, layer } = arc;
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1_dxf = cx + r * Math.cos(startAngleRad);
    const y1_dxf = cy + r * Math.sin(startAngleRad);
    const x2_dxf = cx + r * Math.cos(endAngleRad);
    const y2_dxf = cy + r * Math.sin(endAngleRad);

    const x1_svg = x1_dxf;
    const y1_svg = height - y1_dxf;
    const x2_svg = x2_dxf;
    const y2_svg = height - y2_dxf;

    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += 360;

    const largeArcFlag = angleDiff > 180 ? 1 : 0;
    const sweepFlag = 0; // standard Y-flip means sweep goes CW relative to flipped Y, which is CCW in SVG coords, i.e., 0.

    const pathData = `M ${x1_svg} ${y1_svg} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${x2_svg} ${y2_svg}`;

    return { pathData, layer, id: `arc-${idx}` };
  });

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case "CUT_OUTER":
        return "var(--accent-primary, #ff6600)";
      case "CUT_INNER":
        return "#eab308"; // Tailwind Yellow 500
      case "BEND_UP":
        return "#10b981"; // Tailwind Emerald 500 (standard Green for UP bends)
      case "BEND_DOWN":
        return "#d946ef"; // Tailwind Magenta 500
      default:
        return "#98a2b3";
    }
  };

  const getLayerName = (layer: string) => {
    switch (layer) {
      case "CUT_OUTER":
        return "Outer Boundary";
      case "CUT_INNER":
        return "Internal Cutouts";
      case "BEND_UP":
        return "Bend Line UP";
      case "BEND_DOWN":
        return "Bend Line DOWN";
      default:
        return layer;
    }
  };

  const getLayerCount = (layer: string) => {
    let count = 0;
    if (layer === "CUT_OUTER" || layer === "CUT_INNER") {
      count += geometry.lines.filter(l => l.layer === layer).length;
      count += geometry.arcs.filter(a => a.layer === layer).length;
      count += geometry.circles.filter(c => c.layer === layer).length;
    } else if (layer === "BEND_UP" || layer === "BEND_DOWN") {
      count += geometry.lines.filter(l => l.layer === layer).length;
    }
    return count;
  };

  return (
    <div
      ref={containerRef}
      className="dxf-viewer-container flex-1 min-h-0 border border-white/10 rounded-xl relative select-none"
      style={{ background: "radial-gradient(circle at center, #252930 0%, #0f1013 100%)" }}
    >
      <div className="dxf-viewer-canvas w-full h-full relative">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className={`dxf-viewer-svg w-full h-full ${
            measureMode !== null ? "cursor-crosshair" : "cursor-default"
          }`}
          style={{ touchAction: "none" }}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* SVG Definitions for Arrow Markers */}
          <defs>
            <marker
              id="dimension-arrow-start"
              viewBox="0 0 10 10"
              refX="0"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 10 3.5 L 0 5 L 10 6.5 z" fill="rgba(255, 255, 255, 0.5)" />
            </marker>
            <marker
              id="dimension-arrow-end"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M 0 3.5 L 10 5 L 0 6.5 z" fill="rgba(255, 255, 255, 0.5)" />
            </marker>
            <marker
              id="custom-dimension-arrow-start"
              viewBox="0 0 10 10"
              refX="0"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 10 3.5 L 0 5 L 10 6.5 z" fill="#38bdf8" />
            </marker>
            <marker
              id="custom-dimension-arrow-end"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M 0 3.5 L 10 5 L 0 6.5 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Grid */}
          {gridLines && (
            <g className="dxf-grid" stroke="rgba(255,255,255,0.05)" strokeWidth={0.8}>
              {gridLines}
            </g>
          )}

          {/* Render Lines */}
          <g>
            {geometry.lines.map((line, idx) => {
              if (!visibleLayers[line.layer]) return null;
              const isBend = line.layer.startsWith("BEND");
              return (
                <line
                  key={`line-${idx}`}
                  x1={line.x1}
                  y1={height - line.y1}
                  x2={line.x2}
                  y2={height - line.y2}
                  stroke={getLayerColor(line.layer)}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={isBend ? 1.0 : (line.layer === "CUT_OUTER" ? 1.2 : 1.0)}
                  strokeDasharray={isBend ? "6,4" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
          </g>

          {/* Render Arcs */}
          <g fill="none">
            {svgArcs.map((arc) => {
              if (!visibleLayers[arc.layer]) return null;
              return (
                <path
                  key={arc.id}
                  d={arc.pathData}
                  stroke={getLayerColor(arc.layer)}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={arc.layer === "CUT_OUTER" ? 1.2 : 1.0}
                  strokeLinecap="round"
                />
              );
            })}
          </g>

          {/* Render Circles */}
          <g fill="none">
            {geometry.circles.map((circle, idx) => {
              if (!visibleLayers[circle.layer]) return null;
              return (
                <circle
                  key={`circle-${idx}`}
                  cx={circle.cx}
                  cy={height - circle.cy}
                  r={circle.r}
                  stroke={getLayerColor(circle.layer)}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={circle.layer === "CUT_OUTER" ? 1.2 : 1.0}
                />
              );
            })}
          </g>

          {/* CAD Bounding Box Dimension Annotations */}
          <g className="dxf-annotations" stroke="rgba(255, 255, 255, 0.35)" fill="rgba(255, 255, 255, 0.35)">
            {/* 1. Horizontal Dimension (Width) */}
            {/* Left Extension Line */}
            <line
              x1={0}
              y1={height}
              x2={0}
              y2={height + 15}
              vectorEffect="non-scaling-stroke"
              strokeWidth={0.8}
              opacity={0.4}
            />
            {/* Right Extension Line */}
            <line
              x1={width}
              y1={height}
              x2={width}
              y2={height + 15}
              vectorEffect="non-scaling-stroke"
              strokeWidth={0.8}
              opacity={0.4}
            />
            {/* Dimension Line with Arrows */}
            <line
              x1={0}
              y1={height + 10}
              x2={width}
              y2={height + 10}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.0}
              markerStart="url(#dimension-arrow-start)"
              markerEnd="url(#dimension-arrow-end)"
            />
            {/* Dimension Text */}
            <text
              x={width / 2}
              y={height + 7}
              fontSize={annotationTextSize}
              fontFamily="var(--font-mono, monospace)"
              textAnchor="middle"
              stroke="none"
              fill="var(--text-primary, #f2f4f7)"
              fontWeight="bold"
            >
              {width.toFixed(1)} mm
            </text>

            {/* 2. Vertical Dimension (Height) */}
            {/* Top Extension Line */}
            <line
              x1={0}
              y1={0}
              x2={-15}
              y2={0}
              vectorEffect="non-scaling-stroke"
              strokeWidth={0.8}
              opacity={0.4}
            />
            {/* Bottom Extension Line */}
            <line
              x1={0}
              y1={height}
              x2={-15}
              y2={height}
              vectorEffect="non-scaling-stroke"
              strokeWidth={0.8}
              opacity={0.4}
            />
            {/* Dimension Line with Arrows */}
            <line
              x1={-10}
              y1={0}
              x2={-10}
              y2={height}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.0}
              markerStart="url(#dimension-arrow-start)"
              markerEnd="url(#dimension-arrow-end)"
            />
            {/* Dimension Text (Rotated) */}
            <text
              x={-13}
              y={height / 2}
              transform={`rotate(-90, -13, ${height / 2})`}
              fontSize={annotationTextSize}
              fontFamily="var(--font-mono, monospace)"
              textAnchor="middle"
              stroke="none"
              fill="var(--text-primary, #f2f4f7)"
              fontWeight="bold"
            >
              {height.toFixed(1)} mm
            </text>
          </g>

          {/* Render Completed Custom Measurements */}
          {customDimensions.map((dim) => {
            const layout =
              dim.type === "aligned"
                ? getDimensionLayout(
                    dim.x1,
                    dim.y1,
                    dim.x2,
                    dim.y2,
                    dim.offset,
                    strokeWidthMultiplier * 0.8
                  )
                : getOrthogonalLayout(
                    dim.x1,
                    dim.y1,
                    dim.x2,
                    dim.y2,
                    dim.offset,
                    dim.type,
                    strokeWidthMultiplier * 0.8
                  );
            if (!layout) return null;

            const label = `${dim.distance.toFixed(1)} mm`;
            const fontSize = Math.max(3.0, strokeWidthMultiplier * 9);
            const textW = fontSize * 0.65 * label.length;
            const textH = fontSize * 1.3;

            return (
              <g key={dim.id} className="custom-dimension">
                {/* Extension Line 1 */}
                <line
                  x1={layout.e1s.x}
                  y1={layout.e1s.y}
                  x2={layout.e1e.x}
                  y2={layout.e1e.y}
                  stroke="#38bdf8"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={1.0}
                  opacity={0.6}
                />
                {/* Extension Line 2 */}
                <line
                  x1={layout.e2s.x}
                  y1={layout.e2s.y}
                  x2={layout.e2e.x}
                  y2={layout.e2e.y}
                  stroke="#38bdf8"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={1.0}
                  opacity={0.6}
                />
                {/* Dimension Line */}
                <line
                  x1={layout.d1.x}
                  y1={layout.d1.y}
                  x2={layout.d2.x}
                  y2={layout.d2.y}
                  stroke="#38bdf8"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={1.2}
                  markerStart="url(#custom-dimension-arrow-start)"
                  markerEnd="url(#custom-dimension-arrow-end)"
                />
                {/* Dimension Label Group */}
                <g transform={`translate(${layout.mid.x}, ${layout.mid.y}) rotate(${layout.angle})`}>
                  {/* Backdrop Rect */}
                  <rect
                    x={-textW / 2 - 2 * strokeWidthMultiplier}
                    y={-textH / 2}
                    width={textW + 4 * strokeWidthMultiplier}
                    height={textH}
                    fill="#0f1013"
                  />
                  {/* Text Label */}
                  <text
                    x={0}
                    y={0}
                    fontSize={fontSize}
                    fontFamily="var(--font-mono, monospace)"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#38bdf8"
                    fontWeight="bold"
                  >
                    {label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Render Live Measurement Guideline (Step 2) */}
          {measureMode !== null && startMeasurePt && !secondMeasurePt && hoverPt && (
            <g className="live-guideline">
              {/* Dashed line to snap/mouse point */}
              <line
                x1={startMeasurePt.x}
                y1={startMeasurePt.y}
                x2={hoverPt.snappedX}
                y2={hoverPt.snappedY}
                stroke="#38bdf8"
                vectorEffect="non-scaling-stroke"
                strokeWidth={1.0}
                strokeDasharray="4,3"
                opacity={0.7}
              />
              {/* Start point tick */}
              <circle cx={startMeasurePt.x} cy={startMeasurePt.y} r={strokeWidthMultiplier * 2.5} fill="#38bdf8" />
              
              {/* End point tick */}
              <circle cx={hoverPt.snappedX} cy={hoverPt.snappedY} r={strokeWidthMultiplier * 2.5} fill="#38bdf8" />

              {/* Live distance text badge */}
              {(() => {
                const midX = (startMeasurePt.x + hoverPt.snappedX) / 2;
                const midY = (startMeasurePt.y + hoverPt.snappedY) / 2;
                const dist = Math.hypot(hoverPt.snappedX - startMeasurePt.x, hoverPt.snappedY - startMeasurePt.y);
                const label = `${dist.toFixed(1)} mm`;
                const fontSize = Math.max(3.0, strokeWidthMultiplier * 9);
                const textW = fontSize * 0.65 * label.length;
                const textH = fontSize * 1.3;

                return (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-textW / 2 - 2 * strokeWidthMultiplier}
                      y={-textH / 2}
                      width={textW + 4 * strokeWidthMultiplier}
                      height={textH}
                      fill="#0f1013"
                      stroke="#38bdf8"
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={1.0}
                      strokeDasharray="2,1"
                      opacity={0.8}
                    />
                    <text
                      x={0}
                      y={0}
                      fontSize={fontSize}
                      fontFamily="var(--font-mono, monospace)"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#38bdf8"
                      fontWeight="bold"
                      opacity={0.9}
                    >
                      {label}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Render Live Dimension Drag Preview (Step 3) */}
          {measureMode !== null && startMeasurePt && secondMeasurePt && hoverPt && (
            (() => {
              let layout = null;
              let dimType: "aligned" | "horizontal" | "vertical" = "aligned";

              if (measureMode === "aligned") {
                const dx = secondMeasurePt.x - startMeasurePt.x;
                const dy = secondMeasurePt.y - startMeasurePt.y;
                const L = Math.hypot(dx, dy);
                if (L < 1e-6) return null;

                const nx = -dy / L;
                const ny = dx / L;
                const wx = hoverPt.x - startMeasurePt.x;
                const wy = hoverPt.y - startMeasurePt.y;
                const offsetVal = wx * nx + wy * ny;

                layout = getDimensionLayout(
                  startMeasurePt.x,
                  startMeasurePt.y,
                  secondMeasurePt.x,
                  secondMeasurePt.y,
                  offsetVal,
                  strokeWidthMultiplier * 0.8
                );
                dimType = "aligned";
              } else {
                const xMid = (startMeasurePt.x + secondMeasurePt.x) / 2;
                const yMid = (startMeasurePt.y + secondMeasurePt.y) / 2;
                const dx = hoverPt.x - xMid;
                const dy = hoverPt.y - yMid;

                if (Math.abs(dx) > Math.abs(dy)) {
                  dimType = "vertical";
                  layout = getOrthogonalLayout(
                    startMeasurePt.x,
                    startMeasurePt.y,
                    secondMeasurePt.x,
                    secondMeasurePt.y,
                    dx,
                    "vertical",
                    strokeWidthMultiplier * 0.8
                  );
                } else {
                  dimType = "horizontal";
                  layout = getOrthogonalLayout(
                    startMeasurePt.x,
                    startMeasurePt.y,
                    secondMeasurePt.x,
                    secondMeasurePt.y,
                    dy,
                    "horizontal",
                    strokeWidthMultiplier * 0.8
                  );
                }
              }

              if (!layout) return null;

              const label = `${layout.distance.toFixed(1)} mm`;
              const fontSize = Math.max(3.0, strokeWidthMultiplier * 9);
              const textW = fontSize * 0.65 * label.length;
              const textH = fontSize * 1.3;

              return (
                <g className="live-dimension-drag">
                  {/* Extension Line 1 */}
                  <line
                    x1={layout.e1s.x}
                    y1={layout.e1s.y}
                    x2={layout.e1e.x}
                    y2={layout.e1e.y}
                    stroke="#38bdf8"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={1.0}
                    opacity={0.5}
                    strokeDasharray="2,2"
                  />
                  {/* Extension Line 2 */}
                  <line
                    x1={layout.e2s.x}
                    y1={layout.e2s.y}
                    x2={layout.e2e.x}
                    y2={layout.e2e.y}
                    stroke="#38bdf8"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={1.0}
                    opacity={0.5}
                    strokeDasharray="2,2"
                  />
                  {/* Dimension Line */}
                  <line
                    x1={layout.d1.x}
                    y1={layout.d1.y}
                    x2={layout.d2.x}
                    y2={layout.d2.y}
                    stroke="#38bdf8"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={1.2}
                    markerStart="url(#custom-dimension-arrow-start)"
                    markerEnd="url(#custom-dimension-arrow-end)"
                    opacity={0.8}
                  />
                  {/* Dimension Label Group */}
                  <g transform={`translate(${layout.mid.x}, ${layout.mid.y}) rotate(${layout.angle})`}>
                    <rect
                      x={-textW / 2 - 2 * strokeWidthMultiplier}
                      y={-textH / 2}
                      width={textW + 4 * strokeWidthMultiplier}
                      height={textH}
                      fill="#0f1013"
                      stroke="#38bdf8"
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={1.0}
                      strokeDasharray="2,1"
                      opacity={0.8}
                    />
                    <text
                      x={0}
                      y={0}
                      fontSize={fontSize}
                      fontFamily="var(--font-mono, monospace)"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#38bdf8"
                      fontWeight="bold"
                      opacity={0.9}
                    >
                      {label}
                    </text>
                  </g>
                </g>
              );
            })()
          )}

          {/* Render Snap Indicator */}
          {measureMode !== null && hoverPt && hoverPt.isSnapped && (
            <g className="snap-indicator">
              {/* Snap box */}
              <rect
                x={hoverPt.snappedX - (strokeWidthMultiplier * 4)}
                y={hoverPt.snappedY - (strokeWidthMultiplier * 4)}
                width={strokeWidthMultiplier * 8}
                height={strokeWidthMultiplier * 8}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={Math.max(0.5, strokeWidthMultiplier * 1.2)}
              />
              {/* Snap classification text label */}
              <text
                x={hoverPt.snappedX + (strokeWidthMultiplier * 6)}
                y={hoverPt.snappedY}
                fontSize={Math.max(3.0, strokeWidthMultiplier * 8)}
                fontFamily="var(--font-mono, monospace)"
                fill="#38bdf8"
                fontWeight="bold"
                dominantBaseline="central"
              >
                {hoverPt.label}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Floating Legend Layer Toggle Panel */}
      <div className="absolute bottom-4 right-4 bg-[#1a1d21]/95 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-md z-10 w-72 sm:w-80 min-w-72 max-w-sm flex flex-col gap-3 flex-shrink-0">
        <div className="text-xs font-semibold text-white/90 border-b border-white/5 pb-2">
          Layer Visibility
        </div>
        <div className="flex flex-col gap-2">
          {(["CUT_OUTER", "CUT_INNER", "BEND_UP", "BEND_DOWN"] as const).map((layer) => {
            const count = getLayerCount(layer);
            return (
              <label
                key={layer}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-white/5 p-1 px-1.5 rounded transition-colors"
              >
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={visibleLayers[layer]}
                    onChange={(e) =>
                      setVisibleLayers((prev) => ({
                        ...prev,
                        [layer]: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 rounded border-white/20 bg-[#111315] text-[#ff6600] focus:ring-[#ff6600]/50 focus:ring-offset-[#1a1d21] flex-shrink-0"
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getLayerColor(layer) }}
                    />
                    <span className="text-white/80 font-medium whitespace-nowrap">
                      {getLayerName(layer)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-white/45 font-mono bg-white/5 px-1.5 py-0.5 rounded flex-shrink-0">
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Floating Toolbar Controls */}
      <div className="absolute top-4 right-4 flex gap-1.5 bg-[#1a1d21]/95 border border-white/10 p-1.5 rounded-xl shadow-2xl backdrop-blur-md z-10">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors border border-white/5 cursor-pointer"
          title="Zoom In"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors border border-white/5 cursor-pointer"
          title="Zoom Out"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          onClick={handleReset}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors border border-white/5 cursor-pointer"
          title="Fit Screen"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
        </button>
        <div className="w-[1px] bg-white/10 self-stretch my-1" />
        <button
          onClick={() => setShowGrid((s) => !s)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border cursor-pointer ${
            showGrid
              ? "bg-[#ff6600]/25 text-[#ff6600] border-[#ff6600]/40"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/5"
          }`}
          title="Toggle Grid"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
        <div className="w-[1px] bg-white/10 self-stretch my-1" />
        <button
          onClick={() => {
            setMeasureMode((m) => (m === "aligned" ? null : "aligned"));
            setStartMeasurePt(null);
            setSecondMeasurePt(null);
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border cursor-pointer ${
            measureMode === "aligned"
              ? "bg-[#38bdf8]/25 text-[#38bdf8] border-[#38bdf8]/40"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/5"
          }`}
          title="Aligned Dimension"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <g transform="rotate(45, 12, 12)">
              <line x1="4" y1="12" x2="20" y2="12" />
              <polyline points="8 8 4 12 8 16" />
              <polyline points="16 8 20 12 16 16" />
              <line x1="4" y1="6" x2="4" y2="18" />
              <line x1="20" y1="6" x2="20" y2="18" />
            </g>
          </svg>
        </button>
        <button
          onClick={() => {
            setMeasureMode((m) => (m === "orthogonal" ? null : "orthogonal"));
            setStartMeasurePt(null);
            setSecondMeasurePt(null);
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border cursor-pointer ${
            measureMode === "orthogonal"
              ? "bg-[#38bdf8]/25 text-[#38bdf8] border-[#38bdf8]/40"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/5"
          }`}
          title="Orthogonal Dimension"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="12" x2="18" y2="12" />
            <polyline points="9 9 6 12 9 15" />
            <polyline points="15 9 18 12 15 15" />
            <line x1="6" y1="6" x2="6" y2="18" />
            <line x1="18" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {(customDimensions.length > 0 || startMeasurePt !== null || secondMeasurePt !== null) && (
          <button
            onClick={() => {
              setCustomDimensions([]);
              setStartMeasurePt(null);
              setSecondMeasurePt(null);
            }}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/25 hover:text-red-400 hover:border-red-500/40 text-white/70 flex items-center justify-center transition-colors border border-white/5 cursor-pointer"
            title="Clear Measurements"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Info Overlay badge */}
      <div className="absolute top-4 left-4 bg-[#1a1d21]/95 border border-white/10 p-2.5 px-3.5 rounded-xl shadow-2xl backdrop-blur-md z-10 flex items-center gap-2">
        <span className="text-[10px] uppercase font-extrabold tracking-wider bg-[#ff6600]/20 text-[#ff6600] px-2 py-0.5 rounded border border-[#ff6600]/25">
          2D Flat Pattern
        </span>
        <span className="text-xs font-mono font-medium text-white/80">
          {width.toFixed(1)} × {height.toFixed(1)} mm
        </span>
      </div>
    </div>
  );
}
