"use client"

import Card from "../components/Card"
import ChunkedUploader from "../components/ChunkedUploader"

export default function ChunkedUpload({ onNavigate }) {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => onNavigate("dashboard")} className="btn-secondary mb-6">
          ← Back to Dashboard
        </button>

        <Card>
          <h1 className="app-card-header">Chunked Upload</h1>
          <p className="app-card-subtitle">Upload large files in chunks</p>

          <ChunkedUploader onNavigate={onNavigate} />
        </Card>
      </div>
    </div>
  )
}
