"use client"

import { useState, useEffect } from "react"
import { Camera, X, CheckCircle, AlertCircle, Clock, User, ChevronDown, Loader2, QrCode, Volume2, VolumeX, Wifi, WifiOff, CloudOff, RotateCcw, Trash2, Lock, Calendar, MapPin } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Scanner } from "@yudiel/react-qr-scanner"
import { toast } from "sonner"
import { formatTimeDisplay } from "@/lib/time-utils"
import { getCurrentUser } from "@/lib/auth"
import { 
  isOnline, 
  setupSyncListeners, 
  addToOfflineQueue, 
  getPendingRecords, 
  syncAllPending,
  getSyncStatus,
  getDeviceInfo,
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
  period?: "morning" | "afternoon" | "evening"
  status: "pending" | "approved" | "rejected"
  lateMinutes?: number
}

interface Event {
  id: string
  name: string
  startTime: string
  timeIn: string
  timeOut: string
  afternoonTimeIn?: string
  afternoonTimeOut?: string
  eveningTimeIn?: string
  eveningTimeOut?: string
  date: string
  type?: string
  parentEventId?: string | null
}

interface UserData {
  id: string
  schoolId: string
  name: string
  course: string | null
  year: string | null
  role: string
}

interface UpcomingEvent {
  id: string
  name: string
  date: string
  venue: string
  timeIn: string
  timeOut: string
  afternoonTimeIn?: string
  afternoonTimeOut?: string
  eveningTimeIn?: string
  eveningTimeOut?: string
  status: string
}

