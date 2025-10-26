"use client"

import { useState, useRef } from "react"
import axios from "../api/axios"
import Card from "../components/Card"
import ProgressBar from "../components/ProgressBar"

export default function Upload({ onNavigate }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError("")
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file")
      return
    }

    setUploading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", file)

      await axios.post("/files/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setProgress(percentCompleted)
        },
      })

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
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => onNavigate("dashboard")} className="btn-secondary mb-6">
          ← Back to Dashboard
        </button>

        <Card>
          <h1 className="app-card-header">Upload File</h1>
          <p className="app-card-subtitle">Select a file to upload</p>

          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary">
                {file ? `Change: ${file.name}` : "Select File"}
              </button>
              {file && <p className="mt-4 text-gray-600">{file.name}</p>}
            </div>

            {uploading && <ProgressBar progress={progress} label="Upload Progress" />}

            {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>

            <button onClick={() => onNavigate("chunk-upload")} className="btn-secondary w-full">
              Use Chunked Upload Instead
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
