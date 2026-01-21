// Offline Sync Manager for Attendance Records
// Stores attendance data in localStorage when offline and syncs when online

const OFFLINE_QUEUE_KEY = "smartcode_offline_queue"
const SYNC_STATUS_KEY = "smartcode_sync_status"
const DEVICE_INFO_KEY = "smartcode_device_info"

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  deviceType: "mobile" | "tablet" | "laptop" | "desktop" | "unknown"
  browser: string
  os: string
  lastSeen: string
  isOnline: boolean
}

export interface OfflineAttendanceRecord {
  id: string
  schoolId: string
  userId: string
  userName: string
  eventId: string
  eventName: string
  status: "PRESENT" | "LATE" | "PENDING"
  timeIn: string
  timeOut?: string
  scannedAt: string
  synced: boolean
  syncAttempts: number
  lastSyncAttempt?: string
  deviceId?: string
  deviceName?: string
  type?: "time-in" | "time-out"
}

export interface SyncStatus {
  isOnline: boolean
  lastSync: string | null
  pendingRecords: number
  lastError: string | null
  deviceInfo?: DeviceInfo
}

// Detect device type from user agent
function detectDeviceType(): "mobile" | "tablet" | "laptop" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown"
  
  const ua = navigator.userAgent.toLowerCase()
  
  // Check for mobile devices
  if (/android.*mobile|iphone|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)) {
    return "mobile"
  }
  
  // Check for tablets
  if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) {
    return "tablet"
  }
  
  // Check for touch-enabled laptops/desktops
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0
  
  // Check screen size for laptop vs desktop
  const screenWidth = window.screen.width
  const screenHeight = window.screen.height
  
  // Laptops typically have smaller screens
  if (screenWidth <= 1920 && screenHeight <= 1080) {
    return "laptop"
  }
  
  return "desktop"
}

// Detect browser name
function detectBrowser(): string {
  if (typeof window === "undefined") return "unknown"
  
  const ua = navigator.userAgent
  
  if (ua.includes("Firefox")) return "Firefox"
  if (ua.includes("SamsungBrowser")) return "Samsung Browser"
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera"
  if (ua.includes("Edg")) return "Edge"
  if (ua.includes("Chrome")) return "Chrome"
  if (ua.includes("Safari")) return "Safari"
  
  return "Unknown Browser"
}

// Detect operating system
function detectOS(): string {
  if (typeof window === "undefined") return "unknown"
  
  const ua = navigator.userAgent
  
  if (ua.includes("Windows NT 10")) return "Windows 10/11"
  if (ua.includes("Windows NT 6.3")) return "Windows 8.1"
  if (ua.includes("Windows NT 6.2")) return "Windows 8"
  if (ua.includes("Windows NT 6.1")) return "Windows 7"
  if (ua.includes("Windows")) return "Windows"
  if (ua.includes("Mac OS X")) return "macOS"
  if (ua.includes("Android")) {
    const match = ua.match(/Android (\d+\.?\d*)/)
    return match ? `Android ${match[1]}` : "Android"
  }
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS"
  if (ua.includes("Linux")) return "Linux"
  
  return "Unknown OS"
}

