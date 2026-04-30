"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import type { PricingGeometry, DXFIntent } from "@/lib/pricing/types";

interface DxfViewerProps {
  geometry: PricingGeometry;
  layerIntents: Record<string, DXFIntent>;
  pathIntents: Record<string, DXFIntent>;
  onPathClick: (pathId: string, currentIntent: DXFIntent) => void;
}

export function DxfViewer({ geometry, layerIntents, pathIntents, onPathClick }: DxfViewerProps) {
  const { dxfData, boundingWidth, boundingHeight } = geometry;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!dxfData || dxfData.paths.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#1a1c23] text-gray-500 rounded-lg border border-[#2d303a]">
        No valid geometry available for preview.
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#1a1c23] rounded-lg border border-[#2d303a] shadow-inner flex flex-col group"
    >
      <div className="flex-1 relative min-h-[300px]">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          style={{ transform: "scaleY(-1)", touchAction: "none" }}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {dxfData.paths.map((path) => {
            const currentIntent = pathIntents[path.id] || layerIntents[path.layer] || "cut";
            
            let strokeColor = "#3d404f"; // ignore
            if (currentIntent === "cut") strokeColor = "#f97316"; // orange
            if (currentIntent === "bend") strokeColor = "#3b82f6"; // blue
            
            const opacity = currentIntent === "ignore" ? 0.2 : 1.0;

            return (
              <path
                key={path.id}
                d={path.svgPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth * (currentIntent === "ignore" ? 0.5 : 1.5)} // make cut/bends thicker
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
                className="transition-colors duration-300 hover:stroke-white hover:opacity-100"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragMoved) {
                    onPathClick(path.id, currentIntent);
                  }
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* Toolbar / Overlay info */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button 
          onClick={handleReset}
          className="bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white px-3 py-1.5 rounded-md backdrop-blur-sm text-xs font-medium transition-colors border border-gray-700 pointer-events-auto"
          title="Reset View"
        >
          Reset View
        </button>
      </div>

      <div className="absolute bottom-4 left-4 flex gap-4 text-[11px] font-mono text-gray-400 bg-black/60 px-3 py-2 rounded-md backdrop-blur-sm pointer-events-none">
        <span>W: {boundingWidth.toFixed(1)}mm</span>
        <span>H: {boundingHeight.toFixed(1)}mm</span>
      </div>
    </div>
  );
}
