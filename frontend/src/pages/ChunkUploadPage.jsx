"use client";

import React, { useState, useRef } from "react";
import api from "../api/axios";
import Card from "../components/Card";

export default function ChunkUploadPage({ onNavigate }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("file"); // "file" | "zipped-folder"
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [uploadId, setUploadId] = useState(null);
  const chunkSizeRef = useRef(5 * 1024 * 1024); // default 5MB

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null);
    setProgress(0);
    setStatus("");
  };

  // Initialize upload (supports a small flag isFolderZip)
  const initUploadForBlob = async (blob, filename, mime, fileSize, isFolderZip = false) => {
    try {
      setStatus(`Initializing upload for ${filename}...`);
      const res = await api.post("/uploads/init", {
        filename,
        totalChunks: Math.ceil(fileSize / chunkSizeRef.current),
        fileSize,
        mimeType: mime,
        chunkSize: chunkSizeRef.current,
        isFolderZip: !!isFolderZip, // tell backend it is a zipped folder
      });
      setUploadId(res.data.uploadId);
      setStatus(`Upload session created for ${filename}`);
      return res.data.uploadId;
    } catch (err) {
      console.error("Init error", err);
      setStatus(err.response?.data?.error || err.message || "Failed to initialize upload");
      return null;
    }
  };

  // Upload chunks for a blob using uploadId
  const uploadChunksForBlob = async (blob, uploadIdLocal) => {
    if (!uploadIdLocal) throw new Error("missing uploadId");
    const totalChunks = Math.ceil(blob.size / chunkSizeRef.current);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSizeRef.current;
      const end = Math.min(blob.size, start + chunkSizeRef.current);
      const chunk = blob.slice(start, end);

      setStatus(`Uploading chunk ${i + 1}/${totalChunks}...`);
      await api.put(`/uploads/${uploadIdLocal}/chunk`, chunk, {
        headers: { "Content-Type": "application/octet-stream", "x-chunk-index": i },
        onUploadProgress: (ev) => {
          const overall = Math.round(((i + (ev.total ? ev.loaded / ev.total : 0)) / totalChunks) * 100);
          setProgress(overall);
        },
      });
    }

    setStatus("All chunks uploaded. Finalizing...");
    // complete
    await api.post(`/uploads/${uploadIdLocal}/complete`);
    setStatus("✅ Upload complete (Pinning continues in background)");
    setProgress(100);
  };

  // Handler invoked when user clicks Upload button
  const handleStartUpload = async () => {
    try {
      if (!file) return alert("Please select a file first.");

      // If zipped-folder mode: ensure file is .zip
      if (mode === "zipped-folder") {
        const lower = (file.name || "").toLowerCase();
        if (!lower.endsWith(".zip") && file.type !== "application/zip") {
          return setStatus("Please select a .zip file for zipped-folder upload.");
        }
      }

      const filename = file.name;
      const mime = file.type || (mode === "zipped-folder" ? "application/zip" : "application/octet-stream");
      const size = file.size;

      // init
      const id = await initUploadForBlob(file, filename, mime, size, mode === "zipped-folder");
      if (!id) return;

      // upload chunks
      await uploadChunksForBlob(file, id);
    } catch (err) {
      console.error("Upload failed", err);
      const msg = err?.response?.data?.error || err?.message || "Upload failed";
      setStatus(`Upload failed: ${msg}`);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center p-6">
      <Card className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Upload</h1>

        <div className="flex gap-4 items-center">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="mode" value="file" checked={mode === "file"} onChange={() => { setMode("file"); setFile(null); setStatus(""); }} />
            <span>Single file</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="mode" value="zipped-folder" checked={mode === "zipped-folder"} onChange={() => { setMode("zipped-folder"); setFile(null); setStatus(""); }} />
            <span>Upload zipped folder (.zip only)</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {mode === "zipped-folder" ? "Select .zip (zipped folder)" : "Select file"}
          </label>
          <input type="file" accept={mode === "zipped-folder" ? ".zip,application/zip" : "*/*"} onChange={handleFileChange} />
        </div>

        <div className="flex gap-4">
          <button onClick={handleStartUpload} className="btn-primary flex-1" disabled={!file}>
            {mode === "zipped-folder" ? "Upload zipped folder" : "Upload file"}
          </button>

          <button onClick={() => onNavigate && onNavigate("dashboard")} className="btn-secondary flex-1">
            Back
          </button>
        </div>

        <div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-gray-600 mt-2 break-words">{status}</p>
        </div>
      </Card>
    </div>
  );
}
