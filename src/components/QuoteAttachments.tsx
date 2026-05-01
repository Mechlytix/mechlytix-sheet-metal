"use client";

import React, { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Attachment {
  id: string;
  filename: string;
  created_at: string;
  uploads: {
    storage_path: string;
    file_size_bytes: number;
  };
}

interface QuoteAttachmentsProps {
  quoteId: string;
  userId: string;
  initialAttachments: Attachment[];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function QuoteAttachments({ quoteId, userId, initialAttachments }: QuoteAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();

  const handleFileDrop = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    let file: File | null = null;

    if ('dataTransfer' in e) {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else {
      if (e.target.files && e.target.files.length > 0) {
        file = e.target.files[0];
      }
    }

    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Upload to storage
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${userId}/attachments/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("step-files")
        .upload(path, file);

      if (uploadErr || !uploadData) throw new Error(uploadErr?.message || "Upload failed");

      // 2. Create upload record
      const { data: dbUpload, error: dbUploadErr } = await supabase.from("uploads").insert({
        user_id: userId,
        filename: file.name,
        storage_path: path,
        file_size_bytes: file.size,
        file_type: file.type || `application/${ext}`,
        status: "processed"
      }).select("id").single();

      if (dbUploadErr || !dbUpload) throw new Error("Failed to create upload record");

      // 3. Link to quote
      const { data: quoteAttachment, error: linkErr } = await supabase.from("quote_attachments").insert({
        quote_id: quoteId,
        upload_id: dbUpload.id,
        filename: file.name
      }).select(`
        id, filename, created_at,
        uploads!inner ( storage_path, file_size_bytes )
      `).single();

      if (linkErr || !quoteAttachment) throw new Error("Failed to link attachment to quote");

      setAttachments(prev => [...prev, quoteAttachment as unknown as Attachment]);
    } catch (err: unknown) {
      alert(`Error uploading file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  }, [quoteId, userId, supabase]);

  const downloadAttachment = async (path: string, filename: string) => {
    const { data, error } = await supabase.storage.from("step-files").download(path);
    if (error || !data) {
      alert("Failed to download file");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;
    const { error } = await supabase.from("quote_attachments").delete().eq("id", attachmentId);
    if (error) {
      alert("Failed to delete attachment");
      return;
    }
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  return (
    <div className="qd-section-card no-print">
      <h3 className="qd-section-title">Attachments</h3>
      
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center justify-between p-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex-shrink-0 text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-gray-200 truncate">{att.filename}</span>
                  <span className="text-xs text-gray-500">{formatBytes(att.uploads.file_size_bytes)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => downloadAttachment(att.uploads.storage_path, att.filename)}
                  className="p-1.5 text-gray-400 hover:text-[#ff6600] transition-colors rounded hover:bg-[#ff6600]/10"
                  title="Download"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
                <button 
                  onClick={() => deleteAttachment(att.id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded hover:bg-red-400/10"
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div 
        className="border-2 border-dashed border-[#2d303a] rounded-lg p-6 text-center hover:border-[#ff6600]/50 hover:bg-[#ff6600]/5 transition-colors relative cursor-pointer group"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        <input 
          type="file" 
          onChange={handleFileDrop} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Upload attachments"
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#ff6600] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-400">Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-gray-500 group-hover:text-[#ff6600] transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <span className="text-sm text-gray-300 font-medium">Click or drag files to upload</span>
            <span className="text-xs text-gray-500">PDF, DXF, images, or documents</span>
          </div>
        )}
      </div>
    </div>
  );
}
