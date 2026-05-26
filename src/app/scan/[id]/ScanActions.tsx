"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ScanActionsProps {
  remnantId: string;
  initialStatus: string;
}

export default function ScanActions({ remnantId, initialStatus }: ScanActionsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        submitStatusUpdate(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const handleCancel = () => {
    setPendingStatus(null);
    setPin("");
    setError("");
    setSuccess(false);
  };

  const submitStatusUpdate = async (pinCode: string) => {
    if (!pendingStatus) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcErr } = await supabase.rpc("update_remnant_status_with_pin", {
        p_remnant_id: remnantId,
        p_new_status: pendingStatus,
        p_pin: pinCode,
      });

      if (rpcErr) {
        throw rpcErr;
      }

      if (data) {
        setSuccess(true);
        setStatus(pendingStatus);
        setTimeout(() => {
          handleCancel();
          // Reload to fetch the latest server-rendered details
          window.location.reload();
        }, 1500);
      } else {
        setError("Failed to update status.");
        setPin("");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Incorrect PIN or error updating remnant.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: "available", label: "Mark as Available", color: "#4ade80", hoverColor: "rgba(74, 222, 128, 0.15)" },
    { value: "consumed", label: "Mark as Consumed", color: "#ff6600", hoverColor: "rgba(255, 102, 0, 0.15)" },
    { value: "scrapped", label: "Mark as Scrapped", color: "#f87171", hoverColor: "rgba(248, 113, 113, 0.15)" },
  ];

  return (
    <div className="scan-actions-container">
      <style>{`
        .scan-actions-container {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 0 20px;
        }
        .scan-action-title {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 4px;
        }
        .scan-buttons-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .scan-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          color: #fff;
        }
        .scan-action-btn.active {
          background: rgba(255, 255, 255, 0.05);
          border-color: #555;
          opacity: 0.5;
          cursor: not-allowed;
        }
        .scan-action-btn:not(.active):hover {
          background: #222;
          border-color: #444;
          transform: translateY(-1px);
        }
        .pin-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        .pin-modal {
          background: #161616;
          border: 1px solid #2a2a2a;
          border-radius: 24px;
          width: 90%;
          max-width: 360px;
          padding: 30px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          position: relative;
        }
        .pin-modal-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .pin-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }
        .pin-modal-subtitle {
          font-size: 13px;
          color: #888;
        }
        .pin-dots-container {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }
        .pin-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #555;
          transition: all 0.1s ease;
        }
        .pin-dot.filled {
          background: #ff6600;
          border-color: #ff6600;
          box-shadow: 0 0 10px rgba(255, 102, 0, 0.5);
        }
        .pin-keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          width: 100%;
          max-width: 280px;
          margin-bottom: 24px;
        }
        .keypad-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 1px solid #2a2a2a;
          background: #202020;
          color: #fff;
          font-size: 24px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.1s ease;
          user-select: none;
          margin: 0 auto;
        }
        .keypad-btn:active {
          background: #333;
          transform: scale(0.92);
        }
        .keypad-btn.action {
          font-size: 13px;
          font-weight: 500;
          border-color: transparent;
          background: transparent;
          color: #888;
        }
        .keypad-btn.action:active {
          background: rgba(255,255,255,0.05);
          color: #fff;
        }
        .pin-error {
          color: #f87171;
          font-size: 13px;
          text-align: center;
          margin-bottom: 12px;
          min-height: 18px;
          animation: shake 0.2s ease;
        }
        .pin-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 20px 0;
        }
        .success-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(74, 222, 128, 0.1);
          border: 2px solid #4ade80;
          color: #4ade80;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .success-text {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @media (prefers-color-scheme: light) {
          .scan-action-btn {
            background: #fff;
            border-color: #ddd;
            color: #111;
          }
          .scan-action-btn:not(.active):hover {
            background: #f9f9f9;
            border-color: #ccc;
          }
          .pin-modal {
            background: #fff;
            border-color: #e0e0e0;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .pin-modal-title { color: #111; }
          .keypad-btn {
            background: #f0f0f0;
            border-color: #e0e0e0;
            color: #111;
          }
          .keypad-btn:active { background: #e0e0e0; }
        }
      `}</style>

      <div className="scan-action-title">Actions</div>
      <div className="scan-buttons-grid">
        {statusOptions.map((opt) => {
          const isActive = status === opt.value;
          return (
            <button
              key={opt.value}
              className={`scan-action-btn ${isActive ? "active" : ""}`}
              disabled={isActive || loading}
              onClick={() => {
                setPendingStatus(opt.value);
                setPin("");
                setError("");
                setSuccess(false);
              }}
              style={!isActive ? { borderColor: `${opt.color}44`, color: opt.color } : {}}
            >
              {opt.value === "available" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
              {opt.value === "consumed" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              )}
              {opt.value === "scrapped" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                </svg>
              )}
              {opt.label}
            </button>
          );
        })}
      </div>

      {pendingStatus && (
        <div className="pin-modal-overlay">
          <div className="pin-modal">
            {!success ? (
              <>
                <div className="pin-modal-header">
                  <h3 className="pin-modal-title">Enter Operator PIN</h3>
                  <p className="pin-modal-subtitle">
                    Authorize changing status to{" "}
                    <strong>
                      {statusOptions.find((o) => o.value === pendingStatus)?.label.replace("Mark as ", "")}
                    </strong>
                  </p>
                </div>

                <div className="pin-dots-container">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`pin-dot ${pin.length > i ? "filled" : ""}`} />
                  ))}
                </div>

                {error && <div className="pin-error">{error}</div>}

                <div className="pin-keypad">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      className="keypad-btn"
                      onClick={() => handleNumberClick(num)}
                      disabled={loading}
                    >
                      {num}
                    </button>
                  ))}
                  <button className="keypad-btn action" onClick={handleCancel} disabled={loading}>
                    Cancel
                  </button>
                  <button className="keypad-btn" onClick={() => handleNumberClick("0")} disabled={loading}>
                    0
                  </button>
                  <button className="keypad-btn action" onClick={handleBackspace} disabled={loading}>
                    ⌫
                  </button>
                </div>
              </>
            ) : (
              <div className="pin-success">
                <div className="success-icon">✓</div>
                <div className="success-text">Status Updated Successfully</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
