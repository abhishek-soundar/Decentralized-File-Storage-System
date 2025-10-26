"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/src/auth/useAuth"
import Dashboard from "@/src/pages/Dashboard"

export default function Page() {
  const router = useRouter()
  const { user } = useAuth()

  // Redirect to login if not authenticated
  if (!user) {
    router.push("/")
    return null
  }

  const handleNavigate = (page, id) => {
    if (id) {
      router.push(`/${page}/${id}`)
    } else {
      router.push(`/${page}`)
    }
  }

  return <Dashboard onNavigate={handleNavigate} />
}
