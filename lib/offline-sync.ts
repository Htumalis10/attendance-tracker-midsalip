// Offline Sync Manager for Attendance Records
// Stores attendance data in localStorage when offline and syncs when online

const OFFLINE_QUEUE_KEY = "smartcode_offline_queue"
const SYNC_STATUS_KEY = "smartcode_sync_status"

export interface OfflineAttendanceRecord {
  id: string
  schoolId: string
  userId: string
  userName: string
  eventId: string
  eventName: string
  status: "PRESENT" | "LATE" | "PENDING"
  timeIn: string
  scannedAt: string
  synced: boolean
  syncAttempts: number
  lastSyncAttempt?: string
}

export interface SyncStatus {
  isOnline: boolean
  lastSync: string | null
  pendingRecords: number
  lastError: string | null
}

// Get current sync status
export function getSyncStatus(): SyncStatus {
  if (typeof window === "undefined") {
    return { isOnline: true, lastSync: null, pendingRecords: 0, lastError: null }
  }
  
  const stored = localStorage.getItem(SYNC_STATUS_KEY)
  const pendingRecords = getOfflineQueue().filter(r => !r.synced).length
  
  if (stored) {
    const status = JSON.parse(stored)
    return { ...status, isOnline: navigator.onLine, pendingRecords }
  }
  
  return {
    isOnline: navigator.onLine,
    lastSync: null,
    pendingRecords,
    lastError: null,
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
export function addToOfflineQueue(record: Omit<OfflineAttendanceRecord, "id" | "synced" | "syncAttempts" | "scannedAt">): OfflineAttendanceRecord {
  const queue = getOfflineQueue()
  
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
  
  const handleOnline = async () => {
    updateSyncStatus({ isOnline: true })
    onStatusChange?.(true)
    
    // Auto-sync when coming back online
    const pending = getPendingRecords()
    if (pending.length > 0) {
      console.log(`Auto-syncing ${pending.length} offline records...`)
      await syncAllPending()
    }
  }
  
  const handleOffline = () => {
    updateSyncStatus({ isOnline: false })
    onStatusChange?.(false)
  }
  
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  
  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}

// Clear all offline data (for testing/reset)
export function clearOfflineData(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(OFFLINE_QUEUE_KEY)
  localStorage.removeItem(SYNC_STATUS_KEY)
}
