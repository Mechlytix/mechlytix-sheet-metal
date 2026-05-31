"use client";

import React, { useEffect, useRef, useState } from "react";

// Extend window interface for pdfjsLib
declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

interface HighlightItem {
  value: any;
  box: number[] | null;
}

interface ToleranceItem {
  value: string;
  type: string;
  box: number[];
}

interface Props {
  pdfUrl: string;
  highlights: Record<string, HighlightItem | null | undefined>;
  tolerances?: ToleranceItem[] | null;
  activeField: string | null;
  onHoverField?: (field: string | null) => void;
}

export function PdfDrawingViewer({
  pdfUrl,
  highlights,
  tolerances,
  activeField,
  onHoverField,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [pdfPage, setPdfPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Dynamic script loading for pdf.js to run in browser sandbox
  useEffect(() => {
    if (window.pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      setPdfjsLoaded(true);
    };
    script.onerror = () => {
      setError("Failed to load PDF viewer engine. Check your connection.");
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script if unmounted before loading
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // 2. Load PDF page when pdfjs is loaded and url changes
  useEffect(() => {
    if (!pdfjsLoaded || !pdfUrl) return;

    let active = true;
    setLoading(true);
    setError(null);

    async function loadPDF() {
      try {
        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        if (pdf.numPages === 0) {
          throw new Error("The PDF document is empty.");
        }

        const page = await pdf.getPage(1);
        if (active) {
          setPdfPage(page);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading PDF via PDF.js:", err);
        if (active) {
          setError("Error rendering PDF drawing. Ensure it is a valid PDF.");
          setLoading(false);
        }
      }
    }

    loadPDF();

    return () => {
      active = false;
    };
  }, [pdfjsLoaded, pdfUrl]);

  // 3. Render page onto canvas
  useEffect(() => {
    if (!pdfPage || !canvasRef.current) return;

    let renderTask: any = null;

    function render() {
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");
      if (!context) return;

      // Determine viewport scale to match the container width
      const containerWidth = containerRef.current?.clientWidth || 600;
      const initialViewport = pdfPage.getViewport({ scale: 1 });
      const scale = containerWidth / initialViewport.width;
      
      const viewport = pdfPage.getViewport({ scale: scale * 1.5 }); // 1.5x scale for high crispness
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.style.height = "auto";

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      renderTask = pdfPage.render(renderContext);
      renderTask.promise.catch((err: any) => {
        if (err.name !== "RenderingCancelledException") {
          console.error("PDF page render error:", err);
        }
      });
    }

    render();

    // Re-render on window resize
    const handleResize = () => {
      render();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfPage]);

  // Helper to compile all highlights with key coordinates
  const renderHighlights = () => {
    const list: Array<{ id: string; box: number[]; color: string; label: string }> = [];

    // Colors for different specification components
    const colorMap: Record<string, string> = {
      material: "#10b981",       // Emerald Green
      thickness: "#8b5cf6",      // Violet
      boundingWidth: "#3b82f6",  // Blue
      boundingHeight: "#06b6d4", // Cyan
      bendCount: "#eab308",      // Yellow/Gold
      drawingTitle: "#6366f1",   // Indigo
      quantity: "#f97316",       // Orange
    };

    const labelMap: Record<string, string> = {
      material: "Material",
      thickness: "Thickness",
      boundingWidth: "Flat Width",
      boundingHeight: "Flat Height",
      bendCount: "Bends",
      drawingTitle: "Drawing Title",
      quantity: "Quantity",
    };

    // 1. Standard metadata highlights
    Object.entries(highlights).forEach(([field, item]) => {
      if (item && item.box && item.box.length === 4) {
        list.push({
          id: field,
          box: item.box,
          color: colorMap[field] || "#6b7280",
          label: labelMap[field] || field,
        });
      }
    });

    // 2. Tolerance highlights
    if (tolerances && tolerances.length > 0) {
      tolerances.forEach((tol, index) => {
        if (tol.box && tol.box.length === 4) {
          list.push({
            id: `tolerance-${index}`,
            box: tol.box,
            color: "#ef4444", // Red for tolerances
            label: `Tolerance (${tol.value})`,
          });
        }
      });
    }

    return list;
  };

  const highlightList = renderHighlights();

  return (
    <div
      ref={containerRef}
      className="insights-viewer-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "auto",
        background: "var(--bg-inset)",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      {loading && (
        <div className="insights-viewer-loading">
          <span className="dz-spinner" />
          <p style={{ marginTop: "1rem", fontSize: 13, color: "var(--text-dim)" }}>
            Rendering drawing canvas...
          </p>
        </div>
      )}

      {error && (
        <div className="insights-viewer-error" style={{ textAlign: "center", padding: 24 }}>
          <span style={{ fontSize: 24, display: "block", marginBottom: 8 }}>⚠</span>
          <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div
          className="insights-canvas-wrapper"
          style={{
            position: "relative",
            display: "inline-block",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
            background: "white",
            maxWidth: "100%",
          }}
        >
          <canvas ref={canvasRef} style={{ display: "block" }} />
          
          {/* Transparent absolute overlay container */}
          <div
            className="insights-highlights-overlay"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "auto", // Enable interaction
            }}
          >
            {highlightList.map((hl) => {
              const [ymin, xmin, ymax, xmax] = hl.box;
              
              // Normalize coordinate ranges in case they are inverted by the model
              const yminCorrected = Math.min(ymin, ymax);
              const ymaxCorrected = Math.max(ymin, ymax);
              const xminCorrected = Math.min(xmin, xmax);
              const xmaxCorrected = Math.max(xmin, xmax);

              // Clamp values to the 0-1000 range (translates to 0%-100% overlay bounds)
              const top = Math.max(0, Math.min(100, yminCorrected / 10));
              const left = Math.max(0, Math.min(100, xminCorrected / 10));
              const width = Math.max(0, Math.min(100 - left, (xmaxCorrected - xminCorrected) / 10));
              const height = Math.max(0, Math.min(100 - top, (ymaxCorrected - yminCorrected) / 10));

              const isHovered = activeField === hl.id;

              return (
                <div
                  key={hl.id}
                  style={{
                    position: "absolute",
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    border: isHovered
                      ? `2px solid ${hl.color}`
                      : `1px dashed ${hl.color}80`,
                    background: isHovered ? `${hl.color}20` : `${hl.color}05`,
                    borderRadius: "2px",
                    cursor: "pointer",
                    pointerEvents: "auto",
                    transition: "all 0.15s ease-in-out",
                    boxShadow: isHovered ? `0 0 8px ${hl.color}80` : "none",
                    zIndex: isHovered ? 10 : 2,
                  }}
                  onMouseEnter={() => onHoverField && onHoverField(hl.id)}
                  onMouseLeave={() => onHoverField && onHoverField(null)}
                  title={`${hl.label}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
