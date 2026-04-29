"use client";

import React, { useMemo } from "react";
import type { PricingGeometry } from "@/lib/pricing/types";

interface DxfViewerProps {
  geometry: PricingGeometry;
  activeLayers: string[];
}

export function DxfViewer({ geometry, activeLayers }: DxfViewerProps) {
  const { dxfData, boundingWidth, boundingHeight } = geometry;

  const viewBox = useMemo(() => {
    if (!dxfData || boundingWidth === 0 || boundingHeight === 0) return "0 0 100 100";
    const padX = boundingWidth * 0.05;
    const padY = boundingHeight * 0.05;
    // DXF Y-axis is up, SVG Y-axis is down.
    // The geometry minX, minY represent the bottom-left corner in CAD.
    // Since we will scaleY(-1) the SVG element, the effective SVG coordinates 
    // we need for the viewBox must span from minX to maxX, and for Y it will be 
    // from -(minY + boundingHeight) to -minY.
    const startY = -(dxfData.minY + boundingHeight);
    return `${dxfData.minX - padX} ${startY - padY} ${boundingWidth + padX * 2} ${boundingHeight + padY * 2}`;
  }, [dxfData, boundingWidth, boundingHeight]);

  // Determine stroke width relative to the part size to keep lines visible but crisp
  const strokeWidth = useMemo(() => {
    const maxDim = Math.max(boundingWidth, boundingHeight);
    return maxDim > 0 ? maxDim / 400 : 1;
  }, [boundingWidth, boundingHeight]);

  if (!dxfData || dxfData.paths.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#1a1c23] text-gray-500 rounded-lg border border-[#2d303a]">
        No valid geometry available for preview.
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#1a1c23] rounded-lg border border-[#2d303a] shadow-inner flex flex-col">
      <div className="flex-1 relative min-h-[300px]">
        <svg
          viewBox={viewBox}
          className="absolute inset-0 w-full h-full p-4"
          style={{ transform: "scaleY(-1)" }} // Flip Y axis to match CAD coordinates
          preserveAspectRatio="xMidYMid meet"
        >
          {dxfData.paths.map((path) => {
            const isActive = activeLayers.includes(path.layer);
            // Highlight active paths in brand orange (#f97316), inactive in faint grey
            const strokeColor = isActive ? "#f97316" : "#3d404f";
            const opacity = isActive ? 1.0 : 0.2;

            return (
              <path
                key={path.id}
                d={path.svgPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
                className="transition-colors duration-300"
              />
            );
          })}
        </svg>
      </div>

      {/* Overlay info */}
      <div className="absolute bottom-4 left-4 flex gap-4 text-[11px] font-mono text-gray-400 bg-black/60 px-3 py-2 rounded-md backdrop-blur-sm pointer-events-none">
        <span>W: {boundingWidth.toFixed(1)}mm</span>
        <span>H: {boundingHeight.toFixed(1)}mm</span>
      </div>
    </div>
  );
}
