"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/src/auth/useAuth"
import Upload from "@/src/pages/Upload"

export default function Page() {
  const router = useRouter()
  const { user } = useAuth()

  // Redirect to login if not authenticated
  if (!user) {
    router.push("/")
    return null
  }

  const handleNavigate = (page) => {
    router.push(`/${page}`)
  }

  return <Upload onNavigate={handleNavigate} />
}
