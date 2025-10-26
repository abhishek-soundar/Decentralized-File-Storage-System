"use client"

import { useState, useRef } from "react"
import axios from "../api/axios"
import ProgressBar from "./ProgressBar"

export default function ChunkedUploader({ onComplete, onNavigate }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [chunkProgress, setChunkProgress] = useState({})
  const [error, setError] = useState("")
  const fileInputRef = useRef(null)

  const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
  const CONCURRENT_CHUNKS = 4

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError("")
    }
  }

  const uploadChunks = async (uploadId, chunks) => {
    const uploadPromises = []
    let activeUploads = 0

    for (let i = 0; i < chunks.length; i++) {
      const uploadChunk = async () => {
        try {
          const chunk = chunks[i]
          await axios.put(`/uploads/${uploadId}/chunk`, chunk, {
            headers: {
              "x-chunk-index": i,
              "Content-Type": "application/octet-stream",
            },
            onUploadProgress: (progressEvent) => {
              setChunkProgress((prev) => ({
                ...prev,
                [i]: progressEvent.loaded / progressEvent.total,
              }))
            },
          })
        } catch (err) {
          throw new Error(`Chunk ${i} upload failed: ${err.message}`)
        }
      }

      uploadPromises.push(
        new Promise((resolve, reject) => {
          const executeUpload = async () => {
            try {
              await uploadChunk()
              resolve()
            } catch (err) {
              reject(err)
            } finally {
              activeUploads--
              processQueue()
            }
          }

          if (activeUploads < CONCURRENT_CHUNKS) {
            activeUploads++
            executeUpload()
          } else {
            uploadPromises.push({ executeUpload, resolve, reject })
          }
        }),
      )
    }

    const processQueue = () => {
      if (uploadPromises.length > 0 && activeUploads < CONCURRENT_CHUNKS) {
        const { executeUpload } = uploadPromises.pop()
        activeUploads++
        executeUpload()
      }
    }

    await Promise.all(uploadPromises.filter((p) => p instanceof Promise))

    // Update overall progress
    const totalProgress = Object.values(chunkProgress).reduce((a, b) => a + b, 0) / chunks.length
    setProgress(totalProgress * 100)
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file")
      return
    }

    setUploading(true)
    setError("")

    try {
      // Initialize upload
      const initResponse = await axios.post("/uploads/init", {
        filename: file.name,
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        fileSize: file.size,
        mimeType: file.type,
        chunkSize: CHUNK_SIZE,
      })

      const { uploadId } = initResponse.data

      // Split file into chunks
      const chunks = []
      for (let i = 0; i < file.size; i += CHUNK_SIZE) {
        chunks.push(file.slice(i, i + CHUNK_SIZE))
      }

      // Upload chunks
      await uploadChunks(uploadId, chunks)

      // Complete upload
      await axios.post(`/uploads/${uploadId}/complete`)

      setProgress(100)
      setTimeout(() => {
        onNavigate("dashboard")
      }, 1000)
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Upload failed")
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} disabled={uploading} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary">
          {file ? `Change: ${file.name}` : "Select File"}
        </button>
        {file && <p className="mt-4 text-gray-600">{file.name}</p>}
      </div>

      {uploading && (
        <div className="space-y-4">
          <ProgressBar progress={progress} label="Overall Progress" />
          <div className="text-sm text-gray-600">Uploading {Object.keys(chunkProgress).length} chunks...</div>
        </div>
      )}

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? "Uploading..." : "Start Chunked Upload"}
      </button>
    </div>
  )
}
