"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Wifi, WifiOff, RotateCcw, Loader2, CloudOff, Trash2, Clock, User, Calendar, Smartphone, Laptop, Monitor, Tablet, Globe } from "lucide-react"
import { toast } from "sonner"
import { getCurrentUser } from "@/lib/auth"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  isOnline,
  setupSyncListeners,
  getPendingRecords,
  syncAllPending,
  getSyncStatus,
  clearOfflineData,
  getOfflineQueue,
  getDeviceInfo,
  type OfflineAttendanceRecord,
  type DeviceInfo,
} from "@/lib/offline-sync"

interface ScannerDevice {
  id: string
  deviceId: string
  name: string
  deviceType?: string
  browser?: string
  os?: string
  location: string
  status: string
  lastSync: string
  lastSeen?: string
  offlineRecords: number
}

export default function SyncStatus() {
  const router = useRouter()

  // Admin-only page guard
  useEffect(() => {
    const user = getCurrentUser()
    if (user && user.role !== "admin") {
      router.push("/admin/dashboard")
    }
  }, [router])

  const [syncing, setSyncing] = useState(false)
  const [syncingDevice, setSyncingDevice] = useState<string | null>(null)
  const [devices, setDevices] = useState<ScannerDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [networkOnline, setNetworkOnline] = useState(true)
  const [offlineRecords, setOfflineRecords] = useState<OfflineAttendanceRecord[]>([])
  const [syncStatus, setSyncStatus] = useState(getSyncStatus())
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null)

  // Fetch devices
  useEffect(() => {
    fetchDevices()
  }, [])

  // Setup online/offline detection and load local records
  useEffect(() => {
    setNetworkOnline(isOnline())
    refreshLocalRecords()
    
    // Get current device info
    const deviceInfo = getDeviceInfo()
    setCurrentDevice(deviceInfo)
    
    const cleanup = setupSyncListeners((online) => {
      setNetworkOnline(online)
      if (online) {
        toast.success("Back online!")
        // Refresh devices when coming back online
        fetchDevices()
      } else {
        toast.warning("You're offline")
      }
    })
    
    // Refresh local records and devices periodically
    const interval = setInterval(() => {
      refreshLocalRecords()
      // Update device info
      setCurrentDevice(getDeviceInfo())
      // Refresh devices from server if online
      if (navigator.onLine) {
        fetchDevices()
      }
    }, 5000)
    
    return () => {
      cleanup()
      clearInterval(interval)
    }
  }, [])

  const refreshLocalRecords = () => {
    setOfflineRecords(getOfflineQueue())
    setSyncStatus(getSyncStatus())
  }

  const fetchDevices = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/scanners")
      if (response.ok) {
        const data = await response.json()
        setDevices(data)
      }
    } catch (err) {
      console.error("Failed to fetch devices:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      // First sync local offline records
      const pendingLocal = getPendingRecords()
      if (pendingLocal.length > 0) {
        const localResult = await syncAllPending()
        if (localResult.synced > 0) {
          toast.success(`Synced ${localResult.synced} local offline record${localResult.synced > 1 ? "s" : ""}`)
        }
        refreshLocalRecords()
      }
      
      // Then sync device records (from server)
      const response = await fetch("/api/scanners/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncAll: true }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.syncedCount > 0) {
          toast.success(`Successfully synced ${result.syncedCount} devices with ${result.recordsSynced} records`)
        }
        fetchDevices() // Refresh device list
      } else {
        throw new Error("Failed to sync devices")
      }
    } catch (err) {
      console.error("Sync failed:", err)
      toast.error("Failed to sync devices. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  // Sync only local offline records
  const handleSyncLocalRecords = async () => {
    if (!networkOnline) {
      toast.warning("Cannot sync while offline")
      return
    }
    
    setSyncing(true)
    try {
      const result = await syncAllPending()
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} offline record${result.synced > 1 ? "s" : ""}`)
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} record${result.failed > 1 ? "s" : ""} failed to sync`)
      }
      if (result.synced === 0 && result.failed === 0) {
        toast.info("No pending records to sync")
      }
      refreshLocalRecords()
    } catch (err) {
      console.error("Sync failed:", err)
      toast.error("Failed to sync offline records")
    } finally {
      setSyncing(false)
    }
  }

  // Clear all local offline data
  const handleClearOfflineData = () => {
    clearOfflineData()
    refreshLocalRecords()
    setShowClearDialog(false)
    toast.success("Offline data cleared")
  }

  const handleSyncDevice = async (deviceId: string) => {
    setSyncingDevice(deviceId)
    try {
      const response = await fetch("/api/scanners/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Successfully synced ${result.recordsSynced} records from device`)
        fetchDevices() // Refresh device list
      } else {
        throw new Error("Failed to sync device")
      }
    } catch (err) {
      console.error("Sync failed:", err)
      toast.error("Failed to sync device. Please try again.")
    } finally {
      setSyncingDevice(null)
    }
  }

  const formatLastSync = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
  }

  const totalDevices = devices.length + (currentDevice ? 1 : 0) // Include current device
  // Filter out the current device from devices list to avoid duplication
  const otherDevices = currentDevice 
    ? devices.filter(d => d.deviceId !== currentDevice.deviceId)
    : devices
  const onlineDevices = otherDevices.filter((d) => d.status === "ONLINE").length + (currentDevice && networkOnline ? 1 : 0)
  const offlineDevices = otherDevices.filter((d) => d.status === "OFFLINE").length + (currentDevice && !networkOnline ? 1 : 0)
  const totalDeviceCount = otherDevices.length + (currentDevice ? 1 : 0)
  const pendingSyncs = otherDevices.reduce((acc, d) => acc + d.offlineRecords, 0)
  const localPendingRecords = offlineRecords.filter(r => !r.synced)
  const localSyncedRecords = offlineRecords.filter(r => r.synced)

  // Get device icon based on type
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-5 h-5" />
      case "tablet":
        return <Tablet className="w-5 h-5" />
      case "laptop":
        return <Laptop className="w-5 h-5" />
      case "desktop":
        return <Monitor className="w-5 h-5" />
      default:
        return <Globe className="w-5 h-5" />
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Offline Sync Status</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Monitor scanner devices and sync offline data</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Network Status */}
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${
            networkOnline 
              ? "bg-green-500/10 text-green-600 dark:text-green-400" 
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}>
            {networkOnline ? (
              <>
                <Wifi className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Offline</span>
              </>
            )}
          </div>
          
          <button
            onClick={handleSyncAll}
            disabled={syncing || (pendingSyncs === 0 && localPendingRecords.length === 0) || !networkOnline}
            className="action-button btn-primary flex items-center justify-center gap-2 disabled:opacity-50 flex-1 sm:flex-none"
          >
            <RotateCcw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync All"}
          </button>
        </div>
      </div>

      {/* Offline Mode Notice */}
      {!networkOnline && (
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-2 border-orange-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <WifiOff className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-orange-600 dark:text-orange-400">You&apos;re Currently Offline</p>
              <p className="text-sm text-orange-600/80 dark:text-orange-400/80 mt-1">
                Don&apos;t worry! You can still scan QR codes. All attendance records will be saved locally on this device 
                and automatically synced when you&apos;re back online.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                  {localPendingRecords.length} records waiting to sync
                </span>
                <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                  Auto-sync when online
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
        <div className="stat-card p-3 sm:p-4">
          <p className="stat-label text-xs sm:text-sm">Total Devices</p>
          <p className="stat-value text-lg sm:text-2xl">{totalDeviceCount}</p>
        </div>
        <div className="stat-card p-3 sm:p-4">
          <p className="stat-label text-xs sm:text-sm">Online Devices</p>
          <p className="stat-value text-lg sm:text-2xl text-green-600 dark:text-green-400">{onlineDevices}</p>
        </div>
        <div className="stat-card p-3 sm:p-4">
          <p className="stat-label text-xs sm:text-sm">Offline Devices</p>
          <p className="stat-value text-lg sm:text-2xl text-red-600 dark:text-red-400">{offlineDevices}</p>
        </div>
        <div className="stat-card p-3 sm:p-4">
          <p className="stat-label text-xs sm:text-sm">Device Pending</p>
          <p className="stat-value text-lg sm:text-2xl">{pendingSyncs}</p>
        </div>
        <div className="stat-card p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="stat-label text-xs sm:text-sm">Local Pending</p>
          <p className="stat-value text-lg sm:text-2xl text-orange-600 dark:text-orange-400">{localPendingRecords.length}</p>
        </div>
      </div>

      {/* Local Offline Records Section */}
      {offlineRecords.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="bg-muted p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <CloudOff className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
              <div>
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Local Offline Records</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {localPendingRecords.length} pending • {localSyncedRecords.length} synced
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncLocalRecords}
                disabled={syncing || localPendingRecords.length === 0 || !networkOnline}
                className="action-button btn-secondary text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 disabled:opacity-50 flex-1 sm:flex-none"
              >
                <RotateCcw className={`w-3 h-3 sm:w-4 sm:h-4 ${syncing ? "animate-spin" : ""}`} />
                Sync Local
              </button>
              <button
                onClick={() => setShowClearDialog(true)}
                className="action-button bg-red-500/10 text-red-600 hover:bg-red-500/20 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {offlineRecords.map((record) => (
              <div key={record.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-2 sm:gap-3 flex-1">
                  <div className={`w-2 h-2 rounded-full mt-1.5 sm:mt-2 ${record.synced ? "bg-green-600" : "bg-orange-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                        <p className="font-medium text-foreground text-sm sm:text-base truncate">{record.userName}</p>
                      </div>
                      <span className="font-mono text-xs text-primary">{record.schoolId}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span className="truncate max-w-[120px] sm:max-w-none">{record.eventName}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {record.timeIn}
                      </span>
                      {record.deviceName && (
                        <span className="flex items-center gap-1 text-xs">
                          <Laptop className="w-3 h-3" />
                          <span className="truncate max-w-[100px]">{record.deviceName.replace(/📱|💻|🖥️|📟/g, '').trim()}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scanned: {new Date(record.scannedAt).toLocaleString()}
                      {record.deviceId && <span className="ml-2 font-mono text-[10px] opacity-60">{record.deviceId}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-5 sm:ml-0">
                  <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium ${
                    record.status === "PRESENT" 
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : record.status === "LATE"
                        ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}>
                    {record.status}
                  </span>
                  {record.synced ? (
                    <span className="badge-success text-xs">✓ Synced</span>
                  ) : (
                    <span className="badge-warning text-xs flex items-center gap-1">
                      <CloudOff className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {syncStatus.lastSync && (
            <div className="bg-muted/50 p-3 border-t border-border text-sm text-muted-foreground text-center">
              Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Devices Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading devices...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-muted">
                  <th className="hidden sm:table-cell">Device ID</th>
                  <th>Device Name</th>
                  <th className="hidden md:table-cell">Location/Info</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Last Sync</th>
                  <th className="hidden md:table-cell">Offline Records</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Current Device Row - Always show first */}
                {currentDevice && (
                  <tr className="bg-primary/5 border-b-2 border-primary/20">
                    <td className="font-mono text-sm text-primary hidden sm:table-cell">{currentDevice.deviceId}</td>
                    <td className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(currentDevice.deviceType)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{currentDevice.deviceName.replace(/📱|💻|🖥️|📟/g, '').trim()}</span>
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">This Device</span>
                          </div>
                          <div className="sm:hidden text-xs text-primary font-mono">{currentDevice.deviceId}</div>
                          <div className="md:hidden text-xs text-muted-foreground">{currentDevice.os} • {currentDevice.browser}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground text-sm hidden md:table-cell">{currentDevice.os} • {currentDevice.browser}</td>
                    <td>
                      {networkOnline ? (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" />
                          <span className="badge-success text-xs">● Online</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 dark:text-red-400" />
                          <span className="badge-danger text-xs">● Offline</span>
                        </div>
                      )}
                    </td>
                    <td className="text-sm text-muted-foreground hidden sm:table-cell">
                      {syncStatus.lastSync ? formatLastSync(syncStatus.lastSync) : "Never"}
                    </td>
                    <td
                      className={`font-semibold hidden md:table-cell ${localPendingRecords.length > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}
                    >
                      {localPendingRecords.length}
                    </td>
                    <td>
                      {localPendingRecords.length > 0 && (
                        <button 
                          onClick={handleSyncLocalRecords}
                          disabled={!networkOnline || syncing}
                          className="action-button btn-secondary text-xs sm:text-sm flex items-center gap-1 sm:gap-2 disabled:opacity-50 p-1.5 sm:p-2"
                        >
                          <RotateCcw className={`w-3 h-3 sm:w-4 sm:h-4 ${syncing ? "animate-spin" : ""}`} />
                          <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {/* Other Scanner Devices */}
                {otherDevices.map((device) => (
                  <tr key={device.id}>
                    <td className="font-mono text-sm text-primary hidden sm:table-cell">{device.deviceId}</td>
                    <td className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(device.deviceType || 'unknown')}
                        <div>
                          <div>{device.name.replace(/📱|💻|🖥️|📟/g, '').trim()}</div>
                          <div className="sm:hidden text-xs text-primary font-mono">{device.deviceId}</div>
                          <div className="md:hidden text-xs text-muted-foreground">
                            {device.os && device.browser ? `${device.os} • ${device.browser}` : device.location}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground text-sm hidden md:table-cell">
                      {device.os && device.browser ? `${device.os} • ${device.browser}` : device.location || 'Unknown'}
                    </td>
                    <td>
                      {device.status === "ONLINE" ? (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" />
                          <span className="badge-success text-xs">● Online</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 dark:text-red-400" />
                          <span className="badge-danger text-xs">● Offline</span>
                        </div>
                      )}
                    </td>
                    <td className="text-sm text-muted-foreground hidden sm:table-cell">
                      {device.lastSeen ? formatLastSync(device.lastSeen) : (device.lastSync ? formatLastSync(device.lastSync) : "Never")}
                    </td>
                    <td
                      className={`font-semibold hidden md:table-cell ${device.offlineRecords > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}
                    >
                      {device.offlineRecords}
                    </td>
                    <td>
                      {device.offlineRecords > 0 && (
                        <button 
                          onClick={() => handleSyncDevice(device.id)}
                          disabled={syncingDevice === device.id}
                          className="action-button btn-secondary text-xs sm:text-sm flex items-center gap-1 sm:gap-2 disabled:opacity-50 p-1.5 sm:p-2"
                        >
                          <RotateCcw className={`w-3 h-3 sm:w-4 sm:h-4 ${syncingDevice === device.id ? "animate-spin" : ""}`} />
                          <span className="hidden sm:inline">{syncingDevice === device.id ? "Syncing..." : "Sync"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear Offline Data Confirmation */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Offline Data</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all offline data? This will remove {localPendingRecords.length} pending 
              and {localSyncedRecords.length} synced records from local storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearOfflineData} className="bg-red-500 hover:bg-red-600">
              Clear All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
