"use client";

import { useRef, useState, useCallback } from "react";
import {
  UnfoldAnimationState,
  UnfoldAnimationControls,
} from "@/hooks/useUnfoldAnimation";
import { UnfoldTree, MaterialPreset, MATERIAL_PRESETS } from "@/lib/types/unfold";

interface UnfoldControlsProps {
  state: UnfoldAnimationState;
  controls: UnfoldAnimationControls;
  unfoldTree: UnfoldTree | null;
  selectedMaterial: MaterialPreset;
  onMaterialChange: (preset: MaterialPreset) => void;
  onPartChange: (partId: string) => void;
  activePartId: string;
  onFileUpload?: (file: File) => void;
  workerStatus?: string;
}

export function UnfoldControls({
  state,
  controls,
  unfoldTree,
  selectedMaterial,
  onMaterialChange,
  onPartChange,
  activePartId,
  onFileUpload,
  workerStatus,
}: UnfoldControlsProps) {
  const progressPercent = Math.round(state.progress * 100);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.toLowerCase();
      if (ext.endsWith(".step") || ext.endsWith(".stp")) {
        onFileUpload?.(file);
      } else {
        alert("Please upload a .STEP or .STP file");
      }
    },
    [onFileUpload]
  );

  return (
    <div className="controls-panel">
      {/* Part Selector */}
      <div className="panel-section">
        <label className="section-label">Demo Part</label>
        <div className="part-selector">
          {["l-bracket", "u-channel"].map((id) => (
            <button
              key={id}
              className={`part-btn ${activePartId === id ? "active" : ""}`}
              onClick={() => onPartChange(id)}
            >
              {id === "l-bracket" ? "L-Bracket" : "U-Channel"}
            </button>
          ))}
        </div>
      </div>

      {/* Part Info */}
      {unfoldTree && (
        <div className="panel-section">
          <label className="section-label">Part Information</label>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Name</span>
              <span className="info-value">{unfoldTree.metadata.partName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Flanges</span>
              <span className="info-value">{unfoldTree.metadata.totalFlanges}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Bends</span>
              <span className="info-value">{unfoldTree.metadata.totalBends}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Thickness</span>
              <span className="info-value">{unfoldTree.metadata.thickness} mm</span>
            </div>
            <div className="info-item">
              <span className="info-label">Flat Width</span>
              <span className="info-value">
                {unfoldTree.metadata.flatPatternDimensions.width} mm
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Flat Height</span>
              <span className="info-value">
                {unfoldTree.metadata.flatPatternDimensions.height} mm
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Material Selector */}
      <div className="panel-section">
        <label className="section-label">Material</label>
        <div className="material-list">
          {MATERIAL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              className={`material-btn ${selectedMaterial.name === preset.name ? "active" : ""}`}
              onClick={() => onMaterialChange(preset)}
            >
              <span
                className="material-swatch"
                style={{ backgroundColor: preset.color }}
              />
              <div className="material-info">
                <span className="material-name">{preset.name}</span>
                <span className="material-kf">K = {preset.kFactor}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Animation Controls */}
      <div className="panel-section">
        <label className="section-label">Unfold Animation</label>

        {/* Progress bar */}
        <div className="progress-container">
          <input
            type="range"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => controls.scrubTo(Number(e.target.value) / 100)}
            className="progress-slider"
          />
          <div className="progress-labels">
            <span>Folded</span>
            <span className="progress-percent">{progressPercent}%</span>
            <span>Flat</span>
          </div>
        </div>

        {/* Playback buttons */}
        <div className="playback-row">
          <button className="ctrl-btn" onClick={controls.reset} title="Reset">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          <button className="ctrl-btn primary" onClick={controls.toggle} title={state.isPlaying ? "Pause" : "Play"}>
            {state.isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Speed control */}
          <div className="speed-control">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                className={`speed-btn ${state.speed === s ? "active" : ""}`}
                onClick={() => controls.setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upload STEP File */}
      <div className="panel-section">
        <label className="section-label">Upload STEP File</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".step,.stp"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div
          className={`upload-zone ${isDragOver ? "drag-over" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.5}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="upload-text">
            {isDragOver ? "Drop it!" : "Drop .STEP file here"}
          </span>
          <span className="upload-hint">
            {workerStatus === "initializing"
              ? "Loading kernel..."
              : workerStatus === "parsing"
              ? "Parsing..."
              : "or click to browse"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="panel-footer">
        <span>Mechlytix v0.1.0 — MVP Spike</span>
      </div>
    </div>
  );
}
