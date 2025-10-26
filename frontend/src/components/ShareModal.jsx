"use client";

import React, { useState } from "react";
import api from "../api/axios";

export default function ShareModal({ file, onClose, onSharedChange }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [emailToAdd, setEmailToAdd] = useState("");
  const [sharedWith, setSharedWith] = useState(file?.sharedWith || []);
  const [shareTokenInfo, setShareTokenInfo] = useState({
    token: file?.shareToken || null,
    expiresAt: file?.shareExpiresAt || null,
    isPublic: !!(file?.isPublic || file?.visibility === "public")
  });

  // create token (public share)
  const createToken = async (expiresInSeconds = null) => {
    try {
      setBusy(true);
      setMsg("");
      const res = await api.post(`/files/${file._id || file.id}/share/token`, { expiresInSeconds });
      if (res.data && res.data.ok) {
        setShareTokenInfo({
          token: res.data.shareToken,
          expiresAt: res.data.shareExpiresAt,
          isPublic: true
        });
        setMsg("Public share created");
        if (onSharedChange) onSharedChange();
      } else {
        setMsg(res.data?.error || "Failed to create token");
      }
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Create token failed");
    } finally {
      setBusy(false);
    }
  };

  const revokeToken = async () => {
    try {
      setBusy(true);
      setMsg("");
      const res = await api.post(`/files/${file._id || file.id}/share/token`, { revoke: true });
      if (res.data && res.data.ok) {
        setShareTokenInfo({ token: null, expiresAt: null, isPublic: false });
        setMsg("Public share revoked");
        if (onSharedChange) onSharedChange();
      } else setMsg(res.data?.error || "Failed to revoke");
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Revoke failed");
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied to clipboard");
    } catch (e) {
      setMsg("Copy failed");
    }
  };

  const addSharedUser = async () => {
    if (!emailToAdd) return setMsg("Enter an email or user id");
    try {
      setBusy(true);
      setMsg("");
      const res = await api.post(`/files/${file._id || file.id}/share`, { add: [emailToAdd] });
      if (res.data && res.data.ok) {
        setSharedWith(res.data.sharedWith || []);
        setEmailToAdd("");
        setMsg("Added");
        if (onSharedChange) onSharedChange();
      } else {
        setMsg(res.data?.error || "Failed to add");
      }
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Add failed");
    } finally {
      setBusy(false);
    }
  };

  const removeSharedUser = async (userId) => {
    try {
      setBusy(true);
      setMsg("");
      const res = await api.post(`/files/${file._id || file.id}/share`, { remove: [userId] });
      if (res.data && res.data.ok) {
        setSharedWith(res.data.sharedWith || []);
        setMsg("Removed");
        if (onSharedChange) onSharedChange();
      } else {
        setMsg(res.data?.error || "Failed to remove");
      }
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const gatewayLink = file?.cid ? `https://gateway.pinata.cloud/ipfs/${file.cid}` : null;
  const tokenLink = shareTokenInfo.token ? `${(import.meta.env.VITE_API_BASE || "http://localhost:4000/api/v1")}/files/${file._id || file.id}/download-public?token=${shareTokenInfo.token}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => onClose && onClose()} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Share "{file.filename}"</h3>
          <button className="text-sm text-gray-500" onClick={() => onClose && onClose()}>Close</button>
        </div>

        <div className="mb-4">
          <div className="font-medium mb-2">Public sharing</div>
          {shareTokenInfo.isPublic ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-700 break-words">Public gateway: {gatewayLink ? <a className="text-blue-600 underline" href={gatewayLink} target="_blank" rel="noreferrer">{gatewayLink}</a> : <span className="text-gray-500">Not available (no CID yet)</span>}</div>
              {shareTokenInfo.token && (
                <div className="text-sm text-gray-700 break-words">
                  Token link (expires: {shareTokenInfo.expiresAt ? new Date(shareTokenInfo.expiresAt).toLocaleString() : "never"}):
                  <div className="mt-1 flex gap-2">
                    <input readOnly value={tokenLink || ""} className="flex-1 border rounded px-2 py-1 text-xs" />
                    <button onClick={() => copyToClipboard(tokenLink)} className="btn-secondary text-xs">Copy</button>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <button onClick={() => revokeToken()} disabled={busy} className="btn-destructive mr-2">Revoke public link</button>
                <button onClick={() => createToken(null)} disabled={busy} className="btn-secondary">Refresh token</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-gray-600 mb-2">Create a public link anyone can use to access this file (CID required to use gateway).</div>
              <div className="flex gap-2">
                <button onClick={() => createToken(60 * 60 * 24)} disabled={busy} className="btn-primary">Create public link (24h)</button>
                <button onClick={() => createToken(null)} disabled={busy} className="btn-secondary">Create permanent link</button>
              </div>
            </div>
          )}
        </div>

        <hr className="my-4" />

        <div className="mb-4">
          <div className="font-medium mb-2">Share with specific users</div>
          <div className="flex gap-2 mb-3">
            <input value={emailToAdd} onChange={(e) => setEmailToAdd(e.target.value)} placeholder="user email or id" className="flex-1 border rounded px-2 py-1 text-sm" />
            <button onClick={addSharedUser} disabled={busy} className="btn-primary">Add</button>
          </div>

          <div className="text-sm text-gray-600 mb-2">Shared users</div>
          <div className="space-y-2">
            {sharedWith && sharedWith.length > 0 ? (
              sharedWith.map((u) => (
                <div key={String(u)} className="flex items-center justify-between border rounded px-3 py-2">
                  <div className="text-sm">{String(u)}</div>
                  <div>
                    <button onClick={() => removeSharedUser(String(u))} disabled={busy} className="btn-destructive text-xs">Remove</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No users shared yet.</div>
            )}
          </div>
        </div>

        {msg && <div className="p-2 bg-gray-50 rounded text-sm mb-2">{msg}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={() => onClose && onClose()} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}
