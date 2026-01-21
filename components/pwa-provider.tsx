"use client"

import { useEffect, useState, useCallback } from "react"
import { Download, X, RefreshCw, Wifi, WifiOff, Check } from "lucide-react"
import { toast } from "sonner"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface PWAStatus {
  isInstallable: boolean
  isInstalled: boolean
  isOnline: boolean
  hasUpdate: boolean
  offlineReady: boolean
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<PWAStatus>({
    isInstallable: false,
    isInstalled: false,
    isOnline: true,
    hasUpdate: false,
    offlineReady: false,
  })
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        })
        
        setRegistration(reg)
        console.log("Service Worker registered:", reg.scope)

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setStatus(prev => ({ ...prev, hasUpdate: true }))
                setShowUpdateBanner(true)
              }
            })
          }
        })

        // Check if already installed
        if (reg.active) {
          setStatus(prev => ({ ...prev, offlineReady: true }))
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error)
      }
    }

    registerSW()

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload()
    })

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data.type === "SYNC_COMPLETE") {
        toast.success(`Synced ${event.data.synced} offline records`)
      }
    })
  }, [])

  // Handle install prompt
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setStatus(prev => ({ ...prev, isInstallable: true }))
      
      // Show install banner after a delay
      const dismissed = localStorage.getItem("pwa-install-dismissed")
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 3000)
      }
    }

    const handleAppInstalled = () => {
      setStatus(prev => ({ ...prev, isInstalled: true, isInstallable: false }))
      setDeferredPrompt(null)
      setShowInstallBanner(false)
      toast.success("App installed successfully!")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)
    window.addEventListener("appinstalled", handleAppInstalled)

    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setStatus(prev => ({ ...prev, isInstalled: true }))
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  // Handle online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }))
      toast.success("You're back online!")
    }

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }))
      toast.warning("You're offline. Data will sync when connected.")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Set initial state
    setStatus(prev => ({ ...prev, isOnline: navigator.onLine }))

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Install the PWA
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === "accepted") {
        setShowInstallBanner(false)
      }
      
      setDeferredPrompt(null)
    } catch (error) {
      console.error("Install failed:", error)
    }
  }, [deferredPrompt])

  // Dismiss install banner
  const dismissInstallBanner = useCallback(() => {
    setShowInstallBanner(false)
    localStorage.setItem("pwa-install-dismissed", "true")
  }, [])

  // Update the app
  const handleUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" })
    }
    setShowUpdateBanner(false)
  }, [registration])

  return (
    <>
      {children}

      {/* Offline Indicator */}
      {!status.isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-yellow-500 text-yellow-950 px-4 py-2 rounded-full shadow-lg animate-pulse">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Offline Mode</span>
        </div>
      )}

      {/* Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-card border border-border rounded-lg shadow-xl p-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">Install SmartCode</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Install the app for offline access and a better experience.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={dismissInstallBanner}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={dismissInstallBanner}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {showUpdateBanner && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-card border border-primary rounded-lg shadow-xl p-4 animate-in slide-in-from-top-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">Update Available</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A new version is available. Update now for the latest features.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Update Now
                </button>
                <button
                  onClick={() => setShowUpdateBanner(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Hook for PWA features
export function usePWA() {
  const [isOnline, setIsOnline] = useState(true)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    setIsOnline(navigator.onLine)
    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const requestSync = useCallback(async () => {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const registration = await navigator.serviceWorker.ready
      try {
        await (registration as any).sync.register("sync-attendance")
        return true
      } catch {
        return false
      }
    }
    return false
  }, [])

  const clearCache = useCallback(async () => {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready
      if (registration.active) {
        return new Promise((resolve) => {
          const channel = new MessageChannel()
          channel.port1.onmessage = (event) => resolve(event.data)
          registration.active!.postMessage({ type: "CLEAR_CACHE" }, [channel.port2])
        })
      }
    }
    return false
  }, [])

  return {
    isOnline,
    isInstalled,
    requestSync,
    clearCache,
  }
}
