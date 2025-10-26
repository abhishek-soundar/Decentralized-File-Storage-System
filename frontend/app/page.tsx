"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/src/auth/useAuth"
import Login from "@/src/pages/Login"

export default function Page() {
  const router = useRouter()
  const { user } = useAuth()

  // Redirect to dashboard if already logged in
  if (user) {
    router.push("/dashboard")
    return null
  }

  const handleNavigate = (page) => {
    router.push(`/${page}`)
  }

  return <Login onNavigate={handleNavigate} />
}
