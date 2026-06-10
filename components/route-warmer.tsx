"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const ROUTES = [
  "/",
  "/equipment",
  "/investigation",
  "/planner",
  "/knowledge",
  "/reports",
]

/**
 * Warms every main route shortly after first load so sidebar
 * navigation is instant. In dev this triggers route compilation;
 * in production it populates the router prefetch cache.
 */
export function RouteWarmer() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const warm = async () => {
      for (const route of ROUTES) {
        if (cancelled) return
        try {
          // Populates the client router cache (production)
          router.prefetch(route)
          // Triggers on-demand route compilation (development)
          await fetch(route, { priority: "low" })
        } catch {
          // best-effort warming; ignore failures
        }
      }
    }

    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1500)

    const handle = idle(() => {
      warm()
    })

    return () => {
      cancelled = true
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(handle as number)
      } else {
        window.clearTimeout(handle as number)
      }
    }
  }, [router])

  return null
}
