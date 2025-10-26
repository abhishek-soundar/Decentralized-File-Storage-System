"use client"

import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/src/auth/useAuth"
import FileDetail from "@/src/pages/FileDetail"

export default function Page() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const fileId = params.fileId

  // Redirect to login if not authenticated
  if (!user) {
    router.push("/")
    return null
  }

  const handleNavigate = (page) => {
    router.push(`/${page}`)
  }

  return <FileDetail fileId={fileId} onNavigate={handleNavigate} />
}
