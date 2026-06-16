"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

const STORAGE_KEY = "cold-start-banner-dismissed"

export function ColdStartBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return
    setVisible(true)
  }, [])

  function dismiss() {
    setVisible(false)
    sessionStorage.setItem(STORAGE_KEY, "1")
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-card px-5 py-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Heads up</p>
            <p className="mt-1">
              We use Render free tier for the backend. If the site has been idle,
              it may take 30s to 1 min to wake up and load data. Hang tight.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        <button
          onClick={dismiss}
          className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
