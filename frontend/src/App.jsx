"use client";

import { useState, useEffect } from "react";
import { AuthProvider } from "./auth/AuthProvider";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import ChunkUploadPage from "./pages/ChunkUploadPage";
import FileDetail from "./pages/FileDetail";

/**
 * AppContent chooses which page to render based on presence of token in localStorage.
 * This avoids importing `useAuth` here (prevents circular import issues with AuthProvider).
 */
function AppContent() {
  const [currentPage, setCurrentPage] = useState("login");
  const [selectedFileId, setSelectedFileId] = useState(null);
  // navExtras: used to pass small navigation metadata (e.g. deletedFileId)
  const [navExtras, setNavExtras] = useState(null);

  useEffect(() => {
    function checkToken() {
      const token = localStorage.getItem("dcfs_token");
      setCurrentPage(token ? "dashboard" : "login");
    }

    // initial check
    checkToken();

    // listen for token changes across tabs/windows
    const onStorage = (e) => {
      if (e.key === "dcfs_token") {
        checkToken();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // handleNavigate now accepts optional extras and stores them so the destination page
  // can act on them immediately when mounted.
  const handleNavigate = (page, fileId = null, extras = {}) => {
    setCurrentPage(page);
    if (fileId) setSelectedFileId(fileId);
    // store extras for the destination page to consume
    setNavExtras(extras || null);
  };

  // helper to clear extras after the destination consumes it
  const clearNavExtras = () => setNavExtras(null);

  return (
    <div className="min-h-screen">
      {currentPage === "login" && <Login onNavigate={handleNavigate} />}
      {currentPage === "dashboard" && (
        <Dashboard
          onNavigate={handleNavigate}
          navExtras={navExtras}
          clearNavExtras={clearNavExtras}
        />
      )}
      {currentPage === "upload" && <Upload onNavigate={handleNavigate} />}
      {currentPage === "chunk-upload" && <ChunkUploadPage onNavigate={handleNavigate} />}
      {currentPage === "file-detail" && (
        <FileDetail fileId={selectedFileId} onNavigate={handleNavigate} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
