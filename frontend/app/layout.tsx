import type React from "react"
import "./globals.css"
import { AuthProvider } from "@/src/auth/AuthProvider"

// export const metadata: Metadata = {
//   title: "DCFS - Distributed Content File System",
//   description: "Upload, manage, and verify files with IPFS integration",
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