// Generate a unique device ID
function generateDeviceId(): string {
  // Try to get a stable identifier
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  let fingerprint = ""
  
  if (ctx) {
    ctx.textBaseline = "top"
    ctx.font = "14px Arial"
    ctx.fillText("SmartCode", 2, 2)
    fingerprint = canvas.toDataURL().slice(-50)
  }
  
  // Combine with other factors
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const language = navigator.language
  
  // Create a hash from the combined data
  const combined = `${fingerprint}-${screenInfo}-${timezone}-${language}-${navigator.userAgent.slice(0, 50)}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return `DEV-${Math.abs(hash).toString(36).toUpperCase()}`
}

// Generate friendly device name
function generateDeviceName(): string {
  const deviceType = detectDeviceType()
  const os = detectOS()
  const browser = detectBrowser()
  
  const typeNames: Record<string, string> = {
    mobile: "📱 Mobile",
    tablet: "📱 Tablet", 
    laptop: "💻 Laptop",
    desktop: "🖥️ Desktop",
    unknown: "📟 Device"
  }
  
  return `${typeNames[deviceType]} - ${os} (${browser})`
}

// Get or create device info
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      deviceId: "server",
      deviceName: "Server",
      deviceType: "unknown",
      browser: "unknown",
      os: "unknown",
      lastSeen: new Date().toISOString(),
      isOnline: true,
    }
  }
  
  const stored = localStorage.getItem(DEVICE_INFO_KEY)
  
  if (stored) {
    try {
      const info = JSON.parse(stored) as DeviceInfo
      // Update lastSeen and online status
      info.lastSeen = new Date().toISOString()
      info.isOnline = navigator.onLine
      localStorage.setItem(DEVICE_INFO_KEY, JSON.stringify(info))
      return info
    } catch (e) {
      console.error("Failed to parse device info:", e)
    }
  }
  
  // Generate new device info
  const deviceInfo: DeviceInfo = {
    deviceId: generateDeviceId(),
    deviceName: generateDeviceName(),
    deviceType: detectDeviceType(),
    browser: detectBrowser(),
    os: detectOS(),
    lastSeen: new Date().toISOString(),
    isOnline: navigator.onLine,
  }
  
  localStorage.setItem(DEVICE_INFO_KEY, JSON.stringify(deviceInfo))
  return deviceInfo
}

// Update device online status
export function updateDeviceStatus(isOnline: boolean): void {
  if (typeof window === "undefined") return
  
  const info = getDeviceInfo()
  info.isOnline = isOnline
  info.lastSeen = new Date().toISOString()
  localStorage.setItem(DEVICE_INFO_KEY, JSON.stringify(info))
}

// Register device with the server
export async function registerDeviceWithServer(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (!navigator.onLine) return false
  
  try {
    const deviceInfo = getDeviceInfo()
    const pendingCount = getPendingRecords().length
    
    const response = await fetch("/api/scanners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: deviceInfo.deviceId,
        name: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        offlineRecords: pendingCount,
      }),
    })
    
    return response.ok
  } catch (error) {
    console.error("Failed to register device with server:", error)
    return false
  }
}

// Send heartbeat to server to maintain online status
export async function sendHeartbeat(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (!navigator.onLine) return false
  
  try {
    const deviceInfo = getDeviceInfo()
    const pendingCount = getPendingRecords().length
    
    const response = await fetch("/api/scanners", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: deviceInfo.deviceId,
        status: "ONLINE",
        offlineRecords: pendingCount,
      }),
    })
    
    return response.ok
  } catch (error) {
    console.error("Failed to send heartbeat:", error)
    return false
  }
}

// Get current sync status
export function getSyncStatus(): SyncStatus {
  if (typeof window === "undefined") {
    return { isOnline: true, lastSync: null, pendingRecords: 0, lastError: null }
  }
  
  const stored = localStorage.getItem(SYNC_STATUS_KEY)
  const pendingRecords = getOfflineQueue().filter(r => !r.synced).length
  const deviceInfo = getDeviceInfo()
  
  if (stored) {
    const status = JSON.parse(stored)
    return { ...status, isOnline: navigator.onLine, pendingRecords, deviceInfo }
  }
  
  return {
    isOnline: navigator.onLine,
    lastSync: null,
    pendingRecords,
    lastError: null,
    deviceInfo,
  }
}

// Update sync status
export function updateSyncStatus(updates: Partial<SyncStatus>): void {
  if (typeof window === "undefined") return
  
  const current = getSyncStatus()
  const newStatus = { ...current, ...updates }
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(newStatus))
}

// Get offline queue
export function getOfflineQueue(): OfflineAttendanceRecord[] {
  if (typeof window === "undefined") return []
  
  const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (e) {
      console.error("Failed to parse offline queue:", e)
      return []
    }
  }
  return []
}

// Save offline queue
function saveOfflineQueue(queue: OfflineAttendanceRecord[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

// Add record to offline queue
export function addToOfflineQueue(record: Omit<OfflineAttendanceRecord, "id" | "synced" | "syncAttempts" | "scannedAt" | "deviceId" | "deviceName">): OfflineAttendanceRecord {
  const queue = getOfflineQueue()
  const deviceInfo = getDeviceInfo()
  
  // Check for duplicate (same user, same event)
  const existing = queue.find(r => r.userId === record.userId && r.eventId === record.eventId)
  if (existing) {
    return existing
  }
  
  const newRecord: OfflineAttendanceRecord = {
    ...record,
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    scannedAt: new Date().toISOString(),
    synced: false,
    syncAttempts: 0,
    deviceId: deviceInfo.deviceId,
    deviceName: deviceInfo.deviceName,
  }
  
  queue.push(newRecord)
  saveOfflineQueue(queue)
  
  // Update pending count
  updateSyncStatus({ pendingRecords: queue.filter(r => !r.synced).length })
  
  return newRecord
}

// Mark record as synced
export function markAsSynced(recordId: string): void {
  const queue = getOfflineQueue()
  const index = queue.findIndex(r => r.id === recordId)
  
  if (index !== -1) {
    queue[index].synced = true
    saveOfflineQueue(queue)
    updateSyncStatus({ 
      pendingRecords: queue.filter(r => !r.synced).length,
      lastSync: new Date().toISOString(),
    })
  }
}

// Remove synced records older than 24 hours
export function cleanupSyncedRecords(): void {
  const queue = getOfflineQueue()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const filtered = queue.filter(r => {
    if (!r.synced) return true
    return r.scannedAt > oneDayAgo
  })
  
  saveOfflineQueue(filtered)
}

// Get pending (unsynced) records
export function getPendingRecords(): OfflineAttendanceRecord[] {
  return getOfflineQueue().filter(r => !r.synced)
}

// Sync a single record to the server
export async function syncRecord(record: OfflineAttendanceRecord): Promise<boolean> {
  try {
    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: record.userId,
        eventId: record.eventId,
        status: record.status,
        timeIn: record.timeIn,
        offlineSync: true,
        offlineRecordId: record.id,
      }),
    })
    
    if (response.ok) {
      markAsSynced(record.id)
      return true
    }
    
    // Update sync attempt count
    const queue = getOfflineQueue()
    const index = queue.findIndex(r => r.id === record.id)
    if (index !== -1) {
      queue[index].syncAttempts++
      queue[index].lastSyncAttempt = new Date().toISOString()
      saveOfflineQueue(queue)
    }
    
    return false
  } catch (error) {
    console.error("Failed to sync record:", error)
    
    // Update sync attempt count
    const queue = getOfflineQueue()
    const index = queue.findIndex(r => r.id === record.id)
    if (index !== -1) {
      queue[index].syncAttempts++
      queue[index].lastSyncAttempt = new Date().toISOString()
      saveOfflineQueue(queue)
    }
    
    return false
  }
}

// Sync all pending records
export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  const pending = getPendingRecords()
  let synced = 0
  let failed = 0
  
  for (const record of pending) {
    const success = await syncRecord(record)
    if (success) {
      synced++
    } else {
      failed++
    }
  }
  
  if (synced > 0) {
    updateSyncStatus({ lastSync: new Date().toISOString() })
  }
  
  cleanupSyncedRecords()
  
  return { synced, failed }
}

// Check if online
export function isOnline(): boolean {
  if (typeof window === "undefined") return true
  return navigator.onLine
}

// Setup online/offline event listeners
export function setupSyncListeners(onStatusChange?: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {}
  
  // Register device on initial setup
  registerDeviceWithServer()
  
  const handleOnline = async () => {
    updateSyncStatus({ isOnline: true })
    updateDeviceStatus(true)
    onStatusChange?.(true)
    
    // Register device when coming back online
    await registerDeviceWithServer()
    
    // Auto-sync when coming back online
    const pending = getPendingRecords()
    if (pending.length > 0) {
      console.log(`Auto-syncing ${pending.length} offline records...`)
      await syncAllPending()
    }
  }
  
  const handleOffline = () => {
    updateSyncStatus({ isOnline: false })
    updateDeviceStatus(false)
    onStatusChange?.(false)
  }
  
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  
  // Send heartbeat to server periodically to maintain online status
  const heartbeatInterval = setInterval(() => {
    if (navigator.onLine) {
      sendHeartbeat()
    }
    updateDeviceStatus(navigator.onLine)
  }, 30000) // Every 30 seconds
  
  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
    clearInterval(heartbeatInterval)
  }
}

// Clear all offline data (for testing/reset)
export function clearOfflineData(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(OFFLINE_QUEUE_KEY)
  localStorage.removeItem(SYNC_STATUS_KEY)
}