// Helper to get today's date key for localStorage
const getTodayKey = () => {
  const today = new Date()
  return `scanHistory_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function QRScanner() {
  const [isCameraActive, setIsCameraActive] = useState(true)
  const [scannedData, setScannedData] = useState<ScannedStudent | null>(null)
  const [scanHistory, setScanHistory] = useState<ScannedStudent[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
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
  const [isSGOfficer, setIsSGOfficer] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])

  // Check if user is SG Officer
  useEffect(() => {
    const user = getCurrentUser()
    if (user?.role === "sg_officer") {
      setIsSGOfficer(true)
    }
  }, [])

  // Load scan history from localStorage on mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem(getTodayKey())
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setScanHistory(parsed)
        }
      } catch (e) {
        console.error('Failed to parse scan history from localStorage:', e)
      }
    }
    setIsHydrated(true)
  }, [])

  // Update current time every second for real-time checking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Save scan history to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated && scanHistory.length > 0) {
      localStorage.setItem(getTodayKey(), JSON.stringify(scanHistory))
    }
  }, [scanHistory, isHydrated])

  // Auto-switch scan mode based on current period phase
  useEffect(() => {
    if (!selectedEventId) return
    if (isTimeOutAvailable() && scanMode === "time-in") {
      setScanMode("time-out")
      setScanError(null)
    }
    // When a new period starts, switch back to time-in
    if (!isTimeOutAvailable() && scanMode === "time-out" && isTimeInAvailable()) {
      setScanMode("time-in")
      setScanError(null)
    }
  }, [currentTime, selectedEventId, scanMode])

  // Determine which period is currently active based on current time
  // Only returns periods that actually have times configured
  const getCurrentPeriod = (): "morning" | "afternoon" | "evening" => {
    if (!selectedEventId) return "morning"
    const event = events.find(e => e.id === selectedEventId)
    if (!event) return "morning"
    
    const now = new Date()
    
    // Check evening first (highest priority if time has passed)
    if (event.eveningTimeIn) {
      const [h, m] = event.eveningTimeIn.split(":").map(Number)
      const t = new Date(); t.setHours(h, m, 0, 0)
      if (now >= t) return "evening"
    }
    
    // Check afternoon
    if (event.afternoonTimeIn) {
      const [h, m] = event.afternoonTimeIn.split(":").map(Number)
      const t = new Date(); t.setHours(h, m, 0, 0)
      if (now >= t) return "afternoon"
    }
    
    // Only return "morning" if morning times are actually configured
    if (event.timeIn) return "morning"
    
    // No morning configured — return the earliest configured period
    if (event.afternoonTimeIn) return "afternoon"
    if (event.eveningTimeIn) return "evening"
    
    return "morning"
  }

  // Get effective timeIn/timeOut for the current period
  // Supports "spanning" events where morning timeOut is empty and the event
  // continues into afternoon/evening (no intermediate timeIn set)
  const getEffectiveTimes = () => {
    if (!selectedEventId) return { timeIn: "", timeOut: "" }
    const event = events.find(e => e.id === selectedEventId)
    if (!event) return { timeIn: "", timeOut: "" }
    
    const period = getCurrentPeriod()
    if (period === "evening" && event.eveningTimeIn && event.eveningTimeOut) {
      return { timeIn: event.eveningTimeIn, timeOut: event.eveningTimeOut }
    }
    if (period === "afternoon" && event.afternoonTimeIn) {
      // Afternoon spans to evening if afternoonTimeOut is empty, no eveningTimeIn, but eveningTimeOut exists
      let timeOut = event.afternoonTimeOut || ""
      if (!timeOut && !event.eveningTimeIn && event.eveningTimeOut) {
        timeOut = event.eveningTimeOut
      }
      return { timeIn: event.afternoonTimeIn, timeOut }
    }
    // Morning period - check for spanning to later periods
    let timeOut = event.timeOut || ""
    if (!timeOut) {
      if (!event.afternoonTimeIn && event.afternoonTimeOut) {
        // Morning spans directly to afternoon timeOut
        timeOut = event.afternoonTimeOut
      } else if (!event.afternoonTimeIn && !event.afternoonTimeOut && !event.eveningTimeIn && event.eveningTimeOut) {
        // Morning spans all the way to evening timeOut
        timeOut = event.eveningTimeOut
      }
    }
    return { timeIn: event.timeIn, timeOut }
  }

  // Check if there's a next period after the current one
  const getNextPeriodInfo = () => {
    if (!selectedEventId) return null
    const event = events.find(e => e.id === selectedEventId)
    if (!event) return null
    
    const period = getCurrentPeriod()
    if (period === "morning" && event.afternoonTimeIn) {
      return { name: "Afternoon", timeIn: event.afternoonTimeIn }
    }
    if (period === "afternoon" && event.eveningTimeIn) {
      return { name: "Evening", timeIn: event.eveningTimeIn }
    }
    return null
  }

  // Check if time-in is available for current period
  const isTimeInAvailable = () => {
    if (!selectedEventId) return false
    const { timeIn, timeOut } = getEffectiveTimes()
    if (!timeIn || !timeOut) return false
    
    const [inHours, inMinutes] = timeIn.split(":").map(Number)
    const timeInDate = new Date()
    timeInDate.setHours(inHours, inMinutes, 0, 0)
    
    const [outHours, outMinutes] = timeOut.split(":").map(Number)
    const timeOutDate = new Date()
    timeOutDate.setHours(outHours, outMinutes, 0, 0)
    
    const now = new Date()
    return now >= timeInDate && now < timeOutDate
  }

  // Check if time-out is available for current period
  const isTimeOutAvailable = () => {
    if (!selectedEventId) return false
    const { timeIn, timeOut } = getEffectiveTimes()
    if (!timeIn || !timeOut) return false
    
    const [inHours, inMinutes] = timeIn.split(":").map(Number)
    const timeInDate = new Date()
    timeInDate.setHours(inHours, inMinutes, 0, 0)
    
    const [outHours, outMinutes] = timeOut.split(":").map(Number)
    const timeOutDate = new Date()
    timeOutDate.setHours(outHours, outMinutes, 0, 0)
    
    const now = new Date()
    // Time-out available: current time is past the period's start AND past the timeOut
    return now >= timeInDate && now >= timeOutDate
  }

  // Calculate grace period based on event duration
  const calculateGracePeriod = (timeIn: string, timeOut: string): number => {
    const [inHour, inMin] = timeIn.split(":").map(Number)
    const [outHour, outMin] = timeOut.split(":").map(Number)
    
    // Calculate duration in minutes
    const startMinutes = inHour * 60 + inMin
    const endMinutes = outHour * 60 + outMin
    const durationMinutes = endMinutes - startMinutes
    
    // Determine grace period based on duration
    if (durationMinutes <= 10) {
      return 10 // 10 minutes grace for 5-10 min events
    } else if (durationMinutes <= 30) {
      return 20 // 20 minutes grace for 20-30 min events
    } else if (durationMinutes <= 60) {
      return 30 // 30 minutes grace for up to 1 hour events
    } else {
      return 60 // 1 hour grace for events longer than 1 hour
    }
  }

  // Check if time-out grace period is still active
  const isTimeOutGracePeriodActive = () => {
    if (!selectedEventId) return false
    const { timeIn, timeOut } = getEffectiveTimes()
    if (!timeIn || !timeOut) return false
    
    const [outHours, outMinutes] = timeOut.split(":").map(Number)
    const timeOutDate = new Date()
    timeOutDate.setHours(outHours, outMinutes, 0, 0)
    
    const gracePeriod = calculateGracePeriod(timeIn, timeOut)
    const graceEndDate = new Date(timeOutDate.getTime() + gracePeriod * 60 * 1000)
    
    const now = new Date()
    return now >= timeOutDate && now < graceEndDate
  }

  // Get time-out grace period countdown info
  const getTimeOutGraceInfo = () => {
    if (!selectedEventId) return null
    const { timeIn, timeOut } = getEffectiveTimes()
    if (!timeIn || !timeOut) return null
    
    const [outHours, outMinutes] = timeOut.split(":").map(Number)
    const timeOutDate = new Date()
    timeOutDate.setHours(outHours, outMinutes, 0, 0)
    
    const gracePeriod = calculateGracePeriod(timeIn, timeOut)
    const graceEndDate = new Date(timeOutDate.getTime() + gracePeriod * 60 * 1000)
    
    const now = currentTime
    
    // If before time-out time, not in grace period yet
    if (now < timeOutDate) {
      return null
    }
    
    // If within grace period
    if (now >= timeOutDate && now < graceEndDate) {
      const diff = graceEndDate.getTime() - now.getTime()
      const minsLeft = Math.floor(diff / 60000)
      const secsLeft = Math.floor((diff % 60000) / 1000)
      return {
        status: "grace-active",
        message: `Time-out grace period: ${minsLeft}m ${secsLeft}s remaining`,
        countdown: `${minsLeft}:${secsLeft.toString().padStart(2, '0')}`,
        gracePeriod,
        timeRemaining: diff
      }
    }
    
    // Grace period ended - check if there's a next period
    const nextPeriod = getNextPeriodInfo()
    if (nextPeriod) {
      return {
        status: "period-ended",
        message: `${getCurrentPeriod().charAt(0).toUpperCase() + getCurrentPeriod().slice(1)} period ended — ${nextPeriod.name} starts at ${formatTimeDisplay(nextPeriod.timeIn)}`,
        gracePeriod,
        timeRemaining: 0,
        nextPeriodName: nextPeriod.name,
        nextPeriodTimeIn: nextPeriod.timeIn
      }
    }
    
    return {
      status: "grace-ended",
      message: "Grace period ended - Event closing",
      gracePeriod,
      timeRemaining: 0
    }
  }

  // Get time remaining until time-out is available
  const getTimeUntilTimeOut = () => {
    if (!selectedEventId) return null
    const { timeOut } = getEffectiveTimes()
    if (!timeOut) return null
    
    const [hours, minutes] = timeOut.split(":").map(Number)
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

  // Late threshold in minutes
  const LATE_THRESHOLD_MINUTES = 5

  // Get time info for late countdown
  const getLateCountdownInfo = () => {
    if (!selectedEventId) return null
    const { timeIn } = getEffectiveTimes()
    if (!timeIn) return null
    
    const [hours, minutes] = timeIn.split(":").map(Number)
    const eventStartTime = new Date()
    eventStartTime.setHours(hours, minutes, 0, 0)
    
    const lateThresholdTime = new Date(eventStartTime.getTime() + LATE_THRESHOLD_MINUTES * 60 * 1000)
    const now = currentTime
    
    // Calculate minutes since event started
    const minutesSinceStart = Math.floor((now.getTime() - eventStartTime.getTime()) / 60000)
    
    // If before event start
    if (now < eventStartTime) {
      const diff = eventStartTime.getTime() - now.getTime()
      const minsLeft = Math.floor(diff / 60000)
      const secsLeft = Math.floor((diff % 60000) / 1000)
      return {
        status: "before-start",
        message: `Event starts in ${minsLeft}m ${secsLeft}s`,
        minutesSinceStart: 0,
        isLate: false
      }
    }
    
    // If within grace period (not late yet)
    if (now < lateThresholdTime) {
      const diff = lateThresholdTime.getTime() - now.getTime()
      const minsLeft = Math.floor(diff / 60000)
      const secsLeft = Math.floor((diff % 60000) / 1000)
      return {
        status: "on-time",
        message: `${minsLeft}m ${secsLeft}s until late`,
        countdown: `${minsLeft}:${secsLeft.toString().padStart(2, '0')}`,
        minutesSinceStart,
        isLate: false
      }
    }
    
    // Already past late threshold
    return {
      status: "late",
      message: `${minutesSinceStart - LATE_THRESHOLD_MINUTES}m past grace period`,
      minutesSinceStart,
      isLate: true
    }
  }

  // Fetch events function (extracted for reuse)
  const fetchEvents = async (isInitial = false) => {
    if (isInitial) setIsLoadingEvents(true)
    try {
      const response = await fetch("/api/events?status=ACTIVE")
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
        
        // Auto-select logic: pick first scannable event on initial load,
        // or if previously selected event is no longer active
        const scannableEvents = data.filter((e: Event) => !(e.type === "INTRAMURAL" && !e.parentEventId))
        if (scannableEvents.length > 0) {
          const currentStillActive = selectedEventId && scannableEvents.some((e: Event) => e.id === selectedEventId)
          if ((isInitial && !selectedEventId) || !currentStillActive) {
            setSelectedEvent(scannableEvents[0].name)
            setSelectedEventId(scannableEvents[0].id)
          }
        } else if (data.length === 0) {
          setSelectedEvent("Select Event")
          setSelectedEventId(null)
        }
      }

      // Always fetch upcoming events for SG Officers (check role directly from localStorage)
      const currentUser = getCurrentUser()
      if (currentUser?.role === "sg_officer") {
        const upRes = await fetch("/api/events?status=UPCOMING")
        if (upRes.ok) {
          const upData = await upRes.json()
          setUpcomingEvents(upData)
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

    // Auto-switch to time-out mode if time-in period has ended
    let effectiveScanMode = scanMode
    if (scanMode === "time-in" && isTimeOutAvailable()) {
      effectiveScanMode = "time-out"
      setScanMode("time-out")
      console.log("Auto-switched to time-out mode")
    }

    // Prevent time-out scans before scheduled time
    if (effectiveScanMode === "time-out" && !isTimeOutAvailable()) {
      const event = events.find(e => e.id === selectedEventId)
      setScanError(`Time Out scanning not available until ${event?.timeOut || "scheduled time"}`)
      playBeep(false)
      return
    }

    // Prevent time-out scans after grace period has ended
    const graceInfo = getTimeOutGraceInfo()
    if (effectiveScanMode === "time-out" && graceInfo?.status === "grace-ended") {
      setScanError("Time Out grace period has ended. Event is now closed.")
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

      // Only students can have attendance recorded
      if (student.role !== "STUDENT") {
        setScanError(`${student.name} is not a student. Attendance is only for students.`)
        playBeep(false)
        return
      }
      
      // For time-out, check if student has checked in first
      let missedTimeIn = false
      const currentPeriod = getCurrentPeriod()
      if (effectiveScanMode === "time-out") {
        // Check if already scanned for time-out in current period
        const alreadyTimedOut = scanHistory.find(
          s => s.schoolId === student.schoolId && s.eventId === selectedEventId && s.scanType === "time-out" && s.period === currentPeriod
        )
        if (alreadyTimedOut) {
          setScanError(`${student.name} already timed out for ${currentPeriod} period`)
          playBeep(false)
          return
        }
        
        // Check if they have checked in for current period
        const hasCheckedIn = scanHistory.find(
          s => s.schoolId === student.schoolId && s.eventId === selectedEventId && s.scanType === "time-in" && s.period === currentPeriod && s.status === "approved"
        )
        
        if (!hasCheckedIn) {
          // Check database for existing time-in for this period
          try {
            const attendanceRes = await fetch(`/api/attendance?userId=${student.id}&eventId=${selectedEventId}`)
            if (attendanceRes.ok) {
              const records = await attendanceRes.json()
              let hasDbTimeIn = false
              if (records.length > 0) {
                if (currentPeriod === "morning") hasDbTimeIn = !!records[0].timeIn
                else if (currentPeriod === "afternoon") hasDbTimeIn = !!records[0].afternoonTimeIn
                else if (currentPeriod === "evening") hasDbTimeIn = !!records[0].eveningTimeIn
              }
              if (!hasDbTimeIn) {
                missedTimeIn = true
              }
            }
          } catch (err) {
            console.error("Error checking attendance:", err)
          }
        }
      } else {
        // For time-in, check if time-in period is still available
        if (!isTimeInAvailable()) {
          setScanError(`Time-in period has ended for ${currentPeriod}.`)
          playBeep(false)
          return
        }
        
        // For time-in, check if already scanned for current period
        const alreadyScanned = scanHistory.find(
          s => s.schoolId === student.schoolId && s.eventId === selectedEventId && s.scanType === "time-in" && s.period === currentPeriod
        )
        if (alreadyScanned) {
          setScanError(`${student.name} already scanned for ${currentPeriod} time-in`)
          playBeep(false)
          return
        }
      }
      
      const selectedEventData = events.find(e => e.id === selectedEventId)
      
      const now = new Date()
      
      // Calculate late minutes based on current period's time-in
      let lateMinutes = 0
      const effectiveTimes = getEffectiveTimes()
      if (effectiveTimes.timeIn && effectiveScanMode === "time-in") {
        const [hours, mins] = effectiveTimes.timeIn.split(":").map(Number)
        const eventStartTime = new Date()
        eventStartTime.setHours(hours, mins, 0, 0)
        lateMinutes = Math.max(0, Math.floor((now.getTime() - eventStartTime.getTime()) / 60000))
      }
      const isLate = lateMinutes > LATE_THRESHOLD_MINUTES

      const scannedStudent: ScannedStudent = {
        id: Date.now().toString(),
        schoolId: student.schoolId,
        userId: student.id,
        name: student.name,
        course: student.course || "N/A",
        year: student.year || "N/A",
        event: selectedEvent,
        eventId: selectedEventId,
        timeIn: effectiveScanMode === "time-in" ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        timeOut: effectiveScanMode === "time-out" ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        scanType: effectiveScanMode,
        period: currentPeriod,
        status: "approved",
        lateMinutes: effectiveScanMode === "time-in" && isLate ? lateMinutes : (missedTimeIn ? -1 : undefined),
      }

      // Auto-save to database immediately
      // Mark as LATE if: late for time-in, OR missed time-in entirely (time-out only)
      const attendanceStatus = missedTimeIn ? "LATE" : (effectiveScanMode === "time-out" ? "PRESENT" : (isLate ? "LATE" : "PRESENT"))
      
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
          type: effectiveScanMode,
        })
        setPendingOfflineCount(getPendingRecords().length)
        playBeep(true)
        setScanHistory([scannedStudent, ...scanHistory])
        
        // Show appropriate offline toast
        if (missedTimeIn) {
          toast.warning(`Saved offline: ${student.name} - Time Out (Marked LATE - No Time In)`)
        } else {
          toast.warning(`Saved offline: ${student.name} (${effectiveScanMode === "time-in" ? "Time In" : "Time Out"})`)
        }
      } else {
        // Save to database immediately
        try {
          const response = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: student.id,
              eventId: selectedEventId,
              type: effectiveScanMode,
              period: currentPeriod,
              status: attendanceStatus,
            }),
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || "Failed to record attendance")
          }

          playBeep(true)
          setScanHistory([scannedStudent, ...scanHistory])
          
          // Only show toast for warnings (late arrival, missed time-in)
          if (missedTimeIn) {
            toast.warning(`Time Out: ${student.name} (Marked LATE - No Time In)`)
          } else if (isLate && effectiveScanMode === "time-in") {
            toast.warning(`Time In: ${student.name} (Late: ${lateMinutes} mins)`)
          }
          // No toast for normal successful scans - just beep sound
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
              type: effectiveScanMode,
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

  // SG Officer lock screen — scanner is locked until an event is ACTIVE
  if (isSGOfficer && events.length === 0) {
    // Find the next upcoming event to show countdown
    const sortedUpcoming = [...upcomingEvents]
      .filter(e => e.status === "UPCOMING")
      .sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        const [hA, mA] = a.timeIn.split(":").map(Number)
        const [hB, mB] = b.timeIn.split(":").map(Number)
        dateA.setHours(hA, mA, 0, 0)
        dateB.setHours(hB, mB, 0, 0)
        return dateA.getTime() - dateB.getTime()
      })

    // Calculate countdown for any upcoming event
    const getCountdown = (event: UpcomingEvent) => {
      const eventDate = new Date(event.date)
      const eventYear = eventDate.getUTCFullYear()
      const eventMonth = eventDate.getUTCMonth()
      const eventDay = eventDate.getUTCDate()

      const [h, m] = event.timeIn.split(":").map(Number)
      const startTime = new Date(eventYear, eventMonth, eventDay, h, m, 0)
      const diff = startTime.getTime() - currentTime.getTime()
      if (diff <= 0) return null

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const secs = Math.floor((diff % (1000 * 60)) / 1000)

      return { days, hours, mins, secs, total: diff }
    }

    const nextEvent = sortedUpcoming[0] || null
    const countdown = nextEvent ? getCountdown(nextEvent) : null

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="bg-card rounded-2xl border border-border/50 p-6 sm:p-10 max-w-lg w-full text-center space-y-6">
          {/* Lock Icon */}
          <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24">
            <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-orange-500/10 flex items-center justify-center">
              <Lock className="w-10 h-10 sm:w-12 sm:h-12 text-orange-500" />
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Scanner Locked</h1>
            <p className="text-muted-foreground text-sm mt-2">
              The QR scanner will automatically unlock when an event starts
            </p>
          </div>

          {/* Countdown Timer for next event */}
          {countdown && nextEvent && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 space-y-3">
              <p className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold uppercase tracking-widest">Next Event Starts In</p>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                {countdown.days > 0 && (
                  <>
                    <div className="flex flex-col items-center">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                        <span className="text-emerald-500 text-xl sm:text-2xl font-mono font-bold">{countdown.days}</span>
                      </div>
                      <span className="text-emerald-600/50 dark:text-emerald-400/50 text-[10px] mt-1 uppercase">Days</span>
                    </div>
                    <span className="text-emerald-500/40 text-xl font-bold mt-[-16px]">:</span>
                  </>
                )}
                <div className="flex flex-col items-center">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    <span className="text-emerald-500 text-xl sm:text-2xl font-mono font-bold">{String(countdown.hours).padStart(2, '0')}</span>
                  </div>
                  <span className="text-emerald-600/50 dark:text-emerald-400/50 text-[10px] mt-1 uppercase">Hours</span>
                </div>
                <span className="text-emerald-500/40 text-xl font-bold mt-[-16px]">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    <span className="text-emerald-500 text-xl sm:text-2xl font-mono font-bold">{String(countdown.mins).padStart(2, '0')}</span>
                  </div>
                  <span className="text-emerald-600/50 dark:text-emerald-400/50 text-[10px] mt-1 uppercase">Mins</span>
                </div>
                <span className="text-emerald-500/40 text-xl font-bold mt-[-16px]">:</span>
                <div className="flex flex-col items-center">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    <span className="text-emerald-500 text-xl sm:text-2xl font-mono font-bold">{String(countdown.secs).padStart(2, '0')}</span>
                  </div>
                  <span className="text-emerald-600/50 dark:text-emerald-400/50 text-[10px] mt-1 uppercase">Secs</span>
                </div>
              </div>
              <p className="text-emerald-600/70 dark:text-emerald-400/70 text-xs font-medium">{nextEvent.name}</p>
            </div>
          )}

          {/* Upcoming Events Schedule */}
          {sortedUpcoming.length > 0 ? (
            <div className="text-left space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Upcoming Events
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sortedUpcoming.slice(0, 5).map((event) => {
                  const eventDate = new Date(event.date)
                  const isToday = eventDate.toDateString() === new Date().toDateString()
                  const evtCountdown = getCountdown(event)
                  return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border text-sm ${
                        isToday
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/30 border-border/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground text-sm">{event.name}</p>
                        {isToday && (
                          <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">TODAY</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.timeIn} - {event.timeOut}
                        </span>
                        {event.afternoonTimeIn && event.afternoonTimeOut && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Clock className="w-3 h-3" />
                            {event.afternoonTimeIn} - {event.afternoonTimeOut}
                          </span>
                        )}
                        {event.eveningTimeIn && event.eveningTimeOut && (
                          <span className="flex items-center gap-1 text-violet-500">
                            <Clock className="w-3 h-3" />
                            {event.eveningTimeIn} - {event.eveningTimeOut}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.venue}
                        </span>
                      </div>
                      {evtCountdown && (
                        <p className="text-[11px] text-primary font-medium mt-1.5">
                          ⏱ {evtCountdown.days > 0 ? `${evtCountdown.days}d ` : ""}{String(evtCountdown.hours).padStart(2, '0')}h {String(evtCountdown.mins).padStart(2, '0')}m {String(evtCountdown.secs).padStart(2, '0')}s
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground/60 text-xs">No upcoming events scheduled</p>
          )}

          <p className="text-muted-foreground/40 text-[10px]">
            This page auto-refreshes every 10 seconds
          </p>
        </div>
      </div>
    )
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
        <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-2 border-yellow-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <WifiOff className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-yellow-700 dark:text-yellow-300">Offline Mode Active</p>
              <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80 mt-1">
                You can still scan QR codes! Records will be saved on this device ({getDeviceInfo().deviceName.replace(/📱|💻|🖥️|📟/g, '').trim()}) 
                and automatically synced when you&apos;re back online.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded font-mono">
                  {getDeviceInfo().deviceId}
                </span>
                {pendingOfflineCount > 0 && (
                  <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                    {pendingOfflineCount} records pending sync
                  </span>
                )}
              </div>
            </div>
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
              ) : (() => {
                const scannableEvents = events.filter(e => !(e.type === "INTRAMURAL" && !e.parentEventId))
                
                // If only 1 scannable event (or SG Officer), show it directly
                if (scannableEvents.length === 1) {
                  return (
                    <div className="w-full px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">{scannableEvents[0].parentEventId ? `🏆 ${scannableEvents[0].name}` : scannableEvents[0].name}</span>
                      <span className="ml-auto text-xs text-green-600 dark:text-green-400">Active</span>
                    </div>
                  )
                }
                
                // Multiple scannable events — show dropdown
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="truncate">{selectedEvent}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                      {scannableEvents.map((event) => (
                        <DropdownMenuItem 
                          key={event.id} 
                          onClick={() => { setSelectedEvent(event.name); setSelectedEventId(event.id); }}
                          className={selectedEventId === event.id ? "bg-primary/10 text-primary" : ""}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {selectedEventId === event.id && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                            <span className="truncate">{event.parentEventId ? `🏆 ${event.name}` : event.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              })()}
            </div>
            
            {/* Event Time Info */}
            {selectedEventId && events.find(e => e.id === selectedEventId) && (() => {
              const evt = events.find(e => e.id === selectedEventId)!
              const period = getCurrentPeriod()
              return (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {/* Current Period Indicator */}
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {period.charAt(0).toUpperCase() + period.slice(1)} Period
                    </span>
                    {(evt.afternoonTimeIn || evt.eveningTimeIn) && <span className="text-muted-foreground">Multi-period event</span>}
                  </div>
                  {/* Morning - only show if morning times are configured */}
                  {evt.timeIn && (
                    <div className={`flex items-center gap-4 text-sm ${period === "morning" ? "text-foreground" : "text-muted-foreground/60"}`}>
                      <span className="text-xs font-medium w-16">Morning</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        <span className="font-medium">{formatTimeDisplay(evt.timeIn)}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span className="font-medium">{evt.timeOut ? formatTimeDisplay(evt.timeOut) : "—"}</span>
                      </div>
                    </div>
                  )}
                  {/* Afternoon */}
                  {evt.afternoonTimeIn && (
                    <div className={`flex items-center gap-4 text-sm ${period === "afternoon" ? "text-foreground" : "text-muted-foreground/60"}`}>
                      <span className="text-xs font-medium w-16">Afternoon</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        <span className="font-medium">{formatTimeDisplay(evt.afternoonTimeIn)}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span className="font-medium">{evt.afternoonTimeOut ? formatTimeDisplay(evt.afternoonTimeOut) : "—"}</span>
                      </div>
                    </div>
                  )}
                  {/* Evening */}
                  {evt.eveningTimeIn && (
                    <div className={`flex items-center gap-4 text-sm ${period === "evening" ? "text-foreground" : "text-muted-foreground/60"}`}>
                      <span className="text-xs font-medium w-16">Evening</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        <span className="font-medium">{formatTimeDisplay(evt.eveningTimeIn)}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span className="font-medium">{evt.eveningTimeOut ? formatTimeDisplay(evt.eveningTimeOut) : "—"}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
            
            {/* Scan Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Scan Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (isTimeInAvailable()) {
                      setScanMode("time-in")
                      setScanError(null)
                    }
                  }}
                  disabled={!isTimeInAvailable()}
                  className={`py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    !isTimeInAvailable()
                      ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                      : scanMode === "time-in"
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Time In
                </button>
                <button
                  onClick={() => {
                    if (isTimeOutAvailable() && getTimeOutGraceInfo()?.status !== "grace-ended") {
                      setScanMode("time-out")
                      setScanError(null)
                    }
                  }}
                  disabled={!isTimeOutAvailable() || getTimeOutGraceInfo()?.status === "grace-ended"}
                  className={`py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    !isTimeOutAvailable() || getTimeOutGraceInfo()?.status === "grace-ended"
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
            </div>
          </div>
        </div>

        {/* Scan Status Panel */}
        <div className="lg:sticky lg:top-6 space-y-4 self-start">
          {scannedData ? (
            <div className={`bg-card rounded-lg border-2 p-4 sm:p-6 space-y-3 sm:space-y-4 ${
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
            <div className="bg-card rounded-lg border border-dashed border-border p-4 sm:p-6 text-center space-y-2 sm:space-y-3">
              <QrCode className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-semibold text-foreground">Ready to Scan</p>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                  Point the camera at a student's QR code for <span className={`font-medium ${scanMode === "time-in" ? "text-green-600" : "text-orange-600"}`}>{scanMode === "time-in" ? "Time In" : "Time Out"}</span>
                  {selectedEventId && (
                    <span className="text-muted-foreground ml-1">({getCurrentPeriod()})</span>
                  )}
                </p>
                {!selectedEventId && (
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-2 font-medium">
                    ⚠️ Please select an event first
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Scan Summary Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-card rounded-lg border border-border p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Time In</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {scanHistory.filter((s) => s.scanType === "time-in" && s.status === "approved").length}
              </p>
            </div>
            <div className="bg-card rounded-lg border border-border p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Out</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {scanHistory.filter((s) => s.scanType === "time-out" && s.status === "approved").length}
              </p>
            </div>
            <div className="bg-card rounded-lg border border-border p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{scanHistory.length}</p>
            </div>
          </div>

          {/* Time Out Availability Notice */}
          {selectedEventId && !isTimeOutAvailable() && (
            <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-2 border-orange-500/30 rounded-xl p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-orange-600 dark:text-orange-400">Time Out not yet available ({getCurrentPeriod()})</p>
                  <p className="text-sm text-orange-600/80 dark:text-orange-400/80 mt-1">
                    Available at <span className="font-bold">{formatTimeDisplay(getEffectiveTimes().timeOut)}</span>
                  </p>
                  {getTimeUntilTimeOut() && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-orange-600/70 dark:text-orange-400/70">Countdown:</span>
                      <span className="font-mono text-lg font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">
                        {getTimeUntilTimeOut()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Late Countdown Timer - Only show during Time In mode */}
          {selectedEventId && scanMode === "time-in" && isTimeInAvailable() && getLateCountdownInfo() && (
            <div className={`rounded-xl p-4 border-2 shadow-lg ${
              getLateCountdownInfo()?.status === "before-start"
                ? "bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30"
                : getLateCountdownInfo()?.status === "on-time"
                  ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30"
                  : "bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  getLateCountdownInfo()?.status === "before-start"
                    ? "bg-blue-500/20"
                    : getLateCountdownInfo()?.status === "on-time"
                      ? "bg-green-500/20"
                      : "bg-red-500/20"
                }`}>
                  <AlertCircle className={`w-5 h-5 ${
                    getLateCountdownInfo()?.status === "before-start"
                      ? "text-blue-500"
                      : getLateCountdownInfo()?.status === "on-time"
                        ? "text-green-500"
                        : "text-red-500"
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold ${
                      getLateCountdownInfo()?.status === "before-start"
                        ? "text-blue-600 dark:text-blue-400"
                        : getLateCountdownInfo()?.status === "on-time"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                    }`}>
                      {getLateCountdownInfo()?.status === "before-start" && "Event Starting Soon"}
                      {getLateCountdownInfo()?.status === "on-time" && "Grace Period Active"}
                      {getLateCountdownInfo()?.status === "late" && "Late Period"}
                    </p>
                    {getLateCountdownInfo()?.countdown && (
                      <span className={`font-mono text-xl font-bold px-3 py-1 rounded-lg ${
                        getLateCountdownInfo()?.status === "on-time"
                          ? "text-green-500 bg-green-500/10"
                          : "text-blue-500 bg-blue-500/10"
                      }`}>
                        {getLateCountdownInfo()?.countdown}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${
                    getLateCountdownInfo()?.status === "before-start"
                      ? "text-blue-600/80 dark:text-blue-400/80"
                      : getLateCountdownInfo()?.status === "on-time"
                        ? "text-green-600/80 dark:text-green-400/80"
                        : "text-red-600/80 dark:text-red-400/80"
                  }`}>
                    {getLateCountdownInfo()?.status === "before-start" && getLateCountdownInfo()?.message}
                    {getLateCountdownInfo()?.status === "on-time" && (
                      <>Students arriving now will be marked <span className="font-bold bg-green-500/20 px-1 rounded">ON TIME</span></>
                    )}
                    {getLateCountdownInfo()?.status === "late" && (
                      <>Students arriving now will be marked <span className="font-bold bg-red-500/20 px-1 rounded">LATE</span> ({getLateCountdownInfo()?.message})</>
                    )}
                  </p>
                </div>
              </div>
              {/* Progress bar for grace period */}
              {getLateCountdownInfo()?.status === "on-time" && (
                <div className="mt-3 h-2 bg-green-200 dark:bg-green-900/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-1000 ease-linear rounded-full"
                    style={{ 
                      width: `${Math.max(0, 100 - ((getLateCountdownInfo()?.minutesSinceStart || 0) / LATE_THRESHOLD_MINUTES) * 100)}%` 
                    }}
                  />
                </div>
              )}
              {/* Progress bar for late period */}
              {getLateCountdownInfo()?.status === "late" && (
                <div className="mt-3 h-2 bg-red-200 dark:bg-red-900/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-400 to-red-500 w-full rounded-full animate-pulse" />
                </div>
              )}
            </div>
          )}
          
          {/* Time Out Active Notice with Grace Period Countdown */}
          {selectedEventId && isTimeOutAvailable() && (
            <div className={`border-2 rounded-xl p-4 shadow-lg ${
              getTimeOutGraceInfo()?.status === "grace-active"
                ? "bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/30"
                : getTimeOutGraceInfo()?.status === "grace-ended"
                  ? "bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30"
                  : getTimeOutGraceInfo()?.status === "period-ended"
                    ? "bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30"
                    : "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  getTimeOutGraceInfo()?.status === "grace-active"
                    ? "bg-orange-500/20"
                    : getTimeOutGraceInfo()?.status === "grace-ended"
                      ? "bg-red-500/20"
                      : getTimeOutGraceInfo()?.status === "period-ended"
                        ? "bg-blue-500/20"
                        : "bg-green-500/20"
                }`}>
                  {getTimeOutGraceInfo()?.status === "grace-active" ? (
                    <Clock className="w-5 h-5 text-orange-500" />
                  ) : getTimeOutGraceInfo()?.status === "grace-ended" ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : getTimeOutGraceInfo()?.status === "period-ended" ? (
                    <Clock className="w-5 h-5 text-blue-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold ${
                      getTimeOutGraceInfo()?.status === "grace-active"
                        ? "text-orange-600 dark:text-orange-400"
                        : getTimeOutGraceInfo()?.status === "grace-ended"
                          ? "text-red-600 dark:text-red-400"
                          : getTimeOutGraceInfo()?.status === "period-ended"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-green-600 dark:text-green-400"
                    }`}>
                      {getTimeOutGraceInfo()?.status === "grace-active" && `Time Out Available (${getCurrentPeriod()})`}
                      {getTimeOutGraceInfo()?.status === "grace-ended" && "Time Out Closed"}
                      {getTimeOutGraceInfo()?.status === "period-ended" && `${getCurrentPeriod().charAt(0).toUpperCase() + getCurrentPeriod().slice(1)} Period Ended`}
                      {!getTimeOutGraceInfo() && "Time Out Active"}
                    </p>
                    {getTimeOutGraceInfo()?.countdown && (
                      <span className="font-mono text-xl font-bold px-3 py-1 rounded-lg text-orange-500 bg-orange-500/10">
                        {getTimeOutGraceInfo()?.countdown}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${
                    getTimeOutGraceInfo()?.status === "grace-active"
                      ? "text-orange-600/80 dark:text-orange-400/80"
                      : getTimeOutGraceInfo()?.status === "grace-ended"
                        ? "text-red-600/80 dark:text-red-400/80"
                        : getTimeOutGraceInfo()?.status === "period-ended"
                          ? "text-blue-600/80 dark:text-blue-400/80"
                          : "text-green-600/80 dark:text-green-400/80"
                  }`}>
                    {getTimeOutGraceInfo()?.status === "grace-active" && (
                      <>Students can now Time Out within <span className="font-bold bg-orange-500/20 px-1 rounded">{getTimeOutGraceInfo()?.gracePeriod} min</span> window</>
                    )}
                    {getTimeOutGraceInfo()?.status === "grace-ended" && (
                      <>Time Out window closed. Event will be automatically closed.</>
                    )}
                    {getTimeOutGraceInfo()?.status === "period-ended" && (
                      <>{getTimeOutGraceInfo()?.message}</>
                    )}
                    {!getTimeOutGraceInfo() && (
                      <>Time In period has ended. Scanning for <span className="font-bold">Time Out</span> only.</>
                    )}
                  </p>
                </div>
              </div>
              {/* Progress bar for grace period */}
              {getTimeOutGraceInfo()?.status === "grace-active" && getTimeOutGraceInfo()?.gracePeriod && (
                <div className="mt-3 h-2 bg-orange-200 dark:bg-orange-900/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1000 ease-linear rounded-full"
                    style={{ 
                      width: `${Math.max(0, (getTimeOutGraceInfo()?.timeRemaining || 0) / (getTimeOutGraceInfo()!.gracePeriod * 60 * 1000) * 100)}%` 
                    }}
                  />
                </div>
              )}
              {/* Alert for grace ending */}
              {getTimeOutGraceInfo()?.status === "grace-ended" && (
                <div className="mt-3 h-2 bg-red-200 dark:bg-red-900/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-400 to-red-500 w-full rounded-full animate-pulse" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scan History */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted p-3 sm:p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm sm:text-base">Today's Scan History</h3>
          <div className="flex items-center gap-2">
            {scanHistory.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">{scanHistory.length} records</span>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all scan history?')) {
                      setScanHistory([])
                      localStorage.removeItem(getTodayKey())
                    }
                  }}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Clear all scan history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {scanHistory.length > 0 ? (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
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
                      {scan.period && scan.period !== "morning" && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          scan.period === "afternoon" ? "bg-blue-500/10 text-blue-500" : "bg-violet-500/10 text-violet-500"
                        }`}>
                          {scan.period.toUpperCase()}
                        </span>
                      )}
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
