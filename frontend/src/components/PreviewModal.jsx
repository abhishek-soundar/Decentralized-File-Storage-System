"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * PreviewModal
 *
 * Props:
 * - file: file object (expects at least filename, mimeType, thumbnail?.cid, cid, createdAt, size)
 * - onClose: () => void
 *
 * Behavior:
 * - Detects image vs video by mimeType
 * - Shows thumbnail/full gateway URL using cid if available
 * - Zoom controls via scale state
 * - Close on Esc or clicking backdrop or clicking X
 */
export default function PreviewModal({ file, onClose }) {
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        onClose && onClose();
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(3, Math.round((s + 0.25) * 100) / 100));
      } else if (e.key === "-") {
        setScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100));
      } else if (e.key === "0") {
        setScale(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // reset scale when file changes
    setScale(1);
    setLoading(true);
  }, [file?.thumbnail?.cid, file?.cid, file?.id]);

  if (!file) return null;

  const isImage = (file.mimeType || "").startsWith("image");
  const isVideo = (file.mimeType || "").startsWith("video");
  // prefer thumbnail for preview if exists; otherwise use cid (full file)
  const cidToUse = file.thumbnail?.cid || file.cid || file?.thumbnailCid;
  const baseUrl = cidToUse
    ? `https://gateway.pinata.cloud/ipfs/${cidToUse}`
    : file.url || null;

  const humanSize = (bytes) => {
    if (!bytes && bytes !== 0) return "—";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const created = file.createdAt ? new Date(file.createdAt).toLocaleString() : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onMouseDown={(e) => {
        // close when clicking backdrop (but not when clicking children)
        if (e.target === e.currentTarget) {
          onClose && onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        className="relative max-w-6xl w-full mx-4 md:mx-8 bg-white rounded shadow-lg overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <div className="font-semibold text-sm truncate max-w-[40ch]">{file.filename}</div>
            <div className="text-xs text-gray-500">{file.mimeType} • {humanSize(file.size)}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-600 mr-2">{created}</div>

            <button
              onClick={() => setScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100))}
              className="px-2 py-1 text-sm border rounded bg-white hover:shadow-sm"
              title="Zoom out (-)"
            >
              −
            </button>
            <button
              onClick={() => setScale(1)}
              className="px-2 py-1 text-sm border rounded bg-white hover:shadow-sm"
              title="Reset (0)"
            >
              100%
            </button>
            <button
              onClick={() => setScale((s) => Math.min(3, Math.round((s + 0.25) * 100) / 100))}
              className="px-2 py-1 text-sm border rounded bg-white hover:shadow-sm"
              title="Zoom in (+)"
            >
              +
            </button>

            <button
              onClick={() => {
                // trigger download of full file if cid exists (open in new tab)
                if (file.cid) {
                  const url = `${(import.meta.env.VITE_API_BASE || "http://localhost:4000/api/v1")}/files/${String(file._id || file.id || file.cid)}/download`;
                  window.open(url, "_blank");
                } else if (baseUrl) {
                  window.open(baseUrl, "_blank");
                }
              }}
              className="px-2 py-1 text-sm border rounded bg-white hover:shadow-sm"
              title="Open/download"
            >
              ⤓
            </button>

            <button
              onClick={() => onClose && onClose()}
              className="ml-2 px-3 py-1 text-sm rounded bg-red-50 text-red-700 hover:bg-red-100"
              aria-label="Close preview"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <div
              className="relative"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                transition: "transform 120ms ease-out",
                maxWidth: "100%",
                maxHeight: "80vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isImage && baseUrl ? (
                <img
                  src={baseUrl}
                  alt={file.filename}
                  onLoad={() => setLoading(false)}
                  onError={() => setLoading(false)}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              ) : isVideo && baseUrl ? (
                <video
                  src={baseUrl}
                  controls
                  onLoadedData={() => setLoading(false)}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              ) : baseUrl ? (
                <a href={baseUrl} target="_blank" rel="noreferrer" className="underline">
                  Open file
                </a>
              ) : (
                <div className="text-gray-500">No preview available</div>
              )}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-gray-500 text-sm">Loading preview…</div>
                </div>
              )}
            </div>
          </div>

          {/* Right metadata column on larger screens */}
          <div className="w-full md:w-72 border-l p-4 bg-gray-50">
            <div className="text-sm text-gray-700 mb-3">
              <div className="font-semibold">Details</div>
              <div className="mt-2 text-xs text-gray-600">
                <div><strong>Filename:</strong> {file.filename}</div>
                <div><strong>Size:</strong> {humanSize(file.size)}</div>
                <div><strong>Type:</strong> {file.mimeType || "—"}</div>
                <div className="truncate"><strong>CID:</strong> {file.cid || (file.thumbnail && file.thumbnail.cid) || "—"}</div>
                <div><strong>Created:</strong> {created}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Actions</div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    // copy public gateway URL if available
                    const publicUrl = baseUrl || (file.cid ? `https://gateway.pinata.cloud/ipfs/${file.cid}` : null);
                    if (!publicUrl) return;
                    navigator.clipboard?.writeText(publicUrl).then(() => {
                      // small visual toast would be ideal; keep console fallback
                      // alert('Copied preview URL to clipboard');
                    }).catch(()=>{});
                  }}
                  className="px-3 py-2 text-sm border rounded bg-white hover:shadow-sm text-left"
                >
                  Copy preview URL
                </button>

                <button
                  onClick={() => {
                    // open in new tab
                    const openUrl = file.cid ? `https://gateway.pinata.cloud/ipfs/${file.cid}` : baseUrl;
                    if (openUrl) window.open(openUrl, "_blank");
                  }}
                  className="px-3 py-2 text-sm border rounded bg-white hover:shadow-sm text-left"
                >
                  Open in new tab
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
