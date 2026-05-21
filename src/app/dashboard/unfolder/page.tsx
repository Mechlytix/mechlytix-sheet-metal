"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useUnfoldAnimation } from "@/hooks/useUnfoldAnimation";
import { useGeometryWorker } from "@/hooks/useGeometryWorker";
import { UnfoldControls } from "@/components/UnfoldControls";
import { ViewToolbar } from "@/components/ViewToolbar";
import { createLBracketMock, createUChannelMock, generateMockDXF } from "@/lib/mock/mock-parts";
import { MaterialPreset, MATERIAL_PRESETS, UnfoldTree } from "@/lib/types/unfold";

// Dynamic import — R3F must not SSR
const R3FViewport = dynamic(
  () => import("@/components/R3FViewport").then((m) => m.R3FViewport),
  { ssr: false }
);
const SheetMetalModel = dynamic(
  () => import("@/components/SheetMetalModel").then((m) => m.SheetMetalModel),
  { ssr: false }
);

type DataSource = "mock" | "kernel";



export default function DashboardPage() {
  const [activePartId, setActivePartId] = useState("l-bracket");
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialPreset>(
    MATERIAL_PRESETS[0]
  );
  const [dataSource, setDataSource] = useState<DataSource>("mock");
  const [baseFlangeIdx, setBaseFlangeIdx] = useState<number | null>(null);
  
  const [viewState, setViewState] = useState({
    wireframe: false,
    showGrid: true,
    transparent: false,
  });

  const { progressRef, state, controls } = useUnfoldAnimation();
  const worker = useGeometryWorker();

  // Mock unfold tree
  const mockTree = useMemo(() => {
    const kFactor = selectedMaterial.kFactor;
    if (activePartId === "u-channel") return createUChannelMock(kFactor);
    return createLBracketMock(kFactor);
  }, [activePartId, selectedMaterial]);

  // Active tree — either mock or from kernel
  const unfoldTree: UnfoldTree = dataSource === "kernel" && worker.parsedTree
    ? worker.parsedTree
    : mockTree;

  const handleMaterialChange = useCallback(
    (preset: MaterialPreset) => {
      setSelectedMaterial(preset);
      controls.reset();
      if (dataSource === "kernel") {
        const currentBaseIdx = baseFlangeIdx !== null 
          ? baseFlangeIdx 
          : parseInt(unfoldTree.rootFlange.id.replace("flange-", ""));
        worker.rebuildTree(preset.kFactor, currentBaseIdx);
      }
    },
    [controls, dataSource, baseFlangeIdx, worker, unfoldTree]
  );

  const handlePartChange = useCallback(
    (partId: string) => {
      setActivePartId(partId);
      setDataSource("mock");
      setBaseFlangeIdx(null);
      controls.reset();
    },
    [controls]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      controls.reset();
      setBaseFlangeIdx(null);
      await worker.parseFile(file, selectedMaterial.kFactor);
      setDataSource("kernel");
    },
    [controls, worker, selectedMaterial.kFactor]
  );

  const handleSelectBaseFlange = useCallback(
    (flangeId: string) => {
      if (dataSource !== "kernel") return;
      const idx = parseInt(flangeId.replace("flange-", ""));
      if (isNaN(idx)) return;
      setBaseFlangeIdx(idx);
      worker.rebuildTree(selectedMaterial.kFactor, idx);
    },
    [dataSource, selectedMaterial.kFactor, worker]
  );

  const handleResetBaseFlange = useCallback(() => {
    if (dataSource !== "kernel") return;
    setBaseFlangeIdx(null);
    worker.rebuildTree(selectedMaterial.kFactor, undefined);
  }, [dataSource, selectedMaterial.kFactor, worker]);

  const handleExportDXF = useCallback(async () => {
    try {
      let dxfString = "";
      if (dataSource === "kernel") {
        dxfString = await worker.exportDXF(
          selectedMaterial.kFactor,
          baseFlangeIdx !== null ? baseFlangeIdx : undefined
        );
      } else {
        dxfString = generateMockDXF(activePartId, selectedMaterial.kFactor);
      }

      const baseName = unfoldTree.metadata.partName.replace(/\.(step|stp)$/i, "");
      const fileName = `${baseName.toLowerCase().replace(/\s+/g, "-")}-flat-pattern.dxf`;

      const blob = new Blob([dxfString], { type: "application/dxf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || "Failed to export DXF");
    }
  }, [dataSource, worker, selectedMaterial.kFactor, baseFlangeIdx, activePartId, unfoldTree]);

  // Determine scale based on data source
  const modelScale = dataSource === "kernel" ? 0.005 : 0.01;

  return (
    <div className="main-content-area" style={{ height: "calc(100vh - 52px)", width: "100%" }}>
      {/* Secondary Sidebar (Controls) */}
      <UnfoldControls
        state={state}
        controls={controls}
        unfoldTree={unfoldTree}
        selectedMaterial={selectedMaterial}
        onMaterialChange={handleMaterialChange}
        onPartChange={handlePartChange}
        activePartId={activePartId}
        onFileUpload={handleFileUpload}
        workerStatus={worker.status}
        onExportDXF={handleExportDXF}
      />

      {/* Viewport Wrapper */}
      <div className="viewport-wrapper">
        <div className="viewport-container">
          <R3FViewport showGrid={viewState.showGrid}>
            <SheetMetalModel
              rootFlange={unfoldTree.rootFlange}
              progressRef={progressRef}
              material={selectedMaterial}
              scale={modelScale}
              wireframe={viewState.wireframe}
              transparent={viewState.transparent}
              onSelectBaseFlange={handleSelectBaseFlange}
            />
          </R3FViewport>
        </div>

        {/* Base Flange Indicator */}
        {dataSource === "kernel" && baseFlangeIdx !== null && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-[#1a1d21]/95 border border-white/10 px-4 py-2 rounded-full flex items-center gap-3 shadow-xl backdrop-blur-md z-40">
            <span className="flex h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs font-semibold text-white/90">
              Base Flange: Flange {baseFlangeIdx}
            </span>
            <button
              onClick={handleResetBaseFlange}
              className="text-[10px] bg-white/10 hover:bg-white/20 text-white/70 hover:text-white px-2.5 py-0.5 rounded-full transition-colors font-medium border border-white/5"
            >
              Reset
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {(worker.status === "initializing" || worker.status === "parsing") && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="loading-spinner" />
              <span className="loading-text">{worker.progressMessage}</span>
            </div>
          </div>
        )}

        {/* Error Toast */}
        {worker.status === "error" && worker.error && (
          <div className="error-toast">
            <span>⚠ {worker.error}</span>
            <button onClick={() => setDataSource("mock")} className="error-dismiss">
              Dismiss
            </button>
          </div>
        )}

        {/* Floating View Toolbar */}
        <ViewToolbar
          wireframe={viewState.wireframe}
          onToggleWireframe={() => setViewState(s => ({ ...s, wireframe: !s.wireframe }))}
          showGrid={viewState.showGrid}
          onToggleGrid={() => setViewState(s => ({ ...s, showGrid: !s.showGrid }))}
          transparent={viewState.transparent}
          onToggleTransparent={() => setViewState(s => ({ ...s, transparent: !s.transparent }))}
        />

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-left">
            <span className={`status-dot ${dataSource === "kernel" ? "kernel" : ""}`} />
            <span>
              {unfoldTree.metadata.partName} — {selectedMaterial.name}
              {dataSource === "kernel" && " (Imported)"}
            </span>
          </div>
          <div className="status-right">
            {worker.status === "ready" && (
              <span className="status-kernel-badge">OCCT ✓</span>
            )}
            <span>
              Flat: {unfoldTree.metadata.flatPatternDimensions.width} ×{" "}
              {unfoldTree.metadata.flatPatternDimensions.height} mm
            </span>
            <span className="status-separator">|</span>
            <span>K = {selectedMaterial.kFactor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
