"use client"

import { useState, useEffect } from "react"
import { Camera, X, CheckCircle, AlertCircle, Clock, User, ChevronDown, Loader2, QrCode, Volume2, VolumeX, Wifi, WifiOff, CloudOff, RotateCcw } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Scanner } from "@yudiel/react-qr-scanner"
import { toast } from "sonner"
import { 
  isOnline, 
  setupSyncListeners, 
  addToOfflineQueue, 
  getPendingRecords, 
  syncAllPending,
  getSyncStatus,
  type OfflineAttendanceRecord 
} from "@/lib/offline-sync"

interface ScannedStudent {
  id: string
  schoolId: string
  userId: string
  name: string
  course: string
  year: string
  event: string
  eventId: string
  timeIn?: string
  timeOut?: string
  scanType: "time-in" | "time-out"
  status: "pending" | "approved" | "rejected"
  lateMinutes?: number
}

interface Event {
  id: string
  name: string
  startTime: string
  timeIn: string
  timeOut: string
  date: string
}

interface UserData {
  id: string
  schoolId: string
  name: string
  course: string | null
  year: string | null
}

export default function QRScanner() {
  const [isCameraActive, setIsCameraActive] = useState(true)
  const [scannedData, setScannedData] = useState<ScannedStudent | null>(null)
  const [scanHistory, setScanHistory] = useState<ScannedStudent[]>([])
  const [selectedEvent, setSelectedEvent] = useState("Select Event")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [lastScannedId, setLastScannedId] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [networkOnline, setNetworkOnline] = useState(true)
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [scanMode, setScanMode] = useState<"time-in" | "time-out">("time-in")
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second for real-time checking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Check if time-out is available (current time >= scheduled time-out)
  const isTimeOutAvailable = () => {
    if (!selectedEventId) return false
    const event = events.find(e => e.id === selectedEventId)
    if (!event?.timeOut) return false
    
    const [hours, minutes] = event.timeOut.split(":").map(Number)
    const timeOutDate = new Date()
    timeOutDate.setHours(hours, minutes, 0, 0)
    
    return currentTime >= timeOutDate
  }

  // Get time remaining until time-out is available
  const getTimeUntilTimeOut = () => {
    if (!selectedEventId) return null
    const event = events.find(e => e.id === selectedEventId)
    if (!event?.timeOut) return null
    
    const [hours, minutes] = event.timeOut.split(":").map(Number)
    const timeOutDate = new Date()
    timeOutDate.setHours(hours, minutes, 0, 0)
    
    const diff = timeOutDate.getTime() - currentTime.getTime()
    if (diff <= 0) return null
    
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60))
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000)
    
    if (hoursLeft > 0) {
      return `${hoursLeft}h ${minutesLeft}m ${secondsLeft}s`
    } else if (minutesLeft > 0) {
      return `${minutesLeft}m ${secondsLeft}s`
    }
    return `${secondsLeft}s`
  }

  // Fetch events function (extracted for reuse)
  const fetchEvents = async (isInitial = false) => {
    if (isInitial) setIsLoadingEvents(true)
    try {
      const response = await fetch("/api/events?status=ACTIVE")
      if (response.ok) {
        const data = await response.json()
        const previousEventIds = events.map(e => e.id)
        setEvents(data)
        
        // Auto-select first active event only on initial load or if no event selected
        if (isInitial && data.length > 0 && !selectedEventId) {
          setSelectedEvent(data[0].name)
          setSelectedEventId(data[0].id)
        }
        
        // Check for new events and notify
        if (!isInitial && data.length > 0) {
          const newEvents = data.filter((e: Event) => !previousEventIds.includes(e.id))
          if (newEvents.length > 0) {
            toast.info(`${newEvents.length} new event${newEvents.length > 1 ? 's' : ''} available`)
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch events:", err)
    } finally {
      if (isInitial) setIsLoadingEvents(false)
    }
  }

  // Initial fetch and polling for new events
  useEffect(() => {
    fetchEvents(true)
    
    // Poll for new events every 10 seconds
    const pollInterval = setInterval(() => {
      fetchEvents(false)
    }, 10000)
    
    return () => clearInterval(pollInterval)
  }, [])

  // Setup online/offline listeners and sync
  useEffect(() => {
    // Initial check
    setNetworkOnline(isOnline())
    setPendingOfflineCount(getPendingRecords().length)
    
    // Setup listeners for online/offline events
    const cleanup = setupSyncListeners((online) => {
      setNetworkOnline(online)
      if (online) {
        toast.success("Back online! Syncing pending records...")
        handleSyncOfflineRecords()
      } else {
        toast.warning("You're offline. Scans will be saved locally.")
      }
    })
    
    // Update pending count periodically
    const interval = setInterval(() => {
      setPendingOfflineCount(getPendingRecords().length)
    }, 5000)
    
    return () => {
      cleanup()
      clearInterval(interval)
    }
  }, [])

  // Sync offline records
  const handleSyncOfflineRecords = async () => {
    if (isSyncing) return
    
    const pending = getPendingRecords()
    if (pending.length === 0) {
      toast.info("No pending records to sync")
      return
    }
    
    setIsSyncing(true)
    try {
      const result = await syncAllPending()
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} offline record${result.synced > 1 ? "s" : ""}`)
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} record${result.failed > 1 ? "s" : ""} failed to sync`)
      }
      setPendingOfflineCount(getPendingRecords().length)
    } catch (err) {
      console.error("Sync failed:", err)
      toast.error("Failed to sync offline records")
    } finally {
      setIsSyncing(false)
    }
  }

  // Play beep sound on successful scan
  const playBeep = (success: boolean) => {
    if (!soundEnabled) return
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = success ? 800 : 300
      oscillator.type = 'sine'
      gainNode.gain.value = 0.3
      
      oscillator.start()
      oscillator.stop(audioContext.currentTime + (success ? 0.15 : 0.3))
    } catch (e) {
      console.log('Audio not supported')
    }
  }

  // Handle QR code scan result
  const handleScan = async (result: any) => {
    console.log("Scan result:", result)
    
    if (!result) return
    
    // Handle different result formats from the scanner library
    let scannedValue = ""
    if (Array.isArray(result) && result[0]?.rawValue) {
      scannedValue = result[0].rawValue.trim()
    } else if (result.rawValue) {
      scannedValue = result.rawValue.trim()
    } else if (typeof result === "string") {
      scannedValue = result.trim()
    }
    
    if (!scannedValue) {
      console.log("No valid QR code data found in scan result")
      return
    }
    
    console.log("Scanned value:", scannedValue)
    
    // Prevent duplicate scans within 3 seconds
    if (scannedValue === lastScannedId) return
    
    setLastScannedId(scannedValue)
    setScanError(null)
    
    // Clear last scanned ID after 3 seconds to allow re-scanning
    setTimeout(() => setLastScannedId(null), 3000)
    
    await processQRCode(scannedValue)
  }

  // Handle scan error
  const handleError = (error: any) => {
    console.error("Scanner error:", error)
  }

  const processQRCode = async (schoolId: string) => {
    console.log("Processing QR code for:", schoolId, "Event:", selectedEventId)
    
    if (!selectedEventId) {
      setScanError("Please select an event first")
      playBeep(false)
      return
    }

    // Prevent time-out scans before scheduled time
    if (scanMode === "time-out" && !isTimeOutAvailable()) {
      const event = events.find(e => e.id === selectedEventId)
      setScanError(`Time Out scanning not available until ${event?.timeOut || "scheduled time"}`)
      playBeep(false)
      return
    }

    if (isProcessing) {
      console.log("Already processing, skipping")
      return
    }
    
    setIsProcessing(true)
    setScanError(null)

    try {
      // Fetch user from database by school ID
      console.log("Looking up student with schoolId:", schoolId)
      const response = await fetch(`/api/users?schoolId=${encodeURIComponent(schoolId)}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch user")
      }
      
      const users: UserData[] = await response.json()
      console.log("Found users:", users)
      
      if (users.length === 0) {
        setScanError(`Student not found: ${schoolId}`)
        playBeep(false)
        return
      }

      const student = users[0]
      
      // For time-out, check if student has checked in first
      if (scanMode === "time-out") {
        // Check if already scanned for time-out
        const alreadyTimedOut = scanHistory.find(
          s => s.schoolId === student.schoolId && s.eventId === selectedEventId && s.scanType === "time-out"
        )
        if (alreadyTimedOut) {
          setScanError(`${student.name} already timed out for this event`)
          playBeep(false)
          return
        }
        
        // Check if they have checked in (either in history or database)
        const hasCheckedIn = scanHistory.find(
          s => s.schoolId === student.schoolId && s.eventId === selectedEventId && s.scanType === "time-in" && s.status === "approved"
        )
        
        if (!hasCheckedIn) {
          // Check database for existing time-in
          try {
            const attendanceRes = await fetch(`/api/attendance?userId=${student.id}&eventId=${selectedEventId}`)
            if (attendanceRes.ok) {
              const records = await attendanceRes.json()
              const hasDbTimeIn = records.length > 0 && records[0].timeIn
              if (!hasDbTimeIn) {
                setScanError(`${student.name} must time-in first before timing out`)
                playBeep(false)
                return
              }
            }
          } catch (err) {
            console.error("Error checking attendance:", err)
          }
        }
      } else {
        // For time-in, check if already scanned
        const alreadyScanned = scanHistory.find(
          s => s.schoolId === student.schoolId && s.eventId === selectedEventId && s.scanType === "time-in"
        )
        if (alreadyScanned) {
          setScanError(`${student.name} already scanned for time-in`)
          playBeep(false)
          return
        }
      }
      
      const selectedEventData = events.find(e => e.id === selectedEventId)
      
      const now = new Date()
      
      // Calculate late minutes based on event time-in
      let lateMinutes = 0
      if (selectedEventData?.timeIn && scanMode === "time-in") {
        const [hours, mins] = selectedEventData.timeIn.split(":").map(Number)
        const eventStartTime = new Date()
        eventStartTime.setHours(hours, mins, 0, 0)
        lateMinutes = Math.max(0, Math.floor((now.getTime() - eventStartTime.getTime()) / 60000))
      }
      const isLate = lateMinutes > 15 // 15 minute grace period

      const scannedStudent: ScannedStudent = {
        id: Date.now().toString(),
        schoolId: student.schoolId,
        userId: student.id,
        name: student.name,
        course: student.course || "N/A",
        year: student.year || "N/A",
        event: selectedEvent,
        eventId: selectedEventId,
        timeIn: scanMode === "time-in" ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        timeOut: scanMode === "time-out" ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        scanType: scanMode,
        status: "approved", // Auto-approve
        lateMinutes: scanMode === "time-in" && isLate ? lateMinutes : undefined,
      }

      // Auto-save to database immediately
      const attendanceStatus = scanMode === "time-out" ? "PRESENT" : (isLate ? "LATE" : "PRESENT")
      
      if (!networkOnline) {
        // Save offline
        addToOfflineQueue({
          schoolId: student.schoolId,
          userId: student.id,
          userName: student.name,
          eventId: selectedEventId,
          eventName: selectedEvent,
          status: attendanceStatus,
          timeIn: scannedStudent.timeIn || "",
          timeOut: scannedStudent.timeOut || "",
          type: scanMode,
        })
        setPendingOfflineCount(getPendingRecords().length)
        playBeep(true)
        setScanHistory([scannedStudent, ...scanHistory])
        toast.warning(`Saved offline: ${student.name} (${scanMode === "time-in" ? "Time In" : "Time Out"})`)
      } else {
        // Save to database immediately
        try {
          const response = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: student.id,
              eventId: selectedEventId,
              type: scanMode,
              status: attendanceStatus,
            }),
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || "Failed to record attendance")
          }

          playBeep(true)
          setScanHistory([scannedStudent, ...scanHistory])
          toast.success(`${scanMode === "time-in" ? "Time In" : "Time Out"}: ${student.name}${isLate && scanMode === "time-in" ? ` (Late: ${lateMinutes} mins)` : ""}`)
        } catch (err: any) {
          // If network error, save offline
          if (!navigator.onLine || err.message.includes("fetch")) {
            setNetworkOnline(false)
            addToOfflineQueue({
              schoolId: student.schoolId,
              userId: student.id,
              userName: student.name,
              eventId: selectedEventId,
              eventName: selectedEvent,
              status: attendanceStatus,
              timeIn: scannedStudent.timeIn || "",
              timeOut: scannedStudent.timeOut || "",
              type: scanMode,
            })
            setPendingOfflineCount(getPendingRecords().length)
            playBeep(true)
            setScanHistory([scannedStudent, ...scanHistory])
            toast.warning(`Saved offline: ${student.name}`)
          } else {
            setScanError(err.message)
            playBeep(false)
          }
        }
      }
      
      setScannedData(null) // Don't show pending modal since we auto-approve
    } catch (err) {
      console.error("Error processing QR:", err)
      setScanError("Failed to process QR code")
      playBeep(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApproveAttendance = async () => {
    if (!scannedData) return

    const attendanceStatus = scannedData.scanType === "time-out" ? "PRESENT" : (scannedData.lateMinutes ? "LATE" : "PRESENT")
    const scanType = scannedData.scanType

    // If offline, save to local storage
    if (!networkOnline) {
      const offlineRecord = addToOfflineQueue({
        schoolId: scannedData.schoolId,
        userId: scannedData.userId,
        userName: scannedData.name,
        eventId: scannedData.eventId,
        eventName: scannedData.event,
        status: attendanceStatus,
        timeIn: scannedData.timeIn || "",
        timeOut: scannedData.timeOut || "",
        type: scanType,
      })
      
      const updatedStudent = { ...scannedData, status: "approved" as const }
      setScanHistory([updatedStudent, ...scanHistory])
      setScannedData(null)
      setPendingOfflineCount(getPendingRecords().length)
      toast.warning(`Saved offline: ${scannedData.name} (${scanType === "time-in" ? "Time In" : "Time Out"}) - Will sync when online`)
      return
    }

    try {
      // Save attendance to database with type
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: scannedData.userId,
          eventId: scannedData.eventId,
          type: scanType,
          status: attendanceStatus,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to record attendance")
      }

      const updatedStudent = { ...scannedData, status: "approved" as const }
      setScanHistory([updatedStudent, ...scanHistory])
      setScannedData(null)
      toast.success(`${scanType === "time-in" ? "Time In" : "Time Out"} approved for ${scannedData.name}`)
    } catch (err: any) {
      // If network error, save offline
      if (!navigator.onLine || err.message.includes("fetch")) {
        setNetworkOnline(false)
        const offlineRecord = addToOfflineQueue({
          schoolId: scannedData.schoolId,
          userId: scannedData.userId,
          userName: scannedData.name,
          eventId: scannedData.eventId,
          eventName: scannedData.event,
          status: attendanceStatus,
          timeIn: scannedData.timeIn || "",
          timeOut: scannedData.timeOut || "",
          type: scanType,
        })
        
        const updatedStudent = { ...scannedData, status: "approved" as const }
        setScanHistory([updatedStudent, ...scanHistory])
        setScannedData(null)
        setPendingOfflineCount(getPendingRecords().length)
        toast.warning(`Saved offline: ${scannedData.name} (${scanType === "time-in" ? "Time In" : "Time Out"}) - Will sync when online`)
      } else {
        toast.error(err.message)
      }
    }
  }

  const handleRejectAttendance = () => {
    if (scannedData) {
      const updatedStudent = { ...scannedData, status: "rejected" as const }
      setScanHistory([updatedStudent, ...scanHistory])
      toast.info(`Attendance rejected for ${scannedData.name}`)
      setScannedData(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">QR Code Scanner</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Real-time student attendance scanning with immediate approval workflow
          </p>
        </div>
        
        {/* Network Status & Sync Button */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Network Status Indicator */}
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
          
          {/* Pending Offline Records Badge */}
          {pendingOfflineCount > 0 && (
            <button
              onClick={handleSyncOfflineRecords}
              disabled={!networkOnline || isSyncing}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs sm:text-sm font-medium hover:bg-orange-500/20 transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <CloudOff className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
              <span>{pendingOfflineCount} pending</span>
              {networkOnline && !isSyncing && <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Offline Mode Banner */}
      {!networkOnline && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
          <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-700 dark:text-yellow-300 text-sm sm:text-base">Offline Mode Active</p>
            <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              Attendance records will be saved locally and automatically synced when you're back online.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Scanner View */}
        <div className="lg:col-span-2 space-y-4">
          {/* Camera Feed */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="relative bg-black aspect-video flex items-center justify-center">
              {isCameraActive ? (
                <div className="w-full h-full">
                  <Scanner
                    onScan={handleScan}
                    onError={handleError}
                    formats={['qr_code']}
                    allowMultiple={false}
                    scanDelay={1000}
                    components={{
                      audio: false,
                      torch: true,
                      finder: true,
                    }}
                    styles={{
                      container: { width: '100%', height: '100%' },
                      video: { width: '100%', height: '100%', objectFit: 'cover' },
                    }}
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="bg-card p-4 rounded-lg flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-foreground">Processing...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6">
                  <Camera className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Camera is turned off</p>
                  <p className="text-muted-foreground text-sm mt-1">Click "Turn On Camera" to start scanning</p>
                </div>
              )}
            </div>

            {/* Scanner Controls */}
            <div className="bg-muted p-4 flex gap-2">
              <button
                onClick={() => setIsCameraActive(!isCameraActive)}
                className="action-button btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                {isCameraActive ? "Turn Off Camera" : "Turn On Camera"}
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`action-button flex items-center justify-center gap-2 px-4 ${soundEnabled ? 'btn-primary' : 'bg-muted-foreground/20'}`}
                title={soundEnabled ? "Sound On" : "Sound Off"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Scan Status Messages */}
            {scanError && (
              <div className="bg-red-500/10 border-t border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {scanError}
              </div>
            )}
            
            {lastScannedId && !scanError && !scannedData && (
              <div className="bg-green-500/10 border-t border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <QrCode className="w-4 h-4 flex-shrink-0" />
                Scanned: {lastScannedId}
              </div>
            )}
          </div>

          {/* Event Selection & Scan Mode */}
          <div className="bg-card rounded-lg p-4 border border-border space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Select Active Event</label>
              {isLoadingEvents ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-muted-foreground text-sm">Loading events...</span>
                </div>
              ) : events.length === 0 ? (
                <p className="text-muted-foreground text-sm py-2">No active events found</p>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors">
                    <span>{selectedEvent}</span>
                    <ChevronDown className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full">
                    {events.map((event) => (
                      <DropdownMenuItem 
                        key={event.id} 
                        onClick={() => { setSelectedEvent(event.name); setSelectedEventId(event.id); }}
                      >
                        {event.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            {/* Event Time Info */}
            {selectedEventId && events.find(e => e.id === selectedEventId) && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-muted-foreground">Time In:</span>
                    <span className="font-medium text-foreground">{events.find(e => e.id === selectedEventId)?.timeIn || "08:00"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-muted-foreground">Time Out:</span>
                    <span className="font-medium text-foreground">{events.find(e => e.id === selectedEventId)?.timeOut || "17:00"}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Scan Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Scan Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setScanMode("time-in")}
                  className={`py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    scanMode === "time-in"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Time In
                </button>
                <button
                  onClick={() => isTimeOutAvailable() && setScanMode("time-out")}
                  disabled={!isTimeOutAvailable()}
                  className={`py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    !isTimeOutAvailable()
                      ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                      : scanMode === "time-out"
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Time Out
                </button>
              </div>
              
              {/* Time Out Availability Notice */}
              {selectedEventId && !isTimeOutAvailable() && (
                <div className="mt-3 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Time Out not yet available</p>
                      <p className="text-xs mt-0.5">
                        Available at {events.find(e => e.id === selectedEventId)?.timeOut} 
                        {getTimeUntilTimeOut() && (
                          <span className="ml-1 font-mono">({getTimeUntilTimeOut()} remaining)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Time Out Active Notice */}
              {selectedEventId && isTimeOutAvailable() && scanMode === "time-out" && (
                <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="font-medium">Time Out scanning is now active!</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scan Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="stat-card p-3 sm:p-4">
              <p className="stat-label text-xs sm:text-sm">Time In</p>
              <p className="stat-value text-lg sm:text-2xl text-green-600 dark:text-green-400">
                {scanHistory.filter((s) => s.scanType === "time-in" && s.status === "approved").length}
              </p>
            </div>
            <div className="stat-card p-3 sm:p-4">
              <p className="stat-label text-xs sm:text-sm">Time Out</p>
              <p className="stat-value text-lg sm:text-2xl text-orange-600 dark:text-orange-400">
                {scanHistory.filter((s) => s.scanType === "time-out" && s.status === "approved").length}
              </p>
            </div>
            <div className="stat-card p-3 sm:p-4">
              <p className="stat-label text-xs sm:text-sm">Total Scans</p>
              <p className="stat-value text-lg sm:text-2xl">{scanHistory.length}</p>
            </div>
            <div className="stat-card p-3 sm:p-4">
              <p className="stat-label text-xs sm:text-sm">Rejected</p>
              <p className="stat-value text-lg sm:text-2xl text-red-600 dark:text-red-400">
                {scanHistory.filter((s) => s.status === "rejected").length}
              </p>
            </div>
          </div>
        </div>

        {/* Scan Status Panel */}
        <div className="space-y-4">
          {scannedData ? (
            <div className={`bg-card rounded-lg border-2 p-4 sm:p-6 space-y-3 sm:space-y-4 lg:sticky lg:top-6 ${
              scannedData.scanType === "time-in" ? "border-green-500" : "border-orange-500"
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    scannedData.scanType === "time-in" 
                      ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                      : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  }`}>
                    {scannedData.scanType === "time-in" ? "TIME IN" : "TIME OUT"}
                  </span>
                  Scan Result
                </h3>
                {scannedData.lateMinutes && scannedData.lateMinutes > 0 && (
                  <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                    LATE by {scannedData.lateMinutes}m
                  </span>
                )}
              </div>

              <div className="space-y-3 border-b border-border pb-4">
                <div>
                  <p className="text-muted-foreground text-sm">Name</p>
                  <p className="font-semibold text-foreground flex items-center gap-2 mt-1">
                    <User className="w-4 h-4" />
                    {scannedData.name}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm">School ID</p>
                  <p className="font-mono font-semibold text-primary mt-1">{scannedData.schoolId}</p>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm">Course</p>
                  <p className="text-foreground text-sm mt-1">{scannedData.course}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Year</p>
                    <p className="font-medium text-foreground mt-1">{scannedData.year}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{scannedData.scanType === "time-in" ? "Time In" : "Time Out"}</p>
                    <p className="font-medium text-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {scannedData.scanType === "time-in" ? scannedData.timeIn : scannedData.timeOut}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">
                  Approve {scannedData.scanType === "time-in" ? "Time In" : "Time Out"}?
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleApproveAttendance}
                    className={`w-full action-button text-white flex items-center justify-center gap-2 font-medium ${
                      scannedData.scanType === "time-in" 
                        ? "bg-green-600 hover:bg-green-700" 
                        : "bg-orange-600 hover:bg-orange-700"
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve {scannedData.scanType === "time-in" ? "Time In" : "Time Out"}
                  </button>
                  <button
                    onClick={handleRejectAttendance}
                    className="w-full action-button bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 font-medium"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>

              {scannedData.lateMinutes && scannedData.lateMinutes > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-sm text-yellow-700 dark:text-yellow-400">
                  <p className="font-medium flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4" />
                    Late Arrival Detected
                  </p>
                  <p className="text-xs">
                    Student arrived {scannedData.lateMinutes} minutes after event start. Consider approving with late
                    status.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-dashed border-border p-4 sm:p-6 text-center space-y-2 sm:space-y-3 lg:sticky lg:top-6">
              <QrCode className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-semibold text-foreground">Ready to Scan</p>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                  Point the camera at a student's QR code for <span className={`font-medium ${scanMode === "time-in" ? "text-green-600" : "text-orange-600"}`}>{scanMode === "time-in" ? "Time In" : "Time Out"}</span>
                </p>
                {!selectedEventId && (
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-2 font-medium">
                    ⚠️ Please select an event first
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scan History */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted p-3 sm:p-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm sm:text-base">Today's Scan History</h3>
        </div>

        {scanHistory.length > 0 ? (
          <div className="divide-y divide-border">
            {scanHistory.map((scan) => (
              <div key={scan.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-0 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-2 sm:gap-3 flex-1">
                  <div className="mt-1.5 sm:mt-1">
                    {scan.status === "approved" ? (
                      <div className={`w-2 h-2 rounded-full ${scan.scanType === "time-out" ? "bg-orange-600" : "bg-green-600"}`} />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <p className="font-medium text-foreground text-sm sm:text-base truncate">{scan.name}</p>
                      <span className="font-mono text-xs text-primary">{scan.schoolId}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        scan.scanType === "time-out" 
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" 
                          : "bg-green-500/10 text-green-600 dark:text-green-400"
                      }`}>
                        {scan.scanType === "time-out" ? "OUT" : "IN"}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{scan.course}</p>
                    <div className="flex gap-3 sm:gap-4 mt-1.5 sm:mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {scan.scanType === "time-out" ? scan.timeOut : scan.timeIn}
                      </span>
                      {scan.lateMinutes && scan.lateMinutes > 0 && scan.scanType !== "time-out" && (
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                          Late: {scan.lateMinutes}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-5 sm:ml-0">
                  {scan.status === "approved" ? (
                    <span className="badge-success flex items-center gap-1 text-xs">
                      <CheckCircle className="w-3 h-3" />
                      Approved
                    </span>
                  ) : (
                    <span className="badge-danger flex items-center gap-1 text-xs">
                      <X className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 sm:p-8 text-center text-muted-foreground text-sm sm:text-base">
            <p>No scans yet. Start scanning student QR codes to begin tracking attendance.</p>
          </div>
        )}
      </div>
    </div>
  )
}
