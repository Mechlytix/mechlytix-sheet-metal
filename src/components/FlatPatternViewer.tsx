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
  const [measureMode, setMeasureMode] = useState(false);
  const [startMeasurePt, setStartMeasurePt] = useState<{ x: number; y: number } | null>(null);
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
    distance: number;
  }>>([]);

  // Keyboard shortcut to escape measurement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (startMeasurePt) {
          setStartMeasurePt(null);
        } else if (measureMode) {
          setMeasureMode(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startMeasurePt, measureMode]);

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
    if (measureMode) {
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
    if (measureMode) {
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

    if (measureMode && e.button === 0) {
      const snapResult = getSnappedPoint(e.clientX, e.clientY);
      if (snapResult) {
        const clickedPt = {
          x: snapResult.snapped ? snapResult.snapped.x : snapResult.svgX,
          y: snapResult.snapped ? snapResult.snapped.y : snapResult.svgY,
        };

        if (!startMeasurePt) {
          setStartMeasurePt(clickedPt);
        } else {
          const distance = Math.hypot(clickedPt.x - startMeasurePt.x, clickedPt.y - startMeasurePt.y);
          setCustomDimensions((prev) => [
            ...prev,
            {
              id: `dim-${Date.now()}-${Math.random()}`,
              x1: startMeasurePt.x,
              y1: startMeasurePt.y,
              x2: clickedPt.x,
              y2: clickedPt.y,
              distance,
            },
          ]);
          setStartMeasurePt(null);
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
        <line key={`gx-${x}`} x1={x} y1={startY} x2={x} y2={endY} />
      );
    }
    for (let y = startY; y <= endY; y += gs) {
      lines.push(
        <line key={`gy-${y}`} x1={startX} y1={y} x2={endX} y2={y} />
      );
    }
    return lines;
  }, [showGrid, gridSpacing, vb]);

  if (!geometry) {
    return (
      <div className="dxf-viewer-empty h-full w-full flex items-center justify-center bg-[#0e1012] border border-white/10 rounded-xl">
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
    <div ref={containerRef} className="dxf-viewer-container flex-1 min-h-0 bg-[#0e1012] border border-white/10 rounded-xl relative select-none">
      <div className="dxf-viewer-canvas w-full h-full relative">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className={`dxf-viewer-svg w-full h-full ${
            measureMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
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
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 10 2 L 0 5 L 10 8 z" fill="rgba(255, 255, 255, 0.4)" />
            </marker>
            <marker
              id="dimension-arrow-end"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(255, 255, 255, 0.4)" />
            </marker>
          </defs>

          {/* Grid */}
          {gridLines && (
            <g className="dxf-grid" stroke="rgba(255,255,255,0.06)" strokeWidth={annotationStrokeWidth * 0.4}>
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
                  strokeWidth={isBend ? bendStrokeWidth : lineStrokeWidth}
                  strokeDasharray={isBend ? `${bendStrokeWidth * 4},${bendStrokeWidth * 3}` : undefined}
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
                  strokeWidth={lineStrokeWidth}
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
                  strokeWidth={lineStrokeWidth}
                />
              );
            })}
          </g>

          {/* CAD Bounding Box Dimension Annotations */}
          <g className="dxf-annotations" stroke="rgba(255, 255, 255, 0.4)" fill="rgba(255, 255, 255, 0.4)">
            {/* 1. Horizontal Dimension (Width) */}
            {/* Left Extension Line */}
            <line
              x1={0}
              y1={height}
              x2={0}
              y2={height + 15}
              strokeWidth={annotationStrokeWidth * 0.6}
              opacity={0.5}
            />
            {/* Right Extension Line */}
            <line
              x1={width}
              y1={height}
              x2={width}
              y2={height + 15}
              strokeWidth={annotationStrokeWidth * 0.6}
              opacity={0.5}
            />
            {/* Dimension Line with Arrows */}
            <line
              x1={0}
              y1={height + 10}
              x2={width}
              y2={height + 10}
              strokeWidth={annotationStrokeWidth}
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
              strokeWidth={annotationStrokeWidth * 0.6}
              opacity={0.5}
            />
            {/* Bottom Extension Line */}
            <line
              x1={0}
              y1={height}
              x2={-15}
              y2={height}
              strokeWidth={annotationStrokeWidth * 0.6}
              opacity={0.5}
            />
            {/* Dimension Line with Arrows */}
            <line
              x1={-10}
              y1={0}
              x2={-10}
              y2={height}
              strokeWidth={annotationStrokeWidth}
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
            const midX = (dim.x1 + dim.x2) / 2;
            const midY = (dim.y1 + dim.y2) / 2;
            const label = `${dim.distance.toFixed(1)} mm`;
            const fontSize = Math.max(3.0, strokeWidthMultiplier * 9);
            const textW = fontSize * 0.6 * label.length;
            const textH = fontSize * 1.3;
            const rectX = midX - textW / 2;
            const rectY = midY - textH / 2;

            return (
              <g key={dim.id} className="custom-dimension">
                {/* Dashed line */}
                <line
                  x1={dim.x1}
                  y1={dim.y1}
                  x2={dim.x2}
                  y2={dim.y2}
                  stroke="#f43f5e"
                  strokeWidth={Math.max(0.5, strokeWidthMultiplier * 1.2)}
                  strokeDasharray={`${strokeWidthMultiplier * 4},${strokeWidthMultiplier * 2}`}
                />
                {/* End Ticks */}
                <circle cx={dim.x1} cy={dim.y1} r={strokeWidthMultiplier * 2} fill="#f43f5e" />
                <circle cx={dim.x2} cy={dim.y2} r={strokeWidthMultiplier * 2} fill="#f43f5e" />
                {/* Backdrop Rect */}
                <rect
                  x={rectX}
                  y={rectY}
                  width={textW}
                  height={textH}
                  rx={strokeWidthMultiplier * 1.5}
                  ry={strokeWidthMultiplier * 1.5}
                  fill="#0e1012"
                  stroke="#f43f5e"
                  strokeWidth={Math.max(0.3, strokeWidthMultiplier * 0.6)}
                />
                {/* Text Label */}
                <text
                  x={midX}
                  y={midY}
                  fontSize={fontSize}
                  fontFamily="var(--font-mono, monospace)"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#f43f5e"
                  fontWeight="bold"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Render Live Measurement Guideline */}
          {measureMode && startMeasurePt && hoverPt && (
            <g className="live-guideline">
              {/* Dashed line */}
              <line
                x1={startMeasurePt.x}
                y1={startMeasurePt.y}
                x2={hoverPt.snappedX}
                y2={hoverPt.snappedY}
                stroke="#f43f5e"
                strokeWidth={Math.max(0.5, strokeWidthMultiplier * 1.2)}
                strokeDasharray={`${strokeWidthMultiplier * 4},${strokeWidthMultiplier * 2}`}
                opacity={0.7}
              />
              {/* Start point tick */}
              <circle cx={startMeasurePt.x} cy={startMeasurePt.y} r={strokeWidthMultiplier * 2} fill="#f43f5e" />
              
              {/* End point tick */}
              <circle cx={hoverPt.snappedX} cy={hoverPt.snappedY} r={strokeWidthMultiplier * 2} fill="#f43f5e" />

              {/* Live distance text badge */}
              {(() => {
                const midX = (startMeasurePt.x + hoverPt.snappedX) / 2;
                const midY = (startMeasurePt.y + hoverPt.snappedY) / 2;
                const dist = Math.hypot(hoverPt.snappedX - startMeasurePt.x, hoverPt.snappedY - startMeasurePt.y);
                const label = `${dist.toFixed(1)} mm`;
                const fontSize = Math.max(3.0, strokeWidthMultiplier * 9);
                const textW = fontSize * 0.6 * label.length;
                const textH = fontSize * 1.3;
                const rectX = midX - textW / 2;
                const rectY = midY - textH / 2;

                return (
                  <>
                    <rect
                      x={rectX}
                      y={rectY}
                      width={textW}
                      height={textH}
                      rx={strokeWidthMultiplier * 1.5}
                      ry={strokeWidthMultiplier * 1.5}
                      fill="#0e1012"
                      stroke="#f43f5e"
                      strokeWidth={Math.max(0.3, strokeWidthMultiplier * 0.6)}
                      strokeDasharray={`${strokeWidthMultiplier * 2},${strokeWidthMultiplier * 1}`}
                      opacity={0.8}
                    />
                    <text
                      x={midX}
                      y={midY}
                      fontSize={fontSize}
                      fontFamily="var(--font-mono, monospace)"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#f43f5e"
                      fontWeight="bold"
                      opacity={0.9}
                    >
                      {label}
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Render Snap Indicator */}
          {measureMode && hoverPt && hoverPt.isSnapped && (
            <g className="snap-indicator">
              {/* Snap box */}
              <rect
                x={hoverPt.snappedX - (strokeWidthMultiplier * 4)}
                y={hoverPt.snappedY - (strokeWidthMultiplier * 4)}
                width={strokeWidthMultiplier * 8}
                height={strokeWidthMultiplier * 8}
                fill="none"
                stroke="#f43f5e"
                strokeWidth={Math.max(0.5, strokeWidthMultiplier * 1.2)}
              />
              {/* Snap classification text label */}
              <text
                x={hoverPt.snappedX + (strokeWidthMultiplier * 6)}
                y={hoverPt.snappedY}
                fontSize={Math.max(3.0, strokeWidthMultiplier * 8)}
                fontFamily="var(--font-mono, monospace)"
                fill="#f43f5e"
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
            setMeasureMode((m) => !m);
            setStartMeasurePt(null);
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border cursor-pointer ${
            measureMode
              ? "bg-[#f43f5e]/25 text-[#f43f5e] border-[#f43f5e]/40"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/5"
          }`}
          title="Measure Mode (Ruler)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.3 9.7l-9.6 9.6-7.8-7.8 9.6-9.6z" />
            <path d="M12.9 6.9l-1.4 1.4" />
            <path d="M10.1 9.7L8.7 11.1" />
            <path d="M7.3 12.5L5.9 13.9" />
          </svg>
        </button>
        {customDimensions.length > 0 && (
          <button
            onClick={() => {
              setCustomDimensions([]);
              setStartMeasurePt(null);
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
