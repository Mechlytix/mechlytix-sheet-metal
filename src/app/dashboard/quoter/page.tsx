"use client";

import { useState, useCallback, useEffect, useRef, useMemo, Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { parseDXFGeometry } from "@/lib/dxf/parse-dxf";
import { calculatePrice } from "@/lib/pricing/cost-model";
import { getFeedRateWithCustom } from "@/lib/pricing/feed-rates";
import { nestParts } from "@/lib/pricing/nest-engine";
import type { NestingPart, NestingSheet, AvailableRemnant } from "@/lib/pricing/nest-engine";
import { formatCurrency, formatLength } from "@/lib/units";
import type { PricingGeometry, PricingResult, DXFIntent, PriceBreak, TierNestingResult, NestingMode, NestingAlgorithm, NestingSortOrder, FileNestingResult } from "@/lib/pricing/types";
import type { Material, MachineProfile, SheetSize } from "@/lib/types/database";
import { DxfViewer } from "@/components/DxfViewer";
import { NestingPreview } from "@/components/NestingPreview";
import { CustomerSelector } from "@/components/CustomerSelector";
import type { CustomerSelection } from "@/components/CustomerSelector";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// /dashboard/quoter  -  Unified STEP / DXF Instant Quoter (Multi-Part)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RemnantMatch {
  id: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  location: string | null;
  material_id: string | null;
  materials: { name: string; color_hex: string | null } | null;
}

type Phase =
  | { name: "idle" }
  | { name: "analyzing"; filenames: string[] }
  | { name: "ready" }
  | { name: "saving" }
  | { name: "saved"; quoteId: string };

interface QuoteItem {
  id: string;
  filename: string;
  geometry: PricingGeometry;
  sourceFile: File | null;
  // Per-part config
  materialId: string;
  machineId: string;
  thickness: number;
  quantity: number;
  markup: number;
  layerIntents: Record<string, DXFIntent>;
  pathIntents: Record<string, DXFIntent>;
  manualBendCount: number | null;
  leadTime: string;
  priceBreaks: PriceBreak[];
}

