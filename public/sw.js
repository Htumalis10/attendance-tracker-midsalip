/// <reference lib="webworker" />

const CACHE_NAME = "smartcode-v1"
const OFFLINE_CACHE_NAME = "smartcode-offline-v1"
const DATA_CACHE_NAME = "smartcode-data-v1"

// Assets to cache on install (app shell)
const STATIC_ASSETS = [
  "/",
  "/login",
  "/admin/dashboard",
  "/admin/events",
  "/admin/attendance",
  "/admin/qr-scanner",
  "/admin/users",
  "/admin/certificates",
  "/admin/reports",
  "/admin/sync-status",
  "/student/dashboard",
  "/student/scan-history",
  "/student/certificates",
  "/student/profile",
  "/offline.html",
  "/manifest.json",
]

// API routes to cache with network-first strategy
const API_ROUTES = [
  "/api/events",
  "/api/users",
  "/api/attendance",
  "/api/certificates",
  "/api/dashboard/stats",
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Install")
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Caching app shell")
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log("[ServiceWorker] Failed to cache some assets:", err)
      })
    })
  )
  
  // Force activation
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activate")
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName !== CACHE_NAME &&
              cacheName !== OFFLINE_CACHE_NAME &&
              cacheName !== DATA_CACHE_NAME
            )
          })
          .map((cacheName) => {
            console.log("[ServiceWorker] Removing old cache:", cacheName)
            return caches.delete(cacheName)
          })
      )
    })
  )
  
  // Take control of all pages immediately
  self.clients.claim()
})

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests for caching (but handle POST for background sync)
  if (request.method !== "GET") {
    // Handle POST requests for offline attendance sync
    if (request.method === "POST" && url.pathname === "/api/attendance") {
      event.respondWith(handleAttendancePost(request))
      return
    }
    return
  }
  
  // API requests - network first, then cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request))
    return
  }
  
  // Static assets and pages - cache first, then network
  if (
    request.destination === "document" ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(cacheFirstStrategy(request))
    return
  }
  
  // Default - network first
  event.respondWith(networkFirstStrategy(request))
})

// Cache first strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request)
  
  if (cachedResponse) {
    // Return cached response and update cache in background
    fetchAndCache(request)
    return cachedResponse
  }
  
  return fetchAndCache(request)
}

// Network first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request)
    
    // Cache successful GET responses
    if (networkResponse.ok && request.method === "GET") {
      const cache = await caches.open(DATA_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page for document requests
    if (request.destination === "document") {
      const offlinePage = await caches.match("/offline.html")
      if (offlinePage) {
        return offlinePage
      }
    }
    
    // Return error response for API
    if (request.url.includes("/api/")) {
      return new Response(
        JSON.stringify({ error: "You are offline", offline: true }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
    
    throw error
  }
}

// Fetch and cache helper
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    // Return offline page for document requests
    if (request.destination === "document") {
      const offlinePage = await caches.match("/offline.html")
      if (offlinePage) {
        return offlinePage
      }
    }
    
    throw error
  }
}

// Handle attendance POST requests (store offline if needed)
async function handleAttendancePost(request) {
  try {
    const response = await fetch(request.clone())
    return response
  } catch (error) {
    // Network failed - store for background sync
    const data = await request.clone().json()
    
    // Store in IndexedDB for background sync
    await storeOfflineAttendance(data)
    
    // Return success response (will be synced later)
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: "Attendance saved offline. Will sync when online.",
        data: data,
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

// Store offline attendance in IndexedDB
async function storeOfflineAttendance(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("SmartCodeOffline", 1)
    
    request.onerror = () => reject(request.error)
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains("attendance")) {
        const store = db.createObjectStore("attendance", { keyPath: "id", autoIncrement: true })
        store.createIndex("synced", "synced", { unique: false })
        store.createIndex("timestamp", "timestamp", { unique: false })
      }
    }
    
    request.onsuccess = (event) => {
      const db = event.target.result
      const transaction = db.transaction(["attendance"], "readwrite")
      const store = transaction.objectStore("attendance")
      
      const record = {
        ...data,
        timestamp: new Date().toISOString(),
        synced: false,
      }
      
      store.add(record)
      
      transaction.oncomplete = () => {
        // Register for background sync
        self.registration.sync.register("sync-attendance").catch(() => {
          console.log("[ServiceWorker] Background sync not supported")
        })
        resolve()
      }
      
      transaction.onerror = () => reject(transaction.error)
    }
  })
}

// Background sync event
self.addEventListener("sync", (event) => {
  console.log("[ServiceWorker] Sync event:", event.tag)
  
  if (event.tag === "sync-attendance") {
    event.waitUntil(syncOfflineAttendance())
  }
})

// Sync offline attendance records
async function syncOfflineAttendance() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("SmartCodeOffline", 1)
    
    request.onerror = () => reject(request.error)
    
    request.onsuccess = async (event) => {
      const db = event.target.result
      
      if (!db.objectStoreNames.contains("attendance")) {
        resolve()
        return
      }
      
      const transaction = db.transaction(["attendance"], "readwrite")
      const store = transaction.objectStore("attendance")
      const index = store.index("synced")
      const request = index.getAll(false)
      
      request.onsuccess = async () => {
        const records = request.result
        console.log(`[ServiceWorker] Syncing ${records.length} offline records`)
        
        for (const record of records) {
          try {
            const response = await fetch("/api/attendance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...record,
                offlineSync: true,
              }),
            })
            
            if (response.ok) {
              // Mark as synced
              const updateTx = db.transaction(["attendance"], "readwrite")
              const updateStore = updateTx.objectStore("attendance")
              record.synced = true
              updateStore.put(record)
              
              console.log(`[ServiceWorker] Synced record ${record.id}`)
            }
          } catch (error) {
            console.error(`[ServiceWorker] Failed to sync record ${record.id}:`, error)
          }
        }
        
        // Notify clients about sync completion
        const clients = await self.clients.matchAll()
        clients.forEach((client) => {
          client.postMessage({
            type: "SYNC_COMPLETE",
            synced: records.length,
          })
        })
        
        resolve()
      }
    }
  })
}

// Push notification event
self.addEventListener("push", (event) => {
  console.log("[ServiceWorker] Push received")
  
  let data = { title: "SmartCode", body: "New notification" }
  
  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      data.body = event.data.text()
    }
  }
  
  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
    actions: data.actions || [],
  }
  
  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("[ServiceWorker] Notification clicked")
  
  event.notification.close()
  
  const url = event.notification.data?.url || "/"
  
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus()
        }
      }
      
      // Open new window if none found
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

// Message event - handle messages from clients
self.addEventListener("message", (event) => {
  console.log("[ServiceWorker] Message received:", event.data)
  
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
  
  if (event.data.type === "GET_CACHE_STATUS") {
    getCacheStatus().then((status) => {
      event.ports[0].postMessage(status)
    })
  }
  
  if (event.data.type === "CLEAR_CACHE") {
    clearAllCaches().then(() => {
      event.ports[0].postMessage({ success: true })
    })
  }
  
  if (event.data.type === "FORCE_SYNC") {
    syncOfflineAttendance().then(() => {
      event.ports[0].postMessage({ success: true })
    })
  }
})

// Get cache status
async function getCacheStatus() {
  const cacheNames = await caches.keys()
  let totalSize = 0
  let itemCount = 0
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    itemCount += keys.length
  }
  
  return {
    caches: cacheNames,
    itemCount,
    offlineReady: cacheNames.includes(CACHE_NAME),
  }
}

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  console.log("[ServiceWorker] All caches cleared")
}

console.log("[ServiceWorker] Service Worker loaded")
