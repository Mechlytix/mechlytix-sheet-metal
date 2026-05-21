"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { UnfoldTree } from "@/lib/types/unfold";

type WorkerStatus = "idle" | "initializing" | "parsing" | "ready" | "error";

interface UseGeometryWorkerReturn {
  /** Current status of the kernel */
  status: WorkerStatus;
  /** Error message if status is 'error' */
  error: string | null;
  /** Parsed unfold tree from a STEP file */
  parsedTree: UnfoldTree | null;
  /** Upload and parse a STEP file */
  parseFile: (file: File, kFactor: number) => Promise<void>;
  /** Rebuild the unfold tree around a different base flange */
  rebuildTree: (kFactor: number, baseFlangeIdx?: number) => Promise<void>;
  /** Export the current flat pattern as a DXF string */
  exportDXF: (kFactor: number, baseFlangeIdx?: number) => Promise<string>;
  /** Get the 2D geometry of the flat pattern */
  getFlat2DGeometry: (
    kFactor: number,
    baseFlangeIdx?: number
  ) => Promise<{
    lines: any[];
    arcs: any[];
    circles: any[];
    width: number;
    height: number;
  }>;
  /** Quick topology analysis (no unfold tree) */
  analyzeFile: (
    file: File
  ) => Promise<{
    faceCount: number;
    planeCount: number;
    cylinderCount: number;
  } | null>;
  /** Loading progress message */
  progressMessage: string;
}

export function useGeometryWorker(): UseGeometryWorkerReturn {
  const [status, setStatus] = useState<WorkerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [parsedTree, setParsedTree] = useState<UnfoldTree | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const apiRef = useRef<any>(null);

  // Lazy-load the worker API (only import when needed)
  const getAPI = useCallback(async () => {
    if (apiRef.current) return apiRef.current;
    const { getGeometryAPI } = await import("@/lib/worker/geometry-api");
    apiRef.current = getGeometryAPI();
    return apiRef.current;
  }, []);

  const parseFile = useCallback(
    async (file: File, kFactor: number) => {
      try {
        setError(null);
        setStatus("initializing");
        setProgressMessage("Loading OpenCASCADE kernel (~35MB)...");

        const api = await getAPI();
        await api.initialize();

        setStatus("parsing");
        setProgressMessage(`Parsing ${file.name}...`);

        const buffer = await file.arrayBuffer();
        const tree = await api.parseSTEP(buffer, kFactor);

        setParsedTree(tree as UnfoldTree);
        setStatus("ready");
        setProgressMessage(
          `✓ ${(tree as any).metadata.totalFlanges} flanges, ${(tree as any).metadata.totalBends} bends detected`
        );
      } catch (err: any) {
        setStatus("error");
        setError(err?.message || "Unknown error during STEP parsing");
        setProgressMessage("");
      }
    },
    [getAPI]
  );

  const rebuildTree = useCallback(
    async (kFactor: number, baseFlangeIdx?: number) => {
      try {
        setError(null);
        setStatus("parsing");
        setProgressMessage(`Rebuilding unfold tree around flange ${baseFlangeIdx}...`);

        const api = await getAPI();
        const tree = await api.rebuildTree(kFactor, baseFlangeIdx);

        setParsedTree(tree as UnfoldTree);
        setStatus("ready");
        setProgressMessage(
          `✓ Unfold tree rebuilt around flange ${baseFlangeIdx}`
        );
      } catch (err: any) {
        setStatus("error");
        setError(err?.message || "Unknown error during tree rebuilding");
        setProgressMessage("");
      }
    },
    [getAPI]
  );

  const analyzeFile = useCallback(
    async (file: File) => {
      try {
        const api = await getAPI();
        await api.initialize();
        const buffer = await file.arrayBuffer();
        const result = await api.analyzeSTEP(buffer);
        return result as any;
      } catch {
        return null;
      }
    },
    [getAPI]
  );

  const exportDXF = useCallback(
    async (kFactor: number, baseFlangeIdx?: number): Promise<string> => {
      const api = await getAPI();
      return await api.exportDXF(kFactor, baseFlangeIdx);
    },
    [getAPI]
  );

  const getFlat2DGeometry = useCallback(
    async (
      kFactor: number,
      baseFlangeIdx?: number
    ): Promise<{
      lines: any[];
      arcs: any[];
      circles: any[];
      width: number;
      height: number;
    }> => {
      const api = await getAPI();
      return await api.getFlat2DGeometry(kFactor, baseFlangeIdx);
    },
    [getAPI]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      import("@/lib/worker/geometry-api").then(({ terminateGeometryWorker }) =>
        terminateGeometryWorker()
      );
    };
  }, []);

  return { status, error, parsedTree, parseFile, rebuildTree, exportDXF, getFlat2DGeometry, analyzeFile, progressMessage };
}
