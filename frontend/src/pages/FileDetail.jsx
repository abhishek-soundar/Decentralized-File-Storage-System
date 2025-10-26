"use client";

import React, { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import Card from "../components/Card";
import { useSSE } from "../hooks/useSSE";
import ShareModal from "../components/ShareModal";

export default function FileDetail({ fileId, onNavigate }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // ✅ new state for inline confirmation

  const fetchFile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/files/${fileId}`);
      setFile(res.data.file || res.data);
    } catch (err) {
      setMsg(err.response?.data?.error || "Failed to fetch file");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (fileId) fetchFile();
  }, [fileId, fetchFile]);

  // SSE updates
  useSSE((payload) => {
    if (!payload) return;
    if (
      payload.fileId &&
      (payload.fileId === fileId ||
        payload.file?.id === fileId ||
        payload.file?._id === fileId)
    ) {
      fetchFile();
    }
  });

  const handleVerify = async () => {
    if (!fileId) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await api.post(`/files/${fileId}/verify`);
      if (res.status === 202) setMsg("Verification queued");
      else setMsg(res.data.message || "Verification started");
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Failed to queue verify");
    } finally {
      setBusy(false);
    }
  };

  // ✅ simplified delete handler (no alert)
  const handleDelete = async () => {
    if (!fileId) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await api.delete(`/files/${fileId}`);
      if (res.data && res.data.ok) {
        setMsg("Deletion requested. File marked deleted.");

        try {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("dcfs:file-deleted", { detail: String(fileId) })
            );
          }
        } catch (e) {}

        console.debug(
          "FileDetail: navigating back to dashboard with deletedFileId",
          fileId
        );

        if (onNavigate)
          onNavigate("dashboard", null, { deletedFileId: String(fileId) });
      } else {
        setMsg(res.data?.error || "Delete requested");
      }
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Delete failed");
    } finally {
      setBusy(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDownload = async () => {
    if (!fileId) return;
    setBusy(true);
    setMsg("");
    try {
      const token = localStorage.getItem("dcfs_token");
      const resp = await fetch(
        `${
          import.meta.env.VITE_API_BASE || "http://localhost:4000/api/v1"
        }/files/${fileId}/download`,
        {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        }
      );
      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        throw new Error(
          (json && (json.error || json.message)) || `Download failed: ${resp.status}`
        );
      }

      const disposition = resp.headers.get("Content-Disposition");
      let filename = file?.filename || "download";
      if (disposition) {
        const match =
          /filename\*=UTF-8''(.+)|filename="(.+)"/.exec(disposition);
        if (match) filename = decodeURIComponent(match[1] || match[2]);
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMsg("Download started");
    } catch (err) {
      setMsg(err.message || "Download failed");
    } finally {
      setBusy(false);
    }
  };

  if (!fileId) return <div className="p-6">No file selected</div>;
  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">File details</h2>

          {/* ✅ Buttons horizontally aligned */}
          <div className="flex flex-row flex-wrap gap-2">
            <button
              onClick={() => onNavigate && onNavigate("dashboard")}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              onClick={handleDownload}
              className="btn-primary"
              disabled={busy}
            >
              Download
            </button>
            <button
              onClick={handleVerify}
              className="btn-secondary"
              disabled={busy || file.verificationPending}
            >
              Verify
            </button>
            <button
              onClick={() => setShowShare(true)}
              className="btn-secondary"
            >
              Share
            </button>

            {/* 🔴 Delete confirmation logic */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={busy}
                className="btn-secondary border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Delete
              </button>
            ) : (
              <div className="flex flex-col gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="text-red-700 font-medium">Are you sure you want to delete this file?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="btn-secondary bg-red-600 text-white hover:bg-red-700"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={busy}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{file.filename}</h3>
            <div className="text-sm text-gray-600">
              Size: {file.size ? `${Math.round(file.size / 1024)} KB` : "—"}
            </div>
            <div className="text-sm text-gray-600">
              Type: {file.mimeType || "—"}
            </div>
            <div className="text-sm text-gray-600">
              Status: {file.status || "—"}
            </div>
            {file.cid && (
              <div className="text-sm text-gray-600 truncate">CID: {file.cid}</div>
            )}
            {file.verified && (
              <div className="text-sm text-green-600 font-semibold">
                Verified ✓
              </div>
            )}
            {file.verificationPending && (
              <div className="text-sm text-yellow-600">Verification pending...</div>
            )}
            {file.thumbnail?.cid && (
              <div className="mt-4">
                <img
                  src={`https://gateway.pinata.cloud/ipfs/${file.thumbnail.cid}`}
                  alt="thumb"
                  className="w-full max-h-80 object-cover rounded"
                />
              </div>
            )}
          </div>

          {msg && (
            <div className="p-3 bg-gray-50 rounded text-sm">{msg}</div>
          )}
        </Card>
      </div>

      {showShare && (
        <ShareModal
          file={file}
          onClose={() => {
            setShowShare(false);
            fetchFile();
          }}
          onSharedChange={() => fetchFile()}
        />
      )}
    </div>
  );
}
