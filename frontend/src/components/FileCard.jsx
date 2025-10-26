"use client";

import React, { useState, useEffect } from "react";
import Card from "./Card";

export default function FileCard({ file, onClick, onPreview }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    // reset loaded state when thumbnail changes
    setImgLoaded(false);
  }, [file?.thumbnail?.cid]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getStatusColor = (status) => {
    switch (status) {
      case "uploading":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "pinning":
      case "processing":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "available":
      case "verified":
        return "bg-green-100 text-green-700 border-green-300";
      case "failed":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const isProcessingLike = file.status === "processing" || file.status === "pinning";

  // thumbnail click handler: call preview and stop propagation to avoid card's onClick
  const handleThumbClick = (e) => {
    e.stopPropagation();
    if (typeof onPreview === "function") {
      try {
        onPreview(file);
      } catch (err) {
        // ignore errors from consumer
      }
    }
  };

  const isShared = file.isPublic || (Array.isArray(file.sharedWith) && file.sharedWith.length > 0) || file.visibility === 'public';

  return (
    <div onClick={onClick} className="cursor-pointer">
      <Card className="hover:shadow-lg hover:-translate-y-1 transition-transform">
        {/* top-right badge for shared/public */}
        <div className="relative">
          {isShared && (
            <div className="absolute right-3 top-3 z-10">
              <span className="inline-block bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200">
                {file.isPublic || file.visibility === 'public' ? 'Public' : 'Shared'}
              </span>
            </div>
          )}
        </div>

        {file.thumbnail?.cid ? (
          <div
            className="mb-4 h-40 bg-gray-100 rounded-lg overflow-hidden relative group"
          >
            <img
              src={`https://gateway.pinata.cloud/ipfs/${file.thumbnail.cid}`}
              alt={file.filename}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => {
                setImgLoaded(true);
              }}
              onClick={handleThumbClick}
              style={{ display: "block" }}
            />
            {/* subtle preview button overlay (clickable) */}
            <button
              type="button"
              onClick={handleThumbClick}
              className="absolute bottom-3 right-3 bg-white/90 text-xs font-medium px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Preview"
            >
              Preview
            </button>

            {/* processing overlay */}
            {isProcessingLike && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <span className="text-gray-600 text-sm animate-pulse">Processing...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 h-40 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm">
            No Preview
          </div>
        )}

        <h3 className="font-semibold text-gray-900 truncate mb-1">{file.filename}</h3>
        <p className="text-sm text-gray-600 mb-1">Size: {formatBytes(file.size)}</p>
        <p className="text-sm text-gray-600 mb-1">Type: {file.mimeType}</p>
        {file.cid && <p className="text-xs text-gray-500 truncate">CID: {file.cid}</p>}

        <div
          className={`inline-block mt-3 px-3 py-1 text-xs font-semibold border rounded-full ${getStatusColor(
            file.status || (file.verified ? "verified" : "")
          )}`}
        >
          {file.status === "uploading"
            ? "Uploading..."
            : file.status === "pinning"
            ? "Pinning..."
            : file.status === "processing"
            ? "Processing..."
            : file.status === "available"
            ? "Available"
            : file.verified
            ? "Verified"
            : file.status === "failed"
            ? "Failed"
            : "Unknown"}
        </div>

        <p className="text-xs text-gray-500 mt-2">{formatDate(file.createdAt)}</p>
      </Card>
    </div>
  );
}