// â”€â”€â”€ File Drop Zone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DropZone({
  onFiles,
  busy,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) onFiles(droppedFiles);
    },
    [onFiles]
  );

  return (
    <div
      className={`dz-hero ${drag ? "drag-over" : ""} ${busy ? "busy" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !busy && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".step,.stp,.dxf,.pdf"
        style={{ display: "none" }}
        onChange={(e) => { 
          const f = e.target.files; 
          if (f && f.length > 0) onFiles(Array.from(f)); 
        }}
      />

      <div className="dz-hero-glow" />

      {busy ? (
        <>
          <span className="dz-spinner large" />
          <p className="dz-hero-title">Analysing geometry...</p>
          <p className="dz-hero-sub">Extracting dimensions, perimeter and bend data</p>
        </>
      ) : (
        <>
          <div className="dz-hero-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p className="dz-hero-title">Drop your part file to get an instant price</p>
          <p className="dz-hero-sub">Drag &amp; drop or <span className="dz-hero-link">click to browse</span></p>
        </>
      )}
    </div>
  );
}

// â”€â”€â”€ Geometry Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function GeometryCard({ geo, units }: { geo: PricingGeometry; units: string }) {
  const u = units as "metric" | "imperial";
  return (
    <div className="geo-card" style={{ marginBottom: "1rem" }}>
      <div className="geo-grid">
        <div className="geo-item">
          <span className="geo-label">Flat Pattern</span>
          <span className="geo-value">
            {formatLength(geo.boundingWidth, u, 0)} {"\u00D7"} {formatLength(geo.boundingHeight, u, 0)}
          </span>
        </div>
        <div className="geo-item">
          <span className="geo-label">Cut Length</span>
          <span className="geo-value">{formatLength(geo.perimeter, u, 0)}</span>
        </div>
        <div className="geo-item">
          <span className="geo-label">Pierces</span>
          <span className="geo-value">{geo.pierceCount}</span>
        </div>
        <div className="geo-item">
          <span className="geo-label">Bends</span>
          <span className="geo-value">
            {geo.bendCount > 0 ? geo.bendCount : "â€”"}
          </span>
        </div>
        {geo.thickness > 0 && (
          <div className="geo-item">
            <span className="geo-label">Thickness</span>
            <span className={`geo-value ${geo.thicknessConfidence === "detected" ? "detected" : ""}`}>
              {formatLength(geo.thickness, u, 2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Quote Breakdown Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuoteBreakdown({
  result,
  filename,
  onSave,
  saving,
  userId,
}: {
  result: PricingResult;
  filename: string;
  onSave: (contactId: string, companyId: string, notes: string) => void;
  saving: boolean;
  userId: string | null;
}) {
  const [selection, setSelection] = useState<CustomerSelection | null>(null);
  const [notes, setNotes] = useState("");

  const rows = [
    { label: "Material", value: result.materialCostPerPart, note: `${result.weightKg.toFixed(3)} kg` },
    { label: "Cutting", value: result.cuttingCostPerPart, note: `${result.cutTimeMinutes.toFixed(2)} min` },
    { label: "Bending", value: result.bendingCostPerPart, note: null },
    { label: "Setup (per part)", value: result.setupCostPerPart, note: null },
  ];

  const canSave = !!selection;

  return (
    <div className="quote-card">
      <div className="quote-card-header">
        <div>
          <p className="quote-card-filename">{filename}</p>
          <div className="quote-price-display">
            <span className="quote-unit-price">{formatCurrency(result.unitPrice)}</span>
            <span className="quote-per-part">/ part</span>
          </div>
          <p className="quote-total">
            Total ({Math.round(result.totalPrice / result.unitPrice)} parts):{" "}
            <strong>{formatCurrency(result.totalPrice)}</strong>
          </p>
        </div>
      </div>

      <div className="quote-breakdown">
        <h4 className="quote-breakdown-title">Cost Breakdown</h4>
        {rows.map((row) => (
          <div key={row.label} className="breakdown-row">
            <span className="breakdown-label">{row.label}</span>
            {row.note && <span className="breakdown-note">{row.note}</span>}
            <span className="breakdown-value">{formatCurrency(row.value)}</span>
          </div>
        ))}
        <div className="breakdown-row net">
          <span className="breakdown-label">Net cost</span>
          <span className="breakdown-value">{formatCurrency(result.netCostPerPart)}</span>
        </div>
        <div className="breakdown-row markup">
          <span className="breakdown-label">Markup ({result.markupPercent}%)</span>
          <span className="breakdown-value">
            +{formatCurrency(result.unitPrice - result.netCostPerPart)}
          </span>
        </div>
        <div className="breakdown-row total-row">
          <span className="breakdown-label">Unit Price</span>
          <span className="breakdown-value highlight">{formatCurrency(result.unitPrice)}</span>
        </div>
      </div>

      <div className="quote-save-section">
        <div className="form-field">
          <label>Customer</label>
          <CustomerSelector
            userId={userId}
            value={selection?.contactId ?? null}
            onChange={(_id, sel) => setSelection(sel)}
          />
        </div>
        <div className="form-field">
          <label>Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Batch notes..." />
        </div>
        <button
          className="btn-primary"
          onClick={() => selection && onSave(selection.contactId, selection.companyId, notes)}
          disabled={saving || !canSave}
          style={{ width: "100%" }}
        >
          {saving ? "Saving..." : !canSave ? "Select Customer to Save" : "ðŸ’¾ Save Quote"}
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Quoter Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuoterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { units } = useDashboard();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex];

  const [materials, setMaterials] = useState<Material[]>([]);
  const [machines, setMachines]   = useState<MachineProfile[]>([]);
  const [userId, setUserId]       = useState<string | null>(null);
  
  const [defaultMaterialId, setDefaultMaterialId] = useState<string>("");
  const [defaultMachineId, setDefaultMachineId]   = useState<string>("");
  const [defaultMarkup, setDefaultMarkup]         = useState(15);

  const [result, setResult] = useState<PricingResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeItem?.sourceFile && activeItem.geometry.inputType === "pdf") {
      const url = URL.createObjectURL(activeItem.sourceFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPdfUrl(null);
    }
  }, [activeItem]);

  // â”€â”€ Nesting state â”€â”€
  const [ribbonTab, setRibbonTab] = useState<"part" | "nesting" | "pricing">("part");
  
  const [sheetSizes, setSheetSizes] = useState<SheetSize[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>("");
  const [tierNestingResults, setTierNestingResults] = useState<TierNestingResult[]>([]);
  const [selectedNestTierQty, setSelectedNestTierQty] = useState<number | null>(null);
  const [nestingMode, setNestingMode] = useState<NestingMode>("combined");
  const [nestingAlgorithm, setNestingAlgorithm] = useState<NestingAlgorithm>("shelf");
  const [nestingSortOrder, setNestingSortOrder] = useState<NestingSortOrder>("height");
  const [allowRotation, setAllowRotation] = useState(true);
  const [grainLocked, setGrainLocked] = useState(false);
  const [remnants, setRemnants] = useState<AvailableRemnant[]>([]);
  const [saveNotes, setSaveNotes] = useState("");
  const [saveSelection, setSaveSelection] = useState<CustomerSelection | null>(null);

  const [remnantSaveModal, setRemnantSaveModal] = useState<{ w: number; h: number } | null>(null);
  const [remnantSaveLocation, setRemnantSaveLocation] = useState("");
  const [remnantSaveNotes, setRemnantSaveNotes] = useState("");
  const [savingRemnant, startSavingRemnant] = useTransition();
  const [saveRemnantSuccess, setSaveRemnantSuccess] = useState(false);

  const handleSaveLeftover = useCallback((w: number, h: number) => {
    setRemnantSaveModal({ w, h });
    setRemnantSaveLocation("");
    setRemnantSaveNotes(activeItem ? `Leftover remnant from job: ${activeItem.filename}` : "Leftover remnant");
    setSaveRemnantSuccess(false);
  }, [activeItem]);

  const confirmSaveLeftover = async () => {
    if (!userId || !activeItem || !remnantSaveModal) return;

    startSavingRemnant(async () => {
      const supabase = createClient();
      const thickMm = activeItem.thickness || activeItem.geometry.thickness || 1;

      const { data, error } = await supabase.from("remnants").insert({
        user_id: userId,
        material_id: activeItem.materialId,
        width_mm: remnantSaveModal.w,
        height_mm: remnantSaveModal.h,
        thickness_mm: thickMm,
        location: remnantSaveLocation.trim() || null,
        notes: remnantSaveNotes.trim() || null,
        status: "available",
      }).select("id").single();

      if (error || !data) {
        alert(error?.message || "Failed to save remnant.");
        return;
      }

      const scanUrl = `${window.location.origin}/scan/${data.id}`;
      await supabase.from("remnants").update({ qr_code_data: scanUrl }).eq("id", data.id);

      const mat = materials.find(m => m.id === activeItem.materialId);
      const newRem = {
        id: data.id,
        width: remnantSaveModal.w,
        height: remnantSaveModal.h,
        thickness: thickMm,
        location: remnantSaveLocation.trim() || null,
        materialName: mat?.name ?? "Unknown",
      };
      setRemnants(prev => [newRem, ...prev]);

      setSaveRemnantSuccess(true);
      setTimeout(() => setRemnantSaveModal(null), 1500);
    });
  };

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: mats }, { data: machs }, { data: settings }, { data: sheets }, { data: rems }] = await Promise.all([
        supabase.from("materials").select("*").or(`is_system.eq.true,user_id.eq.${user.id}`).order("category").order("name"),
        supabase.from("machine_profiles").select("*").or(`is_system.eq.true,user_id.eq.${user.id}`).order("name"),
        supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("sheet_sizes").select("*").or(`is_system.eq.true,user_id.eq.${user.id}`),
        supabase.from("remnants").select("*, materials(name)").eq("user_id", user.id).eq("status", "available"),
      ]);
      setMaterials(mats ?? []);
      setMachines(machs ?? []);
      setSheetSizes(sheets ?? []);

      // Map remnants to AvailableRemnant shape
      if (rems) {
        setRemnants(rems.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          width: r.width_mm as number,
          height: r.height_mm as number,
          thickness: r.thickness_mm as number,
          location: r.location as string | null,
          materialName: (r.materials as Record<string, unknown> | null)?.name as string ?? "Unknown",
        })));
      }

      if (settings) setDefaultMarkup(settings.default_markup_percent ?? 15);
      if (mats && mats.length > 0) setDefaultMaterialId(mats[0].id);
      if (machs && machs.length > 0) {
        const def = machs.find((m) => m.is_default) ?? machs[0];
        setDefaultMachineId(def.id);
      }
    }
    load();
  }, []);

  // Load item from URL if sent from unfolder
  useEffect(() => {
    if (!userId || !defaultMaterialId || !defaultMachineId) return;

    const queryUnfolded = searchParams.get("unfolded");
    if (queryUnfolded !== "true") return;

    // Check if we already loaded this item
    if (items.length > 0) return;

    const filename = searchParams.get("filename") || "unfolded-part.step";
    const width = parseFloat(searchParams.get("width") || "0");
    const height = parseFloat(searchParams.get("height") || "0");
    const thickness = parseFloat(searchParams.get("thickness") || "0");
    const bends = parseInt(searchParams.get("bends") || "0");
    const materialName = searchParams.get("material") || "";
    
    // Find matching material
    let matchedMaterialId = defaultMaterialId;
    if (materialName) {
      const match = materials.find(m => 
        m.name.toLowerCase().includes(materialName.toLowerCase()) ||
        materialName.toLowerCase().includes(m.name.toLowerCase())
      );
      if (match) matchedMaterialId = match.id;
    }

    const geometry: PricingGeometry = {
      inputType: "step",
      boundingWidth: width,
      boundingHeight: height,
      partArea: width * height * 0.9,
      perimeter: 2 * (width + height),
      pierceCount: 0,
      bendCount: bends,
      bendAngles: [],
      thickness: thickness,
      thicknessConfidence: "detected",
    };

    const newItem: QuoteItem = {
      id: Math.random().toString(36).substring(2, 9),
      filename,
      geometry,
      sourceFile: null,
      materialId: matchedMaterialId,
      machineId: defaultMachineId,
      thickness,
      quantity: 1,
      markup: defaultMarkup,
      layerIntents: {},
      pathIntents: {},
      manualBendCount: null,
      leadTime: "3-5 days",
      priceBreaks: [],
    };

    setItems([newItem]);
    setActiveIndex(0);
    setPhase({ name: "ready" });
  }, [userId, defaultMaterialId, defaultMachineId, materials, searchParams, defaultMarkup]);

  const updateActiveItem = useCallback((patch: Partial<QuoteItem>) => {
    setItems(prev => prev.map((item, i) => i === activeIndex ? { ...item, ...patch } : item));
  }, [activeIndex]);

  const effectiveGeometry = useMemo(() => {
    if (!activeItem) return null;
    const geo = activeItem.geometry;
    if (geo.inputType !== "dxf" || !geo.dxfData) return geo;

    let newPerimeter = 0;
    let newPierceCount = 0;
    let autoBendCount = 0;

    geo.dxfData.paths.forEach((p) => {
      const intent = activeItem.pathIntents[p.id] || activeItem.layerIntents[p.layer] || "cut";
      if (intent === "cut") { newPerimeter += p.length; newPierceCount++; }
      else if (intent === "bend") { autoBendCount++; }
    });

    return {
      ...geo,
      perimeter: newPerimeter,
      pierceCount: newPierceCount,
      bendCount: activeItem.manualBendCount ?? autoBendCount,
    };
  }, [activeItem]);

  // Recalculation logic for active item AND all price breaks
  useEffect(() => {
    if (!effectiveGeometry || !activeItem || (phase.name !== "ready" && phase.name !== "saving")) { 
      setResult(null); 
      return; 
    }

    const mat  = materials.find((m) => m.id === activeItem.materialId);
    const mach = machines.find((m)  => m.id === activeItem.machineId);
    if (!mat || !mach) return;

    const geo  = effectiveGeometry;
    let thickMm = activeItem.thickness || geo.thickness || 1;
    const feedRate = getFeedRateWithCustom(mach.feed_rates, mat.category, thickMm, mach.power_kw ?? 4);

    // 1. Primary Result
    const r = calculatePrice({
      geometry: { ...geo, thickness: thickMm },
      materialCostPerKg: mat.cost_per_kg, materialDensityKgM3: mat.density_kg_m3, scrapValuePerKg: mat.scrap_value_per_kg ?? 0,
      machineHourlyRate: mach.hourly_rate, feedRateMmPerMin: feedRate, pierceTimeSeconds: mach.pierce_time_seconds ?? 0.5,
      setupTimeMinutes: mach.setup_time_minutes ?? 15, costPerBend: mach.cost_per_bend ?? 2.5,
      quantity: activeItem.quantity, markupPercent: activeItem.markup, wasteFactor: 1.15,
    });
    setResult(r);

    // 2. Refresh all price breaks
    const updatedBreaks = activeItem.priceBreaks.map(pb => {
      const tierResult = calculatePrice({
        geometry: { ...geo, thickness: thickMm },
        materialCostPerKg: mat.cost_per_kg, materialDensityKgM3: mat.density_kg_m3, scrapValuePerKg: mat.scrap_value_per_kg ?? 0,
        machineHourlyRate: mach.hourly_rate, feedRateMmPerMin: feedRate, pierceTimeSeconds: mach.pierce_time_seconds ?? 0.5,
        setupTimeMinutes: mach.setup_time_minutes ?? 15, costPerBend: mach.cost_per_bend ?? 2.5,
        quantity: pb.quantity, markupPercent: activeItem.markup, wasteFactor: 1.15,
      });

      const m = pb.overrides.material ?? tierResult.materialCostPerPart;
      const c = pb.overrides.cutting  ?? tierResult.cuttingCostPerPart;
      const b = pb.overrides.bending  ?? tierResult.bendingCostPerPart;
      const s = pb.overrides.setup    ?? tierResult.setupCostPerPart;
      const markup = pb.overrides.markup ?? activeItem.markup;

      const net = m + c + b + s;
      const unit = net * (1 + markup / 100);

      return {
        ...pb,
        materialCostPerPart: m, cuttingCostPerPart: c, bendingCostPerPart: b, setupCostPerPart: s,
        setupCostTotal: tierResult.setupCostTotal, unitPrice: unit, totalPrice: unit * pb.quantity,
      };
    });

    if (JSON.stringify(updatedBreaks) !== JSON.stringify(activeItem.priceBreaks)) {
      updateActiveItem({ priceBreaks: updatedBreaks });
    }

  }, [phase.name, activeItem, effectiveGeometry, materials, machines, updateActiveItem]);

  // â”€â”€ Nesting computation (reactive) â”€â”€
  const kerfGapMm = useMemo(() => {
    if (!activeItem) return 5;
    const mach = machines.find(m => m.id === activeItem.machineId);
    return mach?.kerf_gap_mm ?? 5;
  }, [activeItem, machines]);

  const [localKerfGap, setLocalKerfGap] = useState(5);
  useEffect(() => { setLocalKerfGap(kerfGapMm); }, [kerfGapMm]);

  // Filter sheet sizes by selected material+thickness
  const filteredSheetSizes = useMemo(() => {
    if (!activeItem) return [];
    const mat = materials.find(m => m.id === activeItem.materialId);
    if (!mat) return [];
    const thick = activeItem.thickness || activeItem.geometry.thickness || 0;
    return sheetSizes.filter(s =>
      s.material_id === activeItem.materialId &&
      (thick <= 0 || Math.abs(s.thickness_mm - thick) < 0.01)
    );
  }, [activeItem, materials, sheetSizes]);

  // Auto-select first sheet size when filter changes
  useEffect(() => {
    if (filteredSheetSizes.length > 0 && !filteredSheetSizes.find(s => s.id === selectedSheetId)) {
      setSelectedSheetId(filteredSheetSizes[0].id);
    }
  }, [filteredSheetSizes, selectedSheetId]);

  // â”€â”€ Compute nesting for ALL tiers â”€â”€
  useEffect(() => {
    if (!activeItem || items.length === 0 || (phase.name !== "ready" && phase.name !== "saving")) {
      setTierNestingResults([]);
      setSelectedNestTierQty(null);
      return;
    }

    const selectedSheet = filteredSheetSizes.find(s => s.id === selectedSheetId);
    if (!selectedSheet) {
      setTierNestingResults([]);
      setSelectedNestTierQty(null);
      return;
    }

    const sheet: NestingSheet = {
      width: selectedSheet.width_mm,
      height: selectedSheet.height_mm,
      costPerSheet: selectedSheet.cost_per_sheet,
    };

    const matchingRemnants = remnants.filter(r => {
      const thick = activeItem.thickness || activeItem.geometry.thickness || 0;
      return thick <= 0 || Math.abs(r.thickness - thick) < 0.5;
    });

    const config = { kerfGapMm: localKerfGap, allowRotation, grainLocked, algorithm: nestingAlgorithm, sortOrder: nestingSortOrder };
    const baseQty = activeItem.quantity;

    // All tier quantities: base + every price break
    const allTierQtys = [
      { qty: baseQty, isBase: true },
      ...activeItem.priceBreaks.map(pb => ({ qty: pb.quantity, isBase: false })),
    ];

    // Helper: build NestingPart[] for a given tier quantity
    function buildParts(tierQty: number): NestingPart[] {
      const scale = baseQty > 0 ? tierQty / baseQty : 1;
      return items.map(item => ({
        id: item.id,
        filename: item.filename,
        width: item.geometry.boundingWidth,
        height: item.geometry.boundingHeight,
        area: item.geometry.partArea || item.geometry.boundingWidth * item.geometry.boundingHeight * 0.8,
        quantity: Math.max(1, Math.round(item.quantity * scale)),
        svgPaths: item.geometry.dxfData?.paths
          .filter(p => {
            const intent = item.pathIntents[p.id] || item.layerIntents[p.layer] || "cut";
            return intent === "cut";
          })
          .map(p => p.svgPath),
        svgMinX: item.geometry.dxfData?.minX ?? 0,
        svgMinY: item.geometry.dxfData?.minY ?? 0,
      }));
    }

    const results: TierNestingResult[] = allTierQtys.map(({ qty, isBase }) => {
      if (nestingMode === "combined") {
        const combined = nestParts(buildParts(qty), sheet, config, matchingRemnants);
        return { quantity: qty, isBase, combined };
      } else {
        // Individual: nest each file separately
        const scale = baseQty > 0 ? qty / baseQty : 1;
        const perFile: FileNestingResult[] = items.map(item => {
          const part: NestingPart = {
            id: item.id,
            filename: item.filename,
            width: item.geometry.boundingWidth,
            height: item.geometry.boundingHeight,
            area: item.geometry.partArea || item.geometry.boundingWidth * item.geometry.boundingHeight * 0.8,
            quantity: Math.max(1, Math.round(item.quantity * scale)),
            svgPaths: item.geometry.dxfData?.paths
              .filter(p => {
                const intent = item.pathIntents[p.id] || item.layerIntents[p.layer] || "cut";
                return intent === "cut";
              })
              .map(p => p.svgPath),
            svgMinX: item.geometry.dxfData?.minX ?? 0,
            svgMinY: item.geometry.dxfData?.minY ?? 0,
          };
          return {
            itemId: item.id,
            filename: item.filename,
            result: nestParts([part], sheet, config, matchingRemnants),
          };
        });
        return { quantity: qty, isBase, perFile };
      }
    });

    setTierNestingResults(results);
    // Auto-select base tier if nothing selected yet, or keep existing selection if valid
    setSelectedNestTierQty(prev => {
      const validQtys = results.map(r => r.quantity);
      if (prev !== null && validQtys.includes(prev)) return prev;
      return baseQty;
    });
  }, [items, activeItem, selectedSheetId, filteredSheetSizes, localKerfGap, allowRotation, grainLocked, remnants, phase.name, nestingMode, nestingAlgorithm, nestingSortOrder]);

  const onFiles = useCallback(async (files: File[]) => {
    setPhase({ name: "analyzing", filenames: files.map(f => f.name) });
    const newItems: QuoteItem[] = [];

    try {
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !["step", "stp", "dxf", "pdf"].includes(ext)) continue;

        let geo: PricingGeometry;
        const initialIntents: Record<string, DXFIntent> = {};
        let quantityOverride = 1;
        let materialIdOverride = defaultMaterialId;

        if (ext === "pdf") {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/parse-pdf", {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to parse PDF: ${errorText}`);
          }
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }

          // Try to match material from materials list
          if (data.material) {
            const matched = materials.find(m => 
              m.name.toLowerCase().includes(data.material.toLowerCase()) ||
              data.material.toLowerCase().includes(m.name.toLowerCase())
            );
            if (matched) materialIdOverride = matched.id;
          }
          
          if (data.quantity && data.quantity > 0) {
            quantityOverride = data.quantity;
          }

          geo = {
            inputType: "pdf",
            boundingWidth: data.boundingWidth || 0,
            boundingHeight: data.boundingHeight || 0,
            partArea: (data.boundingWidth || 0) * (data.boundingHeight || 0),
            perimeter: 2 * ((data.boundingWidth || 0) + (data.boundingHeight || 0)),
            pierceCount: 0,
            bendCount: data.bendCount || 0,
            bendAngles: [],
            thickness: data.thickness || 0,
            thicknessConfidence: data.thickness ? "detected" : "required",
          };
        } else if (ext === "dxf") {
          const text = await file.text();
          geo = parseDXFGeometry(text);
          if (geo.dxfData) geo.dxfData.layers.forEach(l => { initialIntents[l.name] = l.intent || "cut"; });
        } else {
          const { getGeometryAPI } = await import("@/lib/worker/geometry-api");
          const api = getGeometryAPI();
          await api.initialize();
          const buffer = await file.arrayBuffer();
          const raw = await api.extractPricingGeometry(buffer);
          geo = {
            inputType: "step", boundingWidth: raw.boundingWidth, boundingHeight: raw.boundingHeight,
            partArea: raw.partArea, perimeter: raw.perimeter, pierceCount: raw.pierceCount,
            bendCount: raw.bendCount, bendAngles: raw.bendAngles, thickness: raw.thickness,
            thicknessConfidence: raw.thickness > 0 ? "detected" : "required",
          };
        }

        newItems.push({
          id: Math.random().toString(36).substr(2, 9), filename: file.name, geometry: geo, sourceFile: file,
          materialId: materialIdOverride, machineId: defaultMachineId, thickness: geo.thickness || 0,
          quantity: quantityOverride, markup: defaultMarkup, layerIntents: initialIntents, pathIntents: {},
          manualBendCount: null, leadTime: "7-10 Days", priceBreaks: []
        });
      }

      setItems(prev => {
        const updated = [...prev, ...newItems];
        if (prev.length === 0 && updated.length > 0) setActiveIndex(0);
        return updated;
      });
      setPhase({ name: "ready" });
    } catch (err) {
      alert(`Error analysing files: ${err instanceof Error ? err.message : String(err)}`);
      setPhase({ name: "idle" });
    }
  }, [defaultMaterialId, defaultMachineId, defaultMarkup, materials]);

  const handleSave = useCallback(async (contactId: string, companyId: string, notes: string) => {
    if (phase.name !== "ready" || items.length === 0 || !userId) return;
    setPhase({ name: "saving" });

    const supabase = createClient();
    const groupId = crypto.randomUUID();
    let firstQuoteId = "";

    try {
      for (const item of items) {
        const mat  = materials.find((m) => m.id === item.materialId);
        const mach = machines.find((m)  => m.id === item.machineId);
        if (!mat || !mach) continue;

        const thickMm = item.thickness || item.geometry.thickness || 1;
        const feedRate = getFeedRateWithCustom(mach.feed_rates, mat.category, thickMm, mach.power_kw ?? 4);

        let effGeo = item.geometry;
        if (effGeo.inputType === "dxf" && effGeo.dxfData) {
          let newPerimeter = 0, newPierceCount = 0, autoBendCount = 0;
          effGeo.dxfData.paths.forEach((p) => {
            const intent = item.pathIntents[p.id] || item.layerIntents[p.layer] || "cut";
            if (intent === "cut") { newPerimeter += p.length; newPierceCount++; }
            else if (intent === "bend") { autoBendCount++; }
          });
          effGeo = { ...effGeo, perimeter: newPerimeter, pierceCount: newPierceCount, bendCount: item.manualBendCount ?? autoBendCount };
        }

        const r = calculatePrice({
          geometry: { ...effGeo, thickness: thickMm },
          materialCostPerKg: mat.cost_per_kg, materialDensityKgM3: mat.density_kg_m3, scrapValuePerKg: mat.scrap_value_per_kg ?? 0,
          machineHourlyRate: mach.hourly_rate, feedRateMmPerMin: feedRate, pierceTimeSeconds: mach.pierce_time_seconds ?? 0.5,
          setupTimeMinutes: mach.setup_time_minutes ?? 15, costPerBend: mach.cost_per_bend ?? 2.5,
          quantity: item.quantity, markupPercent: item.markup, wasteFactor: 1.15,
        });

        let uploadId = null;
        if (item.sourceFile) {
          const path = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${item.sourceFile.name.split(".").pop()}`;
          const { data: uploadData } = await supabase.storage.from("step-files").upload(path, item.sourceFile);
          if (uploadData) {
            const { data: dbUpload } = await supabase.from("uploads").insert({
              user_id: userId, filename: item.sourceFile.name, storage_path: path,
              file_size_bytes: item.sourceFile.size,
              file_type: item.sourceFile.name.toLowerCase().endsWith(".dxf")
                ? "dxf"
                : item.sourceFile.name.toLowerCase().endsWith(".pdf")
                ? "pdf"
                : "step",
              status: "completed"
            }).select("id").single();
            if (dbUpload) uploadId = dbUpload.id;
          }
        }

        const { data: quoteData, error: quoteErr } = await supabase.from("quotes").insert({
          user_id: userId, group_id: groupId, filename: item.filename,
          input_type: effGeo.inputType, bounding_width_mm: effGeo.boundingWidth, bounding_height_mm: effGeo.boundingHeight,
          perimeter_mm: effGeo.perimeter, pierce_count: effGeo.pierceCount, part_area_mm2: effGeo.partArea,
          bend_count: effGeo.bendCount, thickness_mm: r.thicknessMm, material_id: item.materialId, machine_id: item.machineId,
          quantity: item.quantity, markup_percent: item.markup, material_cost: r.materialCostPerPart,
          cutting_cost: r.cuttingCostPerPart, bending_cost: r.bendingCostPerPart, setup_cost: r.setupCostTotal,
          unit_price: r.unitPrice, total_price: r.totalPrice,
          customer_id: contactId, company_id: companyId, notes: notes,
          status: "draft", upload_id: uploadId, price_breaks: item.priceBreaks, lead_time: item.leadTime
        }).select("id").single();

        if (quoteData && !firstQuoteId) firstQuoteId = quoteData.id;
        if (quoteErr) throw quoteErr;
      }
      router.push(`/dashboard/quotes/${firstQuoteId}`);
    } catch (err) {
      alert("Failed to save quotes: " + (err instanceof Error ? err.message : String(err)));
      setPhase({ name: "ready" });
    }
  }, [items, userId, materials, machines]);

  // Tier Management Logic
  const addTier = (qty: number) => {
    if (qty <= 0 || activeItem.priceBreaks.some(pb => pb.quantity === qty)) return;
    const newTier = { 
        quantity: qty, unitPrice: 0, totalPrice: 0,
        materialCostPerPart: 0, cuttingCostPerPart: 0, bendingCostPerPart: 0, 
        setupCostPerPart: 0, setupCostTotal: 0, leadTime: activeItem.leadTime,
        overrides: { material: null, cutting: null, bending: null, setup: null, markup: null }
    };
    updateActiveItem({
      priceBreaks: [...activeItem.priceBreaks, newTier].sort((a,b) => a.quantity - b.quantity)
    });
  };

  const removeTier = (idx: number) => {
    const next = [...activeItem.priceBreaks];
    next.splice(idx, 1);
    updateActiveItem({ priceBreaks: next });
  };

  const updateOverride = (idx: number, field: keyof PriceBreak["overrides"], val: string) => {
    const parsed = parseFloat(val);
    const newVal = isNaN(parsed) ? null : parsed;
    updateActiveItem({
      priceBreaks: activeItem.priceBreaks.map((pb, i) => i === idx ? {
        ...pb, overrides: { ...pb.overrides, [field]: newVal }
      } : pb)
    });
  };
  
  const updateTierLeadTime = (idx: number, val: string) => {
    updateActiveItem({
      priceBreaks: activeItem.priceBreaks.map((pb, i) => i === idx ? { ...pb, leadTime: val } : pb)
    });
  };

  if (phase.name === "saved") {
    return (
      <div className="dash-page">
        <div className="quote-saved-banner">
          <span className="qs-icon">âœ“</span>
          <div><h2>Batch Quote Saved</h2><p>All items have been linked and saved to your history.</p></div>
          <div className="qs-actions">
            <a href={`/dashboard/quotes/${phase.quoteId}`} className="btn-primary">View Quote History {"\u2192"}</a>
            <button className="btn-ghost" onClick={() => { setItems([]); setActiveIndex(0); setPhase({ name: "idle" }); }}>New Batch</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quoter-workspace">

      {/* ══ Drop Zone overlay (idle / analyzing) ══ */}
      {(phase.name === "idle" || phase.name === "analyzing") && (
        <div className="quoter-dropzone-overlay">
          <DropZone onFiles={onFiles} busy={phase.name === "analyzing"} />
        </div>
      )}

      {/* ══ TOOLBAR ══ */}
      <div className="quoter-toolbar">
        <div className="quoter-toolbar-left">
          <span className="quoter-brand">Instant Quoter</span>
          {(phase.name === "ready" || phase.name === "saving") && activeItem && (
            <div className="part-tabs-bar">
              {items.map((item, idx) => (
                <button key={item.id}
                  className={`part-tab ${activeIndex === idx ? "active" : ""}`}
                  onClick={() => setActiveIndex(idx)}>
                  <span className="part-tab-name">{item.filename.replace(/\.[^.]+$/, "")}</span>
                  <span className="part-tab-meta">×{item.quantity}</span>
                  {items.length > 1 && (
                    <span className="part-tab-close" onClick={(e) => {
                      e.stopPropagation();
                      setItems(prev => {
                        const next = prev.filter((_, i) => i !== idx);
                        setActiveIndex(Math.min(activeIndex, next.length - 1));
                        return next;
                      });
                    }}>×</span>
                  )}
                </button>
              ))}
              <button className="part-tab-add" onClick={() => setPhase({ name: "idle" })}>+ Add Part</button>
            </div>
          )}
        </div>
        <div className="quoter-toolbar-right">
          {result && <span className="quoter-unit-badge">{formatCurrency(result.unitPrice)} / part</span>}
          <button
            className={`btn-primary quoter-save-btn ${phase.name === "saving" ? "loading" : ""}`}
            disabled={phase.name === "saving" || !saveSelection || !result}
            onClick={() => saveSelection && handleSave(saveSelection.contactId, saveSelection.companyId, saveNotes)}
          >
            {phase.name === "saving" ? "Saving…" : "💾 Save Quote"}
          </button>
        </div>
      </div>

      {/* ══ RIBBON TAB BAR ══ */}
      {(phase.name === "ready" || phase.name === "saving") && activeItem && (
        <div className="quoter-ribbon">
          <button className={`quoter-ribbon-tab ${ribbonTab === "part" ? "active" : ""}`} onClick={() => setRibbonTab("part")}>
            Part Config
          </button>
          <button className={`quoter-ribbon-tab ${ribbonTab === "nesting" ? "active" : ""}`} onClick={() => setRibbonTab("nesting")}>
            Nesting
          </button>
          <button className={`quoter-ribbon-tab ${ribbonTab === "pricing" ? "active" : ""}`} onClick={() => setRibbonTab("pricing")}>
            Pricing Details
          </button>
        </div>
      )}

      {/* ══ MAIN WORKSPACE ══ */}
      {(phase.name === "ready" || phase.name === "saving") && activeItem && (
        <>
          <div className="quoter-body">
            
            {/* ── PART TAB ── */}
            {ribbonTab === "part" && (
              <div className="quoter-tab-body">
                <div className="quoter-centre">
                  {activeItem.geometry.inputType === "pdf" && pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        background: "var(--bg-secondary)",
                        borderRadius: "8px",
                      }}
                      title="PDF Drawing Preview"
                    />
                  ) : (
                    <DxfViewer
                      geometry={activeItem.geometry}
                      layerIntents={activeItem.layerIntents}
                      pathIntents={activeItem.pathIntents}
                      onPathIntentChange={(pid, intent) =>
                        updateActiveItem({ pathIntents: { ...activeItem.pathIntents, [pid]: intent } })
                      }
                    />
                  )}
                </div>
                <div className="quoter-panel">
                  <div className="qrd-content">
                    <div className="form-field">
                      <label>Material</label>
                      <select value={activeItem.materialId} onChange={e => updateActiveItem({ materialId: e.target.value })}>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.grade})</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Machine</label>
                      <select value={activeItem.machineId} onChange={e => updateActiveItem({ machineId: e.target.value })}>
                        {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div className="side-config-row">
                      <div className="form-field">
                        <label>Qty</label>
                        <input type="number" value={activeItem.quantity}
                          onChange={e => updateActiveItem({ quantity: Math.max(1, +e.target.value) })} />
                      </div>
                      <div className="form-field">
                        <label>Markup %</label>
                        <input type="number" value={activeItem.markup}
                          onChange={e => updateActiveItem({ markup: Math.max(0, +e.target.value) })} />
                      </div>
                    </div>
                    <div className="form-field">
                      <label>Lead Time</label>
                      <input type="text" value={activeItem.leadTime}
                        onChange={e => updateActiveItem({ leadTime: e.target.value })} />
                    </div>

                    {result && (
                      <div className="qrd-cost-summary">
                        <div className="qrd-cost-row"><span>Material</span><span>{formatCurrency(result.materialCostPerPart)}</span></div>
                        <div className="qrd-cost-row"><span>Cutting</span><span>{formatCurrency(result.cuttingCostPerPart)}</span></div>
                        <div className="qrd-cost-row"><span>Bending</span><span>{formatCurrency(result.bendingCostPerPart)}</span></div>
                        <div className="qrd-cost-row"><span>Setup / part</span><span>{formatCurrency(result.setupCostPerPart)}</span></div>
                        <div className="qrd-cost-row net"><span>Net</span><span>{formatCurrency(result.netCostPerPart)}</span></div>
                        <div className="qrd-cost-row unit"><span>Unit Price</span><strong>{formatCurrency(result.unitPrice)}</strong></div>
                      </div>
                    )}
                    
                    {/* DXF Layers Panel */}
                    {activeItem.geometry.inputType === "dxf" && activeItem.geometry.dxfData && (
                      <div className="dxf-layers-panel" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                        <p className="dxf-layers-title">DXF Layers</p>
                        <p className="dxf-layers-hint">Click lines in viewer or assign below</p>
                        <div className="dxf-layers-list">
                          {activeItem.geometry.dxfData.layers.map(layer => {
                            const currentIntent = activeItem.layerIntents[layer.name] || "cut";
                            return (
                              <div key={layer.name} className="dxf-layer-row">
                                <div className="dxf-layer-info">
                                  <div className="dxf-layer-dot" style={{ background: layer.color }} />
                                  <span className="dxf-layer-name">{layer.name}</span>
                                  <span className="dxf-layer-count">({layer.entityCount})</span>
                                </div>
                                <div className="layer-intent-toggle">
                                  {(["cut", "bend", "ignore"] as DXFIntent[]).map(intent => (
                                    <button key={intent}
                                      className={`layer-intent-btn ${currentIntent === intent ? "active" : ""} layer-intent-btn--${intent}`}
                                      onClick={() => updateActiveItem({ layerIntents: { ...activeItem.layerIntents, [layer.name]: intent } })}>
                                      {intent}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── NESTING TAB ── */}
            {ribbonTab === "nesting" && (
              <div className="quoter-tab-body">
                <div className="quoter-centre">
                  <NestingPreview
                    tierResults={tierNestingResults}
                    selectedTierQty={selectedNestTierQty}
                    nestingMode={nestingMode}
                    onSaveLeftover={handleSaveLeftover}
                  />
                </div>
                <div className="quoter-panel">
                  <div className="qrd-content">
                    <div className="qrd-section">
                      <p className="qrd-section-label">Algorithm</p>
                      <div className="qrd-seg">
                        {([["shelf", "Shelf"], ["guillotine", "Guillotine"], ["strip", "Strip"]] as const).map(([val, label]) => (
                          <button key={val}
                            className={`qrd-seg-btn ${nestingAlgorithm === val ? "active" : ""}`}
                            onClick={() => setNestingAlgorithm(val)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="qrd-section">
                      <p className="qrd-section-label">Sort Order</p>
                      <div className="qrd-seg">
                        {([["height", "Height↓"], ["area", "Area↓"], ["width", "Width↓"]] as const).map(([val, label]) => (
                          <button key={val}
                            className={`qrd-seg-btn ${nestingSortOrder === val ? "active" : ""}`}
                            onClick={() => setNestingSortOrder(val)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="qrd-section">
                      <p className="qrd-section-label">Mode</p>
                      <div className="qrd-seg">
                        <button className={`qrd-seg-btn ${nestingMode === "combined" ? "active" : ""}`}
                          onClick={() => setNestingMode("combined")}>Combined</button>
                        <button className={`qrd-seg-btn ${nestingMode === "individual" ? "active" : ""}`}
                          onClick={() => setNestingMode("individual")}>Individual</button>
                      </div>
                    </div>

                    <div className="qrd-section">
                      <p className="qrd-section-label">Options</p>
                      <div className="form-field">
                        <label>Kerf Gap (mm)</label>
                        <input type="number" value={localKerfGap} step={0.5} min={0} max={20}
                          onChange={e => setLocalKerfGap(Math.max(0, parseFloat(e.target.value) || 0))} />
                      </div>
                      <div className="qrd-toggles">
                        <button className={`nest-toggle-btn ${allowRotation ? "active" : ""}`}
                          onClick={() => setAllowRotation(p => !p)}>
                          Rotation
                        </button>
                        <button className={`nest-toggle-btn ${grainLocked ? "active warn" : ""}`}
                          onClick={() => setGrainLocked(p => { if (!p) setAllowRotation(false); return !p; })}>
                          Grain Lock
                        </button>
                      </div>
                    </div>

                    {tierNestingResults.length > 0 && (
                      <div className="qrd-section">
                        <p className="qrd-section-label">Preview Tier</p>
                        <div className="nest-tier-selector">
                          {tierNestingResults.map(t => {
                            const sheets = nestingMode === "combined"
                              ? t.combined?.totalSheets
                              : t.perFile?.reduce((s, f) => s + f.result.totalSheets, 0);
                            return (
                              <button key={t.quantity}
                                className={`nest-tier-btn ${selectedNestTierQty === t.quantity ? "active" : ""}`}
                                onClick={() => setSelectedNestTierQty(t.quantity)}>
                                <span className="nest-tier-btn-qty">
                                  {t.quantity} pc{t.quantity !== 1 ? "s" : ""}
                                  {t.isBase && <span className="nest-tier-btn-base">&nbsp;Base</span>}
                                </span>
                                {sheets != null && (
                                  <span className="nest-tier-btn-sheets">{sheets} sh</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="qrd-section">
                      <p className="qrd-section-label">Sheet Size</p>
                      {filteredSheetSizes.length > 0 ? (
                        <select className="nest-sheet-select" value={selectedSheetId}
                          onChange={e => setSelectedSheetId(e.target.value)}>
                          {filteredSheetSizes.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.width_mm} × {s.height_mm}mm
                              {s.thickness_mm ? ` (${s.thickness_mm}mm)` : ""}
                              {s.cost_per_sheet ? ` — £${s.cost_per_sheet}` : ""}
                              {s.in_stock === false ? " (out of stock)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="qrd-empty-hint">
                          No sheet sizes for this material/thickness.{" "}
                          <a href="/dashboard/materials">Add sheet sizes →</a>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PRICING TAB ── */}
            {ribbonTab === "pricing" && (
              <div className="quoter-tab-body is-pricing">
                <div className="qbs-table-wrap" style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                  <table className="quoter-tier-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th className="qbs-th-qty">QTY</th>
                        <th>MATERIAL</th>
                        <th>CUTTING</th>
                        <th>BENDING</th>
                        <th>SETUP</th>
                        {tierNestingResults.length > 0 && <>
                          <th className="tier-table-nesting-col">SHEETS</th>
                          <th className="tier-table-nesting-col">UTIL%</th>
                        </>}
                        <th>MARKUP%</th>
                        <th>LEAD TIME</th>
                        <th>UNIT PRICE</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Base row */}
                      <tr>
                        <td className="qbs-qty-cell">{activeItem.quantity} <small>Base</small></td>
                        {(() => {
                          const baseNest = tierNestingResults.find(t => t.isBase);
                          const sheetCost = nestingMode === "combined"
                            ? baseNest?.combined?.totalMaterialCost
                            : baseNest?.perFile?.reduce((s, f) => s + (f.result.totalMaterialCost ?? 0), 0);
                          const matCost = sheetCost != null ? sheetCost / activeItem.quantity : (result?.materialCostPerPart ?? 0);
                          const cut = result?.cuttingCostPerPart ?? 0;
                          const bend = result?.bendingCostPerPart ?? 0;
                          const setup = result?.setupCostPerPart ?? 0;
                          const unitPrice = sheetCost != null
                            ? (matCost + cut + bend + setup) * (1 + activeItem.markup / 100)
                            : (result?.unitPrice ?? 0);
                          return (<>
                            <td className={`tier-val-auto${sheetCost != null ? " tier-val-nesting" : ""}`}>{formatCurrency(matCost)}</td>
                            <td className="tier-val-auto">{formatCurrency(cut)}</td>
                            <td className="tier-val-auto">{formatCurrency(bend)}</td>
                            <td className="tier-val-auto">{formatCurrency(setup)}</td>
                            {tierNestingResults.length > 0 && <>
                              <td className="tier-table-nesting-col">{baseNest?.[nestingMode === "combined" ? "combined" : "combined"]?.totalSheets ?? baseNest?.perFile?.reduce((s,f)=>s+f.result.totalSheets,0) ?? "—"}</td>
                              <td className="tier-table-nesting-col">{nestingMode === "combined" ? (baseNest?.combined?.overallUtilisation != null ? `${baseNest.combined.overallUtilisation}%` : "—") : "—"}</td>
                            </>}
                            <td className="tier-val-auto">{activeItem.markup}%</td>
                            <td className="tier-val-auto" style={{ textAlign: "left" }}>{activeItem.leadTime}</td>
                            <td className="tier-val-highlight">{formatCurrency(unitPrice)}</td>
                            <td></td>
                          </>);
                        })()}
                      </tr>
                      {/* Price break rows */}
                      {activeItem.priceBreaks.map((pb, i) => {
                        const pbNest = tierNestingResults.find(t => t.quantity === pb.quantity);
                        const sheetCost = nestingMode === "combined"
                          ? pbNest?.combined?.totalMaterialCost
                          : pbNest?.perFile?.reduce((s, f) => s + (f.result.totalMaterialCost ?? 0), 0);
                        const matCost = sheetCost != null ? sheetCost / pb.quantity : (pb.overrides.material ?? pb.materialCostPerPart);
                        const cut = pb.overrides.cutting ?? pb.cuttingCostPerPart;
                        const bend = pb.overrides.bending ?? pb.bendingCostPerPart;
                        const setup = pb.overrides.setup ?? pb.setupCostPerPart;
                        const markup = pb.overrides.markup ?? activeItem.markup;
                        const unitPrice = (matCost + cut + bend + setup) * (1 + markup / 100);
                        const nestSheets = nestingMode === "combined" ? pbNest?.combined?.totalSheets : pbNest?.perFile?.reduce((s,f)=>s+f.result.totalSheets,0);
                        const nestUtil = nestingMode === "combined" ? pbNest?.combined?.overallUtilisation : undefined;
                        return (
                          <tr key={i}>
                            <td>
                              <input type="number" className="tier-editable-input qbs-qty-input" value={pb.quantity}
                                onChange={e => updateActiveItem({ priceBreaks: activeItem.priceBreaks.map((p, idx) => idx === i ? { ...p, quantity: Math.max(1, +e.target.value) } : p) })} />
                            </td>
                            <td className={`tier-val-auto${sheetCost != null ? " tier-val-nesting" : ""}`}>{formatCurrency(matCost)}</td>
                            <td className="tier-val-auto">{formatCurrency(cut)}</td>
                            <td className="tier-val-auto">{formatCurrency(bend)}</td>
                            <td className="tier-val-auto">{formatCurrency(setup)}</td>
                            {tierNestingResults.length > 0 && <>
                              <td className="tier-table-nesting-col">{nestSheets ?? "—"}</td>
                              <td className="tier-table-nesting-col">{nestUtil != null ? `${nestUtil}%` : "—"}</td>
                            </>}
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <input className={`tier-editable-input ${pb.overrides.markup !== null ? "overridden" : ""}`}
                                  value={pb.overrides.markup ?? activeItem.markup}
                                  onChange={e => updateOverride(i, "markup", e.target.value)}
                                  style={{ width: 36, textAlign: "right", padding: 0 }} />
                                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>%</span>
                              </div>
                            </td>
                            <td>
                              <input className="tier-editable-input" value={pb.leadTime ?? ""}
                                onChange={e => updateTierLeadTime(i, e.target.value)}
                                style={{ textAlign: "left", padding: 0 }} />
                            </td>
                            <td className="tier-val-highlight">{formatCurrency(unitPrice)}</td>
                            <td><button className="btn-tier-remove" onClick={() => removeTier(i)}>×</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="qbs-add-tier" style={{ marginTop: '12px' }}>
                    <input type="number" className="tier-add-input" placeholder="Add qty…"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (val) { addTier(val); (e.target as HTMLInputElement).value = ""; }
                        }
                      }} />
                    <span className="tier-add-hint">↵ Enter to add tier</span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ══ BOTTOM FOOTER ══ */}
          <div className="quoter-bottom-footer">
            <div className="qbs-footer">
              <div className="qbs-geometry-summary">
                {effectiveGeometry && (() => {
                  const u = units as "metric" | "imperial";
                  const geo = effectiveGeometry;
                  return (
                    <span className="geo-inline-summary">
                      <strong>Geometry:</strong> {formatLength(geo.boundingWidth, u, 0)} × {formatLength(geo.boundingHeight, u, 0)} · {formatLength(geo.perimeter, u, 0)} cut · {geo.pierceCount} pierces · {geo.bendCount > 0 ? `${geo.bendCount} bends` : "flat"}
                    </span>
                  );
                })()}
              </div>
              <div className="qbs-save-area">
                <div style={{ minWidth: 220 }}>
                  <CustomerSelector userId={userId} value={saveSelection?.contactId ?? null}
                    onChange={(_id, sel) => setSaveSelection(sel)} />
                </div>
                <textarea rows={1} value={saveNotes} onChange={e => setSaveNotes(e.target.value)}
                  placeholder="Notes…" className="qbs-notes" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Remnant Save Modal */}
      {remnantSaveModal && (
        <div style={{ zIndex: 1000, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: "16px", width: "90%", maxWidth: "400px", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#fff", margin: 0 }}>Log Offcut as Remnant</h2>
              <button onClick={() => setRemnantSaveModal(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "18px" }}>✕</button>
            </div>
            {saveRemnantSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(74,222,128,0.1)", border: "2px solid #4ade80", color: "#4ade80", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>✓</div>
                <p style={{ color: "#fff", fontWeight: 600, fontSize: "15px", margin: 0 }}>Remnant Logged in Scrap Rack!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "10px", border: "1px solid #2a2a2a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
                    <span style={{ color: "#888" }}>Dimensions</span>
                    <strong style={{ color: "#fff" }}>{remnantSaveModal.w} × {remnantSaveModal.h} mm</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
                    <span style={{ color: "#888" }}>Material</span>
                    <strong style={{ color: "#fff" }}>{materials.find(m => m.id === activeItem?.materialId)?.name || "Unknown"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span style={{ color: "#888" }}>Thickness</span>
                    <strong style={{ color: "#fff" }}>{activeItem?.thickness || activeItem?.geometry.thickness || 1} mm</strong>
                  </div>
                </div>
                <div className="form-field">
                  <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "6px" }}>Rack Location</label>
                  <input
                    type="text"
                    value={remnantSaveLocation}
                    onChange={e => setRemnantSaveLocation(e.target.value)}
                    placeholder="e.g. Rack B, Shelf 4"
                    style={{ background: "#202020", border: "1px solid #2a2a2a", borderRadius: "8px", color: "#fff", padding: "10px", width: "100%", outline: "none" }}
                  />
                </div>
                <div className="form-field">
                  <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "6px" }}>Notes</label>
                  <textarea
                    rows={2}
                    value={remnantSaveNotes}
                    onChange={e => setRemnantSaveNotes(e.target.value)}
                    style={{ background: "#202020", border: "1px solid #2a2a2a", borderRadius: "8px", color: "#fff", padding: "10px", width: "100%", resize: "none", outline: "none" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "12px", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => setRemnantSaveModal(null)} disabled={savingRemnant}>Cancel</button>
                  <button className="btn-primary" onClick={confirmSaveLeftover} disabled={savingRemnant}>
                    {savingRemnant ? "Saving…" : "Save Remnant"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuoterPage() {
  return (
    <Suspense fallback={<div className="dash-page"><div className="loading-state">Loading…</div></div>}>
      <QuoterPageContent />
    </Suspense>
  );
}
