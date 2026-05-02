"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import type { PricingGeometry, DXFIntent } from "@/lib/pricing/types";

interface DxfViewerProps {
  geometry: PricingGeometry;
  layerIntents?: Record<string, DXFIntent>;
  pathIntents?: Record<string, DXFIntent>;
  onPathClick?: (pathId: string, currentIntent: DXFIntent) => void;
}

export function DxfViewer({ geometry, layerIntents = {}, pathIntents = {}, onPathClick }: DxfViewerProps) {
  const { dxfData, boundingWidth, boundingHeight } = geometry;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(true);

  // Default viewbox calculations
  const defaultViewBox = useMemo(() => {
    if (!dxfData || boundingWidth === 0 || boundingHeight === 0) return { x: 0, y: 0, w: 100, h: 100 };
    const padX = boundingWidth * 0.05;
    const padY = boundingHeight * 0.05;
    const startY = -(dxfData.minY + boundingHeight);
    return {
      x: dxfData.minX - padX,
      y: startY - padY,
      w: boundingWidth + padX * 2,
      h: boundingHeight + padY * 2
    };
  }, [dxfData, boundingWidth, boundingHeight]);

  // Current viewbox state for pan/zoom
  const [vb, setVb] = useState(defaultViewBox);
  
  // Reset view when geometry changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVb(defaultViewBox);
  }, [defaultViewBox]);

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);
  const [lastPt, setLastPt] = useState({ x: 0, y: 0 });

  // Handle Pan
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragMoved(false);
    setLastPt({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || !svgRef.current) return;
    const dx = e.clientX - lastPt.x;
    const dy = e.clientY - lastPt.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setDragMoved(true);
    
    setLastPt({ x: e.clientX, y: e.clientY });

    const rect = svgRef.current.getBoundingClientRect();
    const ratio = Math.max(vb.w / rect.width, vb.h / rect.height);

    setVb(prev => ({
      ...prev,
      x: prev.x - dx * ratio,
      y: prev.y + dy * ratio // +dy because of scaleY(-1) CSS transform
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Handle Zoom (Wheel) using a non-passive ref to prevent default scroll
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = svgEl.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      // Pointer position in current viewBox coordinates
      const ratio = Math.max(vb.w / rect.width, vb.h / rect.height);
      const svgPointerX = vb.x + pointerX * ratio;
      // Because of scaleY(-1), Y is inverted
      const svgPointerY = vb.y + (rect.height - pointerY) * ratio;

      // Zoom factor
      const zoomFactor = Math.exp(e.deltaY * 0.002);
      
      setVb(prev => {
        const newW = prev.w * zoomFactor;
        const newH = prev.h * zoomFactor;
        const newX = svgPointerX - (pointerX * (newW / rect.width));
        const newY = svgPointerY - ((rect.height - pointerY) * (newH / rect.height));

        return { x: newX, y: newY, w: newW, h: newH };
      });
    };

    svgEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => svgEl.removeEventListener("wheel", handleWheel);
  }, [vb]);

  const handleReset = () => {
    setVb(defaultViewBox);
  };

  // Determine stroke width relative to the current zoom level to keep lines crisp
  const strokeWidth = useMemo(() => {
    const maxDim = Math.max(vb.w, vb.h);
    return maxDim > 0 ? maxDim / 400 : 1;
  }, [vb.w, vb.h]);

  // Grid pattern — auto-scales to a sensible spacing
  const gridSpacing = useMemo(() => {
    const maxDim = Math.max(vb.w, vb.h);
    // Choose a grid spacing that gives roughly 8-15 lines across the view
    const raw = maxDim / 10;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const candidates = [1, 2, 5, 10];
    for (const c of candidates) {
      if (c * mag >= raw * 0.5) return c * mag;
    }
    return 10 * mag;
  }, [vb.w, vb.h]);

  if (!dxfData || dxfData.paths.length === 0) {
    return (
      <div className="dxf-viewer-empty">
        No valid geometry available for preview.
      </div>
    );
  }

  // Grid line generation
  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const gs = gridSpacing;
    const startX = Math.floor(vb.x / gs) * gs;
    const endX = Math.ceil((vb.x + vb.w) / gs) * gs;
    const startY = Math.floor(vb.y / gs) * gs;
    const endY = Math.ceil((vb.y + vb.h) / gs) * gs;
    const lines: React.ReactNode[] = [];
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

  return (
    <div 
      ref={containerRef}
      className="dxf-viewer-container"
    >
      <div className="dxf-viewer-canvas">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="dxf-viewer-svg"
          style={{ transform: "scaleY(-1)", touchAction: "none" }}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Grid */}
          {gridLines && (
            <g className="dxf-grid" strokeWidth={strokeWidth * 0.3}>
              {gridLines}
            </g>
          )}

          {/* Paths */}
          {dxfData.paths.map((path) => {
            const currentIntent = pathIntents[path.id] || layerIntents[path.layer] || "cut";
            
            let strokeColor = "var(--dxf-ignore)";
            if (currentIntent === "cut") strokeColor = "var(--dxf-cut)";
            if (currentIntent === "bend") strokeColor = "var(--dxf-bend)";
            
            const opacity = currentIntent === "ignore" ? 0.2 : 1.0;

            return (
              <path
                key={path.id}
                d={path.svgPath}
                fill="none"
                strokeWidth={strokeWidth * (currentIntent === "ignore" ? 0.5 : 1.5)}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`dxf-path dxf-path--${currentIntent}`}
                style={{
                  stroke: strokeColor,
                  opacity,
                  cursor: "pointer",
                  transition: "stroke 0.3s, opacity 0.3s",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragMoved && onPathClick) {
                    onPathClick(path.id, currentIntent);
                  }
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* Toolbar */}
      <div className="dxf-toolbar">
        <button
          className={`dxf-toolbar-btn ${showGrid ? "active" : ""}`}
          onClick={() => setShowGrid(!showGrid)}
          title={showGrid ? "Hide grid" : "Show grid"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        </button>
        <button 
          className="dxf-toolbar-btn"
          onClick={handleReset}
          title="Reset View"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
      </div>

      {/* Dimensions badge */}
      <div className="dxf-dims-badge">
        <span>W: {boundingWidth.toFixed(1)}mm</span>
        <span>H: {boundingHeight.toFixed(1)}mm</span>
      </div>
    </div>
  );
}
