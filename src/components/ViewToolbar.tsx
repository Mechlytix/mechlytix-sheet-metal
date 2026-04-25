"use client";

interface ViewToolbarProps {
  wireframe: boolean;
  onToggleWireframe: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  transparent: boolean;
  onToggleTransparent: () => void;
}

export function ViewToolbar({
  wireframe,
  onToggleWireframe,
  showGrid,
  onToggleGrid,
  transparent,
  onToggleTransparent,
}: ViewToolbarProps) {
  return (
    <div className="view-toolbar">
      <div className="relative group flex justify-center">
        <button 
          className={`toolbar-btn ${showGrid ? 'active' : ''}`} 
          onClick={onToggleGrid}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
        <span className="absolute bottom-full mb-3 px-2 py-1 text-[10px] font-medium text-white bg-[#1a1d21] border border-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-50">
          Toggle Grid
        </span>
      </div>

      <div className="toolbar-divider" />

      <div className="relative group flex justify-center">
        <button 
          className={`toolbar-btn ${wireframe ? 'active' : ''}`} 
          onClick={onToggleWireframe}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>
        <span className="absolute bottom-full mb-3 px-2 py-1 text-[10px] font-medium text-white bg-[#1a1d21] border border-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-50">
          Toggle Wireframe
        </span>
      </div>

      <div className="relative group flex justify-center">
        <button 
          className={`toolbar-btn ${transparent ? 'active' : ''}`} 
          onClick={onToggleTransparent}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeDasharray="4 4" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <span className="absolute bottom-full mb-3 px-2 py-1 text-[10px] font-medium text-white bg-[#1a1d21] border border-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-50">
          Toggle X-Ray
        </span>
      </div>
    </div>
  );
}
