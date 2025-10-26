"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth/useAuth";
import { useSSE } from "../hooks/useSSE";
import api from "../api/axios";
import Card from "../components/Card";
import FileCard from "../components/FileCard";


// Import the modal normally; if you're not using Next.js dynamic, just import:
// import PreviewModal from "../components/PreviewModal";
import PreviewModal from "../components/PreviewModal";

export default function Dashboard({ onNavigate, navExtras = null, clearNavExtras = null }) {
  const { logout } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sseStatus, setSseStatus] = useState("disconnected"); // disconnected | connecting | connected
  const [lastEvent, setLastEvent] = useState(null);

  // preview modal state
  const [previewFile, setPreviewFile] = useState(null);

  const normalizeFilesFromResponse = (responseData) => {
    if (!responseData) return [];
    if (Array.isArray(responseData)) return responseData;
    if (responseData.items) return responseData.items;
    if (responseData.files) return responseData.files;
    if (responseData.data && Array.isArray(responseData.data)) return responseData.data;
    return [];
  };

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/files");
      const items = normalizeFilesFromResponse(response.data);
      setFiles(items);
      setError("");
    } catch (err) {
      console.error("fetchFiles error:", err);
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // If navExtras contains a deletedFileId (navigation from FileDetail), remove it immediately.
  useEffect(() => {
    if (navExtras && navExtras.deletedFileId) {
      const deletedId = String(navExtras.deletedFileId).trim();
      setFiles((prev) =>
        prev.filter((f) => String(f._id) !== deletedId && String(f.id) !== deletedId)
      );
      if (typeof clearNavExtras === "function") clearNavExtras();
    }
  }, [navExtras, clearNavExtras]);

  const patchFile = (fileId, patch) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f._id === fileId || f.id === fileId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
  };

  const refetchFileById = async (fileId) => {
    try {
      const res = await api.get(`/files/${fileId}`);
      const file = res?.data?.file || res?.data;
      if (!file) return;
      setFiles((prev) => {
        const idx = prev.findIndex(
          (f) => f._id === file._id || f.id === file.id || f._id === file.id || f.id === file._id
        );
        if (idx === -1) return [file, ...prev];
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...file };
        return copy;
      });
    } catch (err) {
      console.error("refetchFileById error", err);
    }
  };

  // ✅ Enhanced SSE event handler with real-time status mapping
  const onSseMessage = async (payload) => {
    if (!payload) return;
    setLastEvent(payload);

    const type = payload.type || payload.event || payload.name;
    const fileId = payload.fileId || payload.file?._id || payload.file?.id || payload.id;
    const cid = payload.cid || payload.cidString || payload.CID;
    const thumbCid = payload.thumbCid || payload.thumbnailCid || payload.thumb?.cid;
    const verified = payload.verified;

    setSseStatus("connected");

    // If file:deleted event — remove it from state immediately
    if (type === "file:deleted" && fileId) {
      setFiles((prev) => prev.filter((f) => f._id !== fileId && f.id !== fileId));
      // if previewing this file, close the preview
      if (previewFile && (previewFile._id === fileId || previewFile.id === fileId)) {
        setPreviewFile(null);
      }
      return;
    }

    if (payload.file) {
      const file = payload.file;
      const id = file._id || file.id;
      if (id) {
        setFiles((prev) => {
          const ix = prev.findIndex((f) => f._id === id || f.id === id);
          if (ix === -1) return [file, ...prev];
          const copy = [...prev];
          copy[ix] = { ...copy[ix], ...file };
          return copy;
        });
        // also update preview if it's the same file
        if (previewFile && (previewFile._id === id || previewFile.id === id)) {
          setPreviewFile((p) => ({ ...(p || {}), ...file }));
        }
        return;
      }
    }

    // 🔄 Realtime event-to-status mapping
    switch (type) {
      case "pin:start":
        if (fileId) patchFile(fileId, { status: "pinning" });
        break;
      case "pin:success":
        if (fileId) {
          if (cid) patchFile(fileId, { cid, status: "available" });
          else await refetchFileById(fileId);
        }
        break;
      case "pin:failed":
        if (fileId) patchFile(fileId, { status: "failed" });
        break;
      case "thumb:start":
        if (fileId) patchFile(fileId, { status: "processing" });
        break;
      case "thumb:success":
        if (fileId) {
          const update = { status: "available" };
          if (thumbCid) update.thumbnail = { cid: thumbCid };
          patchFile(fileId, update);
          // if preview is open for this file, update it immediately so thumbnail shows
          if (previewFile && (previewFile._id === fileId || previewFile.id === fileId)) {
            setPreviewFile((p) => ({ ...(p || {}), thumbnail: update.thumbnail }));
          }
        }
        break;
      case "thumb:failed":
        if (fileId) patchFile(fileId, { status: "failed" });
        break;
      case "verify:start":
        if (fileId) patchFile(fileId, { status: "verifying" });
        break;
      case "verify:success":
        if (fileId) patchFile(fileId, { verified: true, status: "verified" });
        break;
      case "verify:failed":
        if (fileId) patchFile(fileId, { verified: false, status: "failed" });
        break;
      default:
        if (fileId) {
          await refetchFileById(fileId);
        }
        break;
    }
  };

  useSSE(onSseMessage, {
    useTokenQuery: true,
    onOpen: () => setSseStatus("connected"),
    onError: () => setSseStatus("disconnected"),
  });

  // Listen for same-tab delete events fired by FileDetail
  useEffect(() => {
    const handler = (e) => {
      const deletedId = e?.detail;
      if (!deletedId) return;
      setFiles((prev) => prev.filter((f) => f._id !== deletedId && f.id !== deletedId));
      if (previewFile && (previewFile._id === deletedId || previewFile.id === deletedId)) {
        setPreviewFile(null);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("dcfs:file-deleted", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("dcfs:file-deleted", handler);
      }
    };
  }, [previewFile]);

  // handler passed to FileCard -> open modal instead of navigating
  const handlePreview = (fileObj) => {
    setPreviewFile(fileObj);
  };

  // ✅ Modified handleNavigate (keeps local behavior too)
  const handleNavigate = (page, fileId = null, extras = {}) => {
    if (extras.deletedFileId) {
      setFiles((prev) =>
        prev.filter((f) => f._id !== extras.deletedFileId && f.id !== extras.deletedFileId)
      );
    }
    if (page) onNavigate && onNavigate(page, fileId);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              SSE:{" "}
              <span className={sseStatus === "connected" ? "text-green-600" : "text-red-500"}>
                {sseStatus}
              </span>
            </div>
            <button onClick={logout} className="btn-secondary ml-4">
              Logout
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button onClick={() => onNavigate && onNavigate("upload")} className="btn-primary">
            📤 Upload File
          </button>
          <button onClick={() => onNavigate && onNavigate("chunk-upload")} className="btn-secondary">
            📦 Chunked Upload
          </button>
          <button onClick={() => fetchFiles()} className="btn-secondary">
            🔄 Refresh
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Files Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-64 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-gray-600 text-lg">No files yet. Upload one to get started!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {files.map((file) => (
              <FileCard
                key={file._id || file.id}
                file={file}
                onClick={() => handleNavigate("file-detail", file._id || file.id)}
                onPreview={handlePreview}
              />
            ))}
          </div>
        )}

        {/* SSE Debug Panel */}
        <div className="mt-6">
          <Card>
            <div className="text-sm text-gray-600 mb-2">SSE Debug (latest event):</div>
            <pre className="text-xs bg-gray-50 p-3 rounded break-words">
              {lastEvent ? JSON.stringify(lastEvent, null, 2) : "— no events yet —"}
            </pre>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
