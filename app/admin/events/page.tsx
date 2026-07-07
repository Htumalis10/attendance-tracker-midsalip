"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Clock, MapPin, Users, Edit, Archive, Eye, X, Loader2, CalendarIcon, WifiOff, Trophy, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { getCurrentUser } from "@/lib/auth"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/ui/time-picker"
import { format } from "date-fns"
import { formatTimeDisplay } from "@/lib/time-utils"

interface Event {
  id: string
  name: string
  description?: string
  date: string
  venue: string
  organizer: string
  timeIn: string
  timeOut: string
  afternoonTimeIn?: string | null
  afternoonTimeOut?: string | null
  eveningTimeIn?: string | null
  eveningTimeOut?: string | null
  status: string
  type: string
  parentEventId?: string | null
  createdAt: string
  _count?: {
    attendanceRecords: number
    certificates: number
  }
  games?: Event[]
}

export default function EventManagement() {
  const router = useRouter()

  // Admin-only page guard
  useEffect(() => {
    const user = getCurrentUser()
    if (user && user.role !== "admin") {
      router.push("/admin/dashboard")
    }
  }, [router])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Archive state (stored in localStorage to avoid schema change)
  const ARCHIVED_EVENTS_KEY = "smartcode_archived_event_ids"
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const stored = localStorage.getItem(ARCHIVED_EVENTS_KEY)
      return new Set(stored ? JSON.parse(stored) : [])
    } catch { return new Set() }
  })
  const [showArchived, setShowArchived] = useState(false)

  // Attendance view state
  const [attendanceViewEvent, setAttendanceViewEvent] = useState<Event | null>(null)
  const [attendanceViewRecords, setAttendanceViewRecords] = useState<any[]>([])
  const [attendanceViewLoading, setAttendanceViewLoading] = useState(false)

  // Schedule type for the create form
  type ScheduleType = "morning" | "afternoon" | "evening" | "whole-day" | "morning-afternoon" | "custom"
  const [scheduleType, setScheduleType] = useState<ScheduleType>("morning")

  // Form state for new event
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    date: undefined as Date | undefined,
    venue: "",
    organizer: "",
    timeIn: "",
    timeOut: "",
    afternoonTimeIn: "",
    afternoonTimeOut: "",
    eveningTimeIn: "",
    eveningTimeOut: "",
    status: "UPCOMING",
    type: "REGULAR" as "REGULAR" | "INTRAMURAL",
  })

  // When schedule type changes, auto-clear irrelevant fields and set smart defaults
  const handleScheduleChange = (type: ScheduleType) => {
    setScheduleType(type)
    switch (type) {
      case "morning":
        setNewEvent(prev => ({ ...prev, afternoonTimeIn: "", afternoonTimeOut: "", eveningTimeIn: "", eveningTimeOut: "" }))
        break
      case "afternoon":
        setNewEvent(prev => ({ ...prev, timeIn: "", timeOut: "", eveningTimeIn: "", eveningTimeOut: "" }))
        break
      case "evening":
        setNewEvent(prev => ({ ...prev, timeIn: "", timeOut: "", afternoonTimeIn: "", afternoonTimeOut: "" }))
        break
      case "whole-day":
        // Keep all fields
        break
      case "morning-afternoon":
        setNewEvent(prev => ({ ...prev, eveningTimeIn: "", eveningTimeOut: "" }))
        break
      case "custom":
        // Keep all fields, user controls everything
        break
    }
  }

  // Helper: determine which periods are visible based on schedule type
  const showMorning = ["morning", "whole-day", "morning-afternoon", "custom"].includes(scheduleType)
  const showAfternoon = ["afternoon", "whole-day", "morning-afternoon", "custom"].includes(scheduleType)
  const showEvening = ["evening", "whole-day", "custom"].includes(scheduleType)
  
  // Games for multi-activity events
  const [intramuralGames, setIntramuralGames] = useState<{name: string, timeIn: string, timeOut: string, afternoonTimeIn: string, afternoonTimeOut: string, eveningTimeIn: string, eveningTimeOut: string}[]>([])
  
  // Track expanded game lists
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({})

  // Form state for editing event
  const [editEventDate, setEditEventDate] = useState<Date | undefined>(undefined)

  // Offline state
  const [isOnline, setIsOnline] = useState(true)
  const OFFLINE_EVENTS_KEY = "smartcode_offline_events"

  // Monitor online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => {
      setIsOnline(true)
      toast.success("Back online! Syncing offline events...")
      syncOfflineEvents()
    }
    const handleOffline = () => {
      setIsOnline(false)
      toast.warning("You're offline. Events will be saved locally.")
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Save event to offline queue
  const saveEventOffline = (eventData: any) => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_EVENTS_KEY) || "[]")
    queue.push({ ...eventData, offlineId: `offline_${Date.now()}`, createdAt: new Date().toISOString() })
    localStorage.setItem(OFFLINE_EVENTS_KEY, JSON.stringify(queue))
  }

  // Sync offline events when back online
  const syncOfflineEvents = async () => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_EVENTS_KEY) || "[]")
    if (queue.length === 0) return

    let synced = 0
    const remaining: any[] = []

    for (const eventData of queue) {
      try {
        const { offlineId, createdAt, ...data } = eventData
        const response = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (response.ok) {
          synced++
        } else {
          remaining.push(eventData)
        }
      } catch {
        remaining.push(eventData)
      }
    }

    localStorage.setItem(OFFLINE_EVENTS_KEY, JSON.stringify(remaining))
    if (synced > 0) {
      toast.success(`Synced ${synced} offline event${synced > 1 ? "s" : ""}`)
      fetchEvents()
    }
    if (remaining.length > 0) {
      toast.warning(`${remaining.length} event${remaining.length > 1 ? "s" : ""} still pending sync`)
    }
  }

  // Try to sync on mount if online
  useEffect(() => {
    if (navigator.onLine) {
      syncOfflineEvents()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch events from API
  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      if (!navigator.onLine) {
        // Show offline pending events count
        const offlineQueue = JSON.parse(localStorage.getItem(OFFLINE_EVENTS_KEY) || "[]")
        if (offlineQueue.length > 0) {
          toast.info(`${offlineQueue.length} event${offlineQueue.length > 1 ? "s" : ""} pending sync`)
        }
        setIsLoading(false)
        return
      }
      const response = await fetch("/api/events")
      if (!response.ok) throw new Error("Failed to fetch events")
      const data = await response.json()
      setEvents(data)
    } catch (err) {
      setError("Failed to load events")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleManageEvent = (event: Event) => {
    setSelectedEvent(event)
    setShowEditModal(true)
  }

  const handleArchiveEvent = (event: Event) => {
    setArchivedIds(prev => {
      const next = new Set(prev)
      if (next.has(event.id)) {
        next.delete(event.id)
        toast.success(`Event "${event.name}" restored`)
      } else {
        next.add(event.id)
        toast.success(`Event "${event.name}" archived (data preserved)`)
      }
      localStorage.setItem(ARCHIVED_EVENTS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const handleViewAttendance = async (event: Event) => {
    setAttendanceViewEvent(event)
    setAttendanceViewLoading(true)
    setAttendanceViewRecords([])
    try {
      const res = await fetch(`/api/attendance?eventId=${event.id}`)
      if (res.ok) {
        const data = await res.json()
        // Sort alphabetically by name
        data.sort((a: any, b: any) => a.user.name.localeCompare(b.user.name))
        setAttendanceViewRecords(data)
      }
    } catch {
      toast.error("Failed to load attendance")
    } finally {
      setAttendanceViewLoading(false)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const eventData = {
        ...newEvent,
        date: newEvent.date ? format(newEvent.date, "yyyy-MM-dd") : "",
      }

      if (!isOnline) {
        // Save offline
        saveEventOffline(eventData)
        
        // If multi-activity, also queue the games
        if (newEvent.type === "INTRAMURAL" && intramuralGames.length > 0) {
          for (const game of intramuralGames) {
            saveEventOffline({
              name: game.name,
              date: newEvent.date ? format(newEvent.date, "yyyy-MM-dd") : "",
              venue: newEvent.venue,
              organizer: newEvent.organizer,
              timeIn: game.timeIn,
              timeOut: game.timeOut,
              afternoonTimeIn: game.afternoonTimeIn || undefined,
              afternoonTimeOut: game.afternoonTimeOut || undefined,
              eveningTimeIn: game.eveningTimeIn || undefined,
              eveningTimeOut: game.eveningTimeOut || undefined,
              type: "INTRAMURAL",
              _pendingParent: true,
            })
          }
        }

        setShowAddModal(false)
        setNewEvent({
          name: "",
          description: "",
          date: undefined,
          venue: "",
          organizer: "",
          timeIn: "",
          timeOut: "",
          afternoonTimeIn: "",
          afternoonTimeOut: "",
          eveningTimeIn: "",
          eveningTimeOut: "",
          status: "UPCOMING",
          type: "REGULAR",
        })
        setIntramuralGames([])
        toast.success("Event saved offline. Will sync when back online.")
        return
      }

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create event")
      }

      const createdEvent = await response.json()
      
      // If multi-activity, create games as child events
      if (newEvent.type === "INTRAMURAL" && intramuralGames.length > 0) {
        for (const game of intramuralGames) {
          await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: game.name,
              date: newEvent.date ? format(newEvent.date, "yyyy-MM-dd") : "",
              venue: newEvent.venue,
              organizer: newEvent.organizer,
              timeIn: game.timeIn,
              timeOut: game.timeOut,
              afternoonTimeIn: game.afternoonTimeIn || undefined,
              afternoonTimeOut: game.afternoonTimeOut || undefined,
              eveningTimeIn: game.eveningTimeIn || undefined,
              eveningTimeOut: game.eveningTimeOut || undefined,
              type: "INTRAMURAL",
              parentEventId: createdEvent.id,
            }),
          })
        }
      }

      setShowAddModal(false)
      setNewEvent({
        name: "",
        description: "",
        date: undefined,
        venue: "",
        organizer: "",
        timeIn: "",
        timeOut: "",
        afternoonTimeIn: "",
        afternoonTimeOut: "",
        eveningTimeIn: "",
        eveningTimeOut: "",
        status: "UPCOMING",
        type: "REGULAR",
      })
      setIntramuralGames([])
      toast.success("Event created successfully")
      fetchEvents()
    } catch (err: any) {
      toast.error(err.message || "Failed to create event")
    }
  }

  const handleSaveEvent = async (formData: any) => {
    if (!selectedEvent) return

    try {
      // Extract games data from formData
      const { games, ...eventFormData } = formData

      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventFormData),
      })

      if (!response.ok) throw new Error("Failed to update event")

      // Handle games CRUD for multi-activity events
      if (selectedEvent.type === "INTRAMURAL" && games) {
        const existingGames = selectedEvent.games || []
        const existingIds = existingGames.map(g => g.id)
        
        // Delete removed games
        for (const existing of existingGames) {
          if (!games.find((g: any) => g.id === existing.id)) {
            await fetch(`/api/events/${existing.id}`, { method: "DELETE" })
          }
        }
        
        // Update existing games and create new ones
        for (const game of games) {
          if (game.id && existingIds.includes(game.id)) {
            // Update existing game
            await fetch(`/api/events/${game.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: game.name,
                timeIn: game.timeIn,
                timeOut: game.timeOut,
                afternoonTimeIn: game.afternoonTimeIn || null,
                afternoonTimeOut: game.afternoonTimeOut || null,
                eveningTimeIn: game.eveningTimeIn || null,
                eveningTimeOut: game.eveningTimeOut || null,
              }),
            })
          } else {
            // Create new game
            await fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: game.name,
                date: eventFormData.date || selectedEvent.date,
                venue: selectedEvent.venue,
                organizer: selectedEvent.organizer,
                timeIn: game.timeIn,
                timeOut: game.timeOut,
                afternoonTimeIn: game.afternoonTimeIn || undefined,
                afternoonTimeOut: game.afternoonTimeOut || undefined,
                eveningTimeIn: game.eveningTimeIn || undefined,
                eveningTimeOut: game.eveningTimeOut || undefined,
                type: "INTRAMURAL",
                parentEventId: selectedEvent.id,
              }),
            })
          }
        }
      }

      setShowEditModal(false)
      setSelectedEvent(null)
      toast.success("Event updated successfully")
      fetchEvents()
    } catch (err) {
      toast.error("Failed to update event")
    }
  }

  // Format status for display
  const formatStatus = (status: string) => {
    return status.charAt(0) + status.slice(1).toLowerCase()
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Check if event is new (created within last 24 hours)
  const isNewEvent = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffInHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return diffInHours <= 24
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Event Management</h1>
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Create and manage events, assign scanners, and control attendance periods
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowArchived(p => !p)}
            className={`action-button text-sm flex items-center justify-center gap-2 w-full sm:w-auto ${
              showArchived ? "btn-secondary" : "btn-ghost"
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? "Hide Archived" : "Show Archived"}
            {archivedIds.size > 0 && (
              <span className="ml-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {archivedIds.size}
              </span>
            )}
          </button>
          <button onClick={() => setShowAddModal(true)} className="action-button btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Create Event
          </button>
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-3 mb-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Skeleton className="h-14 rounded" />
                <Skeleton className="h-14 rounded" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No events found. Create your first event!</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.filter(e => !e.parentEventId && (showArchived ? archivedIds.has(e.id) : !archivedIds.has(e.id))).map((event) => (
          <div
            key={event.id}
            className={`bg-card rounded-lg border p-6 hover:border-primary/50 transition-colors ${
              isNewEvent(event.createdAt) ? "border-primary/30 ring-1 ring-primary/20" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground text-lg">{event.name}</h3>
                  {isNewEvent(event.createdAt) && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground animate-pulse">
                      New
                    </span>
                  )}
                  {event.type === "INTRAMURAL" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-500/10 text-orange-600 dark:text-orange-400">
                      Multi-Activity
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ml-2 flex-shrink-0 ${
                  event.status === "ACTIVE"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : event.status === "UPCOMING"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                }`}
              >
                {formatStatus(event.status)}
              </span>
            </div>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{event.venue}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{event._count?.attendanceRecords || 0} attendees</span>
              </div>
            </div>

            <div className="space-y-1 mb-4 text-sm">
              {/* Spanning event: morning in → afternoon/evening out */}
              {event.timeIn && !event.timeOut && (event.afternoonTimeOut || event.eveningTimeOut) && !event.afternoonTimeIn ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted p-2 rounded">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Time-In <span className="text-blue-400">(Morning)</span></p>
                    <p className="font-semibold text-foreground">{formatTimeDisplay(event.timeIn)}</p>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Time-Out <span className="text-orange-400">({event.eveningTimeOut && !event.eveningTimeIn ? "Evening" : "Afternoon"})</span></p>
                    <p className="font-semibold text-foreground">{formatTimeDisplay(event.eveningTimeOut && !event.eveningTimeIn ? event.eveningTimeOut : event.afternoonTimeOut!)}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted p-2 rounded">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Morning In</p>
                      <p className="font-semibold text-foreground">{formatTimeDisplay(event.timeIn)}</p>
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Morning Out</p>
                      <p className="font-semibold text-foreground">{formatTimeDisplay(event.timeOut)}</p>
                    </div>
                  </div>
                  {event.afternoonTimeIn && event.afternoonTimeOut && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-500/5 border border-blue-500/10 p-2 rounded">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Afternoon In</p>
                        <p className="font-semibold text-foreground">{formatTimeDisplay(event.afternoonTimeIn)}</p>
                      </div>
                      <div className="bg-blue-500/5 border border-blue-500/10 p-2 rounded">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Afternoon Out</p>
                        <p className="font-semibold text-foreground">{formatTimeDisplay(event.afternoonTimeOut)}</p>
                      </div>
                    </div>
                  )}
                  {event.eveningTimeIn && event.eveningTimeOut && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-violet-500/5 border border-violet-500/10 p-2 rounded">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Evening In</p>
                        <p className="font-semibold text-foreground">{formatTimeDisplay(event.eveningTimeIn)}</p>
                      </div>
                      <div className="bg-violet-500/5 border border-violet-500/10 p-2 rounded">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Evening Out</p>
                        <p className="font-semibold text-foreground">{formatTimeDisplay(event.eveningTimeOut)}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Games list */}
            {event.type === "INTRAMURAL" && event.games && event.games.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <button
                  type="button"
                  onClick={() => setExpandedGames(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                  className="flex items-center gap-1.5 w-full text-left group"
                >
                  <Trophy className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Games ({event.games.length})
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {event.games.reduce((sum, g) => sum + (g._count?.attendanceRecords || 0), 0)} total att.
                  </span>
                  {expandedGames[event.id] ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                {expandedGames[event.id] && event.games.map((game) => (
                  <div key={game.id} className="bg-orange-500/5 border border-orange-500/10 p-2 rounded text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{game.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          game.status === "ACTIVE" ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                          : game.status === "CLOSED" ? "bg-gray-500/10 text-gray-600 dark:text-gray-400" 
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}>{game.status?.toLowerCase()}</span>
                      </div>
                      <span className="font-medium text-foreground">{game._count?.attendanceRecords || 0} att.</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                      <span><span className="text-blue-400 font-medium">AM:</span> {formatTimeDisplay(game.timeIn)} - {formatTimeDisplay(game.timeOut)}</span>
                      {game.afternoonTimeIn && game.afternoonTimeOut && (
                        <span><span className="text-orange-400 font-medium">PM:</span> {formatTimeDisplay(game.afternoonTimeIn)} - {formatTimeDisplay(game.afternoonTimeOut)}</span>
                      )}
                      {game.eveningTimeIn && game.eveningTimeOut && (
                        <span><span className="text-violet-400 font-medium">EVE:</span> {formatTimeDisplay(game.eveningTimeIn)} - {formatTimeDisplay(game.eveningTimeOut)}</span>
                      )}
                    </div>
                  </div>
                ))}
                {!expandedGames[event.id] && (
                  <div className="flex flex-wrap gap-1">
                    {event.games.slice(0, 3).map((game) => (
                      <span key={game.id} className="px-2 py-0.5 bg-orange-500/5 border border-orange-500/10 rounded text-[10px] text-foreground">
                        {game.name}
                      </span>
                    ))}
                    {event.games.length > 3 && (
                      <span className="px-2 py-0.5 text-[10px] text-muted-foreground">+{event.games.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleViewAttendance(event)}
                className="action-button btn-ghost text-sm p-2 text-primary hover:bg-primary/10"
                title="View attendance list"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleManageEvent(event)}
                className="flex-1 action-button btn-secondary text-sm flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Manage Event
              </button>
              <button
                onClick={() => handleArchiveEvent(event)}
                className={`action-button btn-ghost text-sm p-2 transition-colors ${
                  archivedIds.has(event.id)
                    ? "text-green-600 hover:bg-green-500/10"
                    : "text-amber-500 hover:bg-amber-500/10"
                }`}
                title={archivedIds.has(event.id) ? "Restore event" : "Archive event"}
              >
                <Archive className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground mb-4">Create New Event</h2>
            <form
              onSubmit={handleCreateEvent}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Event Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setNewEvent({ ...newEvent, type: "REGULAR" }); setIntramuralGames([]) }}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      newEvent.type === "REGULAR" 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    Regular
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, type: "INTRAMURAL" })}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      newEvent.type === "INTRAMURAL" 
                        ? "bg-orange-500 text-white border-orange-500" 
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    Multi-Activity
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Event Name</label>
                <input
                  type="text"
                  placeholder="Enter event name"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Organizer</label>
                <input
                  type="text"
                  placeholder="Enter organizer"
                  value={newEvent.organizer}
                  onChange={(e) => setNewEvent({ ...newEvent, organizer: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newEvent.date ? format(newEvent.date, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newEvent.date}
                        onSelect={(date) => setNewEvent({ ...newEvent, date })}
                        disabled={(date) => {
                          const d = new Date(date)
                          d.setHours(0, 0, 0, 0)
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          return d < today
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Venue</label>
                  <input
                    type="text"
                    placeholder="Enter venue"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                    required
                  />
                </div>
              </div>
              {/* Event Schedule Selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Event Schedule</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { value: "morning" as ScheduleType, label: "☀️ Morning", desc: "AM only" },
                    { value: "afternoon" as ScheduleType, label: "🌤️ Afternoon", desc: "PM only" },
                    { value: "evening" as ScheduleType, label: "🌙 Evening", desc: "Night only" },
                    { value: "morning-afternoon" as ScheduleType, label: "☀️🌤️ AM + PM", desc: "Morning & Afternoon" },
                    { value: "whole-day" as ScheduleType, label: "📅 Whole Day", desc: "AM + PM + Eve" },
                    { value: "custom" as ScheduleType, label: "⚙️ Custom", desc: "Pick periods" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleScheduleChange(opt.value)}
                      className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                        scheduleType === opt.value
                          ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20"
                          : "bg-background border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className={`text-[10px] mt-0.5 ${scheduleType === opt.value ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Morning Time Fields */}
              {showMorning && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
                  <label className="block text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">☀️ Morning Period</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Time-In</label>
                      <TimePicker
                        value={newEvent.timeIn}
                        onChange={(value) => setNewEvent({ ...newEvent, timeIn: value })}
                        fixedPeriod="AM"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Time-Out</label>
                      <TimePicker
                        value={newEvent.timeOut}
                        onChange={(value) => setNewEvent({ ...newEvent, timeOut: value })}
                        fixedPeriod="AM"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Afternoon Time Fields */}
              {showAfternoon && (
                <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg p-3">
                  <label className="block text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">🌤️ Afternoon Period</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Time-In</label>
                      <TimePicker
                        value={newEvent.afternoonTimeIn || ""}
                        onChange={(value) => setNewEvent({ ...newEvent, afternoonTimeIn: value })}
                        fixedPeriod="PM"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Time-Out</label>
                      <TimePicker
                        value={newEvent.afternoonTimeOut || ""}
                        onChange={(value) => setNewEvent({ ...newEvent, afternoonTimeOut: value })}
                        fixedPeriod="PM"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Evening Time Fields */}
              {showEvening && (
                <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg p-3">
                  <label className="block text-sm font-medium text-violet-600 dark:text-violet-400 mb-2">🌙 Evening Period</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Time-In</label>
                      <TimePicker
                        value={newEvent.eveningTimeIn || ""}
                        onChange={(value) => setNewEvent({ ...newEvent, eveningTimeIn: value })}
                        fixedPeriod="PM"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Time-Out</label>
                      <TimePicker
                        value={newEvent.eveningTimeOut || ""}
                        onChange={(value) => setNewEvent({ ...newEvent, eveningTimeOut: value })}
                        fixedPeriod="PM"
                      />
                    </div>
                  </div>
                </div>
              )}
              {/* Multi-Activity Games Section */}
              {newEvent.type === "INTRAMURAL" && (
                <div className="border border-orange-500/20 rounded-lg p-3 space-y-3 bg-orange-500/5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-foreground">Games</label>
                    <button
                      type="button"
                      onClick={() => setIntramuralGames([...intramuralGames, { name: "", timeIn: "", timeOut: "", afternoonTimeIn: "", afternoonTimeOut: "", eveningTimeIn: "", eveningTimeOut: "" }])}
                      className="text-xs text-orange-600 dark:text-orange-400 font-medium hover:underline"
                    >
                      + Add Game
                    </button>
                  </div>
                  {intramuralGames.length === 0 && (
                    <p className="text-xs text-muted-foreground">No games added. Each game will have separate attendance tracking.</p>
                  )}
                  {intramuralGames.map((game, index) => (
                    <div key={index} className="flex flex-col gap-2 bg-background p-2 rounded border border-border">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Game ${index + 1} name`}
                          value={game.name}
                          onChange={(e) => {
                            const updated = [...intramuralGames]
                            updated[index].name = e.target.value
                            setIntramuralGames(updated)
                          }}
                          className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-foreground text-sm"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setIntramuralGames(intramuralGames.filter((_, i) => i !== index))}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded"
                        >
                      <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {showMorning && (
                        <div>
                          <label className="text-[10px] text-blue-400 font-medium uppercase">Morning</label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Time-In</label>
                              <TimePicker
                                value={game.timeIn}
                                onChange={(value) => {
                                  const updated = [...intramuralGames]
                                  updated[index].timeIn = value
                                  setIntramuralGames(updated)
                                }}
                                fixedPeriod="AM"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Time-Out</label>
                              <TimePicker
                                value={game.timeOut}
                                onChange={(value) => {
                                  const updated = [...intramuralGames]
                                  updated[index].timeOut = value
                                  setIntramuralGames(updated)
                                }}
                                fixedPeriod="AM"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {showAfternoon && (
                        <div>
                          <label className="text-[10px] text-orange-400 font-medium uppercase">Afternoon <span className="text-muted-foreground">(optional)</span></label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Time-In</label>
                              <TimePicker
                                value={game.afternoonTimeIn}
                                onChange={(value) => {
                                  const updated = [...intramuralGames]
                                  updated[index].afternoonTimeIn = value
                                  setIntramuralGames(updated)
                                }}
                                fixedPeriod="PM"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Time-Out</label>
                              <TimePicker
                                value={game.afternoonTimeOut}
                                onChange={(value) => {
                                  const updated = [...intramuralGames]
                                  updated[index].afternoonTimeOut = value
                                  setIntramuralGames(updated)
                                }}
                                fixedPeriod="PM"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {showEvening && (
                        <div>
                          <label className="text-[10px] text-violet-400 font-medium uppercase">Evening <span className="text-muted-foreground">(optional)</span></label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Time-In</label>
                              <TimePicker
                                value={game.eveningTimeIn}
                                onChange={(value) => {
                                  const updated = [...intramuralGames]
                                  updated[index].eveningTimeIn = value
                                  setIntramuralGames(updated)
                                }}
                                fixedPeriod="PM"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Time-Out</label>
                              <TimePicker
                                value={game.eveningTimeOut}
                                onChange={(value) => {
                                  const updated = [...intramuralGames]
                                  updated[index].eveningTimeOut = value
                                  setIntramuralGames(updated)
                                }}
                                fixedPeriod="PM"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 action-button btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="flex-1 action-button btn-primary">
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && selectedEvent && (
        <EditEventModal 
          event={selectedEvent}
          editEventDate={editEventDate}
          setEditEventDate={setEditEventDate}
          onSave={handleSaveEvent}
          onClose={() => {
            setShowEditModal(false)
            setSelectedEvent(null)
            setEditEventDate(undefined)
          }}
        />
      )}

      {/* Attendance View Modal */}
      {attendanceViewEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-card rounded-t-lg sm:rounded-lg w-full sm:max-w-2xl border border-border max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground">{attendanceViewEvent.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Attendance List — sorted alphabetically</p>
              </div>
              <button onClick={() => setAttendanceViewEvent(null)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {attendanceViewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading attendance...</span>
              </div>
            ) : attendanceViewRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No attendance records for this event</div>
            ) : (
              <div className="overflow-auto flex-1">
                <div className="px-4 sm:px-6 py-3 flex items-center gap-4 text-sm text-muted-foreground border-b border-border bg-muted/30">
                  <span>{attendanceViewRecords.length} students</span>
                  <span>·</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">{attendanceViewRecords.filter(r => r.status === "PRESENT").length} Present</span>
                  <span>·</span>
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">{attendanceViewRecords.filter(r => r.status === "LATE").length} Late</span>
                  <span>·</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{attendanceViewRecords.filter(r => r.status === "ABSENT").length} Absent</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr className="bg-muted">
                      <th className="w-8">#</th>
                      <th>Name</th>
                      <th className="hidden sm:table-cell">School ID</th>
                      <th className="hidden md:table-cell">Course</th>
                      <th className="hidden lg:table-cell">Year</th>
                      <th>Time-In</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceViewRecords.map((record: any, index: number) => (
                      <tr key={record.id}>
                        <td className="text-muted-foreground text-sm">{index + 1}</td>
                        <td className="font-medium text-foreground">
                          <div>{record.user.name}</div>
                          <div className="sm:hidden text-xs text-muted-foreground">{record.user.schoolId}</div>
                        </td>
                        <td className="font-mono text-sm text-primary hidden sm:table-cell">{record.user.schoolId}</td>
                        <td className="text-muted-foreground text-sm hidden md:table-cell">{record.user.course || "N/A"}</td>
                        <td className="text-muted-foreground text-sm hidden lg:table-cell">{record.user.year || "N/A"}</td>
                        <td className="text-sm">
                          {record.timeIn ? new Date(record.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            record.status === "PRESENT" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                            record.status === "LATE" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
                            record.status === "ABSENT" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                            record.status === "INSIDE" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                            "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                          }`}>
                            ● {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Edit Event Modal Component
function EditEventModal({ 
  event, 
  editEventDate,
  setEditEventDate,
  onSave, 
  onClose 
}: { 
  event: Event
  editEventDate: Date | undefined
  setEditEventDate: (date: Date | undefined) => void
  onSave: (data: any) => void
  onClose: () => void 
}) {
  type EditScheduleType = "morning" | "afternoon" | "evening" | "whole-day" | "morning-afternoon" | "custom"

  // Derive schedule type from existing event data
  const deriveScheduleType = (): EditScheduleType => {
    const hasMorning = !!event.timeIn || !!event.timeOut
    const hasAfternoon = !!event.afternoonTimeIn || !!event.afternoonTimeOut
    const hasEvening = !!event.eveningTimeIn || !!event.eveningTimeOut

    if (hasMorning && hasAfternoon && hasEvening) return "whole-day"
    if (hasMorning && hasAfternoon) return "morning-afternoon"
    if (hasMorning && !hasAfternoon && !hasEvening) return "morning"
    if (!hasMorning && hasAfternoon && !hasEvening) return "afternoon"
    if (!hasMorning && !hasAfternoon && hasEvening) return "evening"
    if (hasAfternoon || hasEvening) return "custom"
    return "morning" // default
  }

  const [editScheduleType, setEditScheduleType] = useState<EditScheduleType>(deriveScheduleType())

  const [formData, setFormData] = useState({
    name: event.name,
    venue: event.venue,
    timeIn: event.timeIn,
    timeOut: event.timeOut,
    afternoonTimeIn: event.afternoonTimeIn || "",
    afternoonTimeOut: event.afternoonTimeOut || "",
    eveningTimeIn: event.eveningTimeIn || "",
    eveningTimeOut: event.eveningTimeOut || "",
  })
  
  // Games state for multi-activity events
  const [editGames, setEditGames] = useState<{id?: string, name: string, timeIn: string, timeOut: string, afternoonTimeIn: string, afternoonTimeOut: string, eveningTimeIn: string, eveningTimeOut: string}[]>(
    event.type === "INTRAMURAL" && event.games
      ? event.games.map(g => ({ id: g.id, name: g.name, timeIn: g.timeIn, timeOut: g.timeOut, afternoonTimeIn: g.afternoonTimeIn || "", afternoonTimeOut: g.afternoonTimeOut || "", eveningTimeIn: g.eveningTimeIn || "", eveningTimeOut: g.eveningTimeOut || "" }))
      : []
  )
  
  // Check if event is active or closed (started)
  const isEventStarted = event.status === "ACTIVE" || event.status === "CLOSED"

  // Period visibility
  const editShowMorning = ["morning", "whole-day", "morning-afternoon", "custom"].includes(editScheduleType)
  const editShowAfternoon = ["afternoon", "whole-day", "morning-afternoon", "custom"].includes(editScheduleType)
  const editShowEvening = ["evening", "whole-day", "custom"].includes(editScheduleType)

  // Handle schedule type change in edit form
  const handleEditScheduleChange = (type: EditScheduleType) => {
    setEditScheduleType(type)
    switch (type) {
      case "morning":
        setFormData(prev => ({ ...prev, afternoonTimeIn: "", afternoonTimeOut: "", eveningTimeIn: "", eveningTimeOut: "" }))
        break
      case "afternoon":
        setFormData(prev => ({ ...prev, timeIn: "", timeOut: "", eveningTimeIn: "", eveningTimeOut: "" }))
        break
      case "evening":
        setFormData(prev => ({ ...prev, timeIn: "", timeOut: "", afternoonTimeIn: "", afternoonTimeOut: "" }))
        break
      case "morning-afternoon":
        setFormData(prev => ({ ...prev, eveningTimeIn: "", eveningTimeOut: "" }))
        break
    }
  }
  
  // Initialize date from event
  useEffect(() => {
    if (event.date) {
      setEditEventDate(new Date(event.date))
    }
  }, [event.date, setEditEventDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      date: editEventDate ? format(editEventDate, "yyyy-MM-dd") : event.date,
      games: event.type === "INTRAMURAL" ? editGames : undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Edit Event</h2>
            {event.type === "INTRAMURAL" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-500/10 text-orange-600 dark:text-orange-400">
                Multi-Activity
              </span>
            )}
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            event.status === "ACTIVE" 
              ? "bg-green-500/10 text-green-600 dark:text-green-400" 
              : event.status === "CLOSED"
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          }`}>
            {event.status}
          </span>
        </div>
        
        {/* Warning for active/closed events */}
        {isEventStarted && (
          <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
            <p className="text-yellow-700 dark:text-yellow-400 font-medium">⚠️ Event has already started</p>
            <p className="text-yellow-600 dark:text-yellow-500 text-xs mt-1">
              Date and Time-In cannot be modified. You can only edit event name, venue, and time-out.
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Event Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Date
                {isEventStarted && <span className="text-muted-foreground ml-1">(locked)</span>}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${isEventStarted ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={isEventStarted}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editEventDate ? format(editEventDate, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                {!isEventStarted && (
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editEventDate}
                      onSelect={setEditEventDate}
                      initialFocus
                    />
                  </PopoverContent>
                )}
              </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Venue</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                required
              />
            </div>
          </div>

          {/* Event Schedule Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Event Schedule</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { value: "morning" as EditScheduleType, label: "☀️ Morning", desc: "AM only" },
                { value: "afternoon" as EditScheduleType, label: "🌤️ Afternoon", desc: "PM only" },
                { value: "evening" as EditScheduleType, label: "🌙 Evening", desc: "Night only" },
                { value: "morning-afternoon" as EditScheduleType, label: "☀️🌤️ AM + PM", desc: "Morning & Afternoon" },
                { value: "whole-day" as EditScheduleType, label: "📅 Whole Day", desc: "AM + PM + Eve" },
                { value: "custom" as EditScheduleType, label: "⚙️ Custom", desc: "Pick periods" },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleEditScheduleChange(opt.value)}
                  disabled={isEventStarted}
                  className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                    editScheduleType === opt.value
                      ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  } ${isEventStarted ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div>{opt.label}</div>
                  <div className={`text-[10px] mt-0.5 ${editScheduleType === opt.value ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Morning Period */}
          {editShowMorning && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
              <label className="block text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">☀️ Morning Period</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Time-In
                    {isEventStarted && <span className="ml-1">(locked)</span>}
                  </label>
                  {isEventStarted ? (
                    <div className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-muted-foreground cursor-not-allowed text-sm">
                      {formData.timeIn || "—"}
                    </div>
                  ) : (
                    <TimePicker
                      value={formData.timeIn}
                      onChange={(value) => setFormData({ ...formData, timeIn: value })}
                      fixedPeriod="AM"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Time-Out</label>
                  <TimePicker
                    value={formData.timeOut}
                    onChange={(value) => setFormData({ ...formData, timeOut: value })}
                    fixedPeriod="AM"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Afternoon Period */}
          {editShowAfternoon && (
            <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg p-3">
              <label className="block text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">🌤️ Afternoon Period</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Time-In
                    {isEventStarted && formData.afternoonTimeIn && <span className="ml-1">(locked)</span>}
                  </label>
                  {isEventStarted && formData.afternoonTimeIn ? (
                    <div className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-muted-foreground cursor-not-allowed text-sm">
                      {formData.afternoonTimeIn}
                    </div>
                  ) : (
                    <TimePicker
                      value={formData.afternoonTimeIn}
                      onChange={(value) => setFormData({ ...formData, afternoonTimeIn: value })}
                      fixedPeriod="PM"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Time-Out</label>
                  <TimePicker
                    value={formData.afternoonTimeOut}
                    onChange={(value) => setFormData({ ...formData, afternoonTimeOut: value })}
                    fixedPeriod="PM"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Evening Period */}
          {editShowEvening && (
            <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg p-3">
              <label className="block text-sm font-medium text-violet-600 dark:text-violet-400 mb-2">🌙 Evening Period</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Time-In
                    {isEventStarted && formData.eveningTimeIn && <span className="ml-1">(locked)</span>}
                  </label>
                  {isEventStarted && formData.eveningTimeIn ? (
                    <div className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-muted-foreground cursor-not-allowed text-sm">
                      {formData.eveningTimeIn}
                    </div>
                  ) : (
                    <TimePicker
                      value={formData.eveningTimeIn}
                      onChange={(value) => setFormData({ ...formData, eveningTimeIn: value })}
                      fixedPeriod="PM"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Time-Out</label>
                  <TimePicker
                    value={formData.eveningTimeOut}
                    onChange={(value) => setFormData({ ...formData, eveningTimeOut: value })}
                    fixedPeriod="PM"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Games Management */}
          {event.type === "INTRAMURAL" && (
            <div className="border border-orange-500/20 rounded-lg p-3 space-y-3 bg-orange-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-orange-500" />
                  <label className="block text-sm font-medium text-foreground">Games</label>
                  <span className="text-xs text-muted-foreground">({editGames.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditGames([...editGames, { name: "", timeIn: "", timeOut: "", afternoonTimeIn: "", afternoonTimeOut: "", eveningTimeIn: "", eveningTimeOut: "" }])}
                  className="text-xs text-orange-600 dark:text-orange-400 font-medium hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Game
                </button>
              </div>
              {editGames.length === 0 && (
                <p className="text-xs text-muted-foreground">No games added yet. Add games for separate attendance tracking per activity.</p>
              )}
              {editGames.map((game, index) => (
                <div key={game.id || `new-${index}`} className="flex flex-col gap-2 bg-background p-2.5 rounded border border-border">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Game ${index + 1} name`}
                      value={game.name}
                      onChange={(e) => {
                        const updated = [...editGames]
                        updated[index] = { ...updated[index], name: e.target.value }
                        setEditGames(updated)
                      }}
                      className="flex-1 px-3 py-1.5 rounded bg-background border border-border text-foreground text-sm"
                      required
                    />
                    {game.id && (
                      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">saved</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditGames(editGames.filter((_, i) => i !== index))}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {editShowMorning && (
                    <div>
                      <label className="text-[10px] text-blue-400 font-medium uppercase">Morning</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">
                            Time-In
                            {isEventStarted && game.timeIn && <span className="ml-1">(locked)</span>}
                          </label>
                          {isEventStarted && game.timeIn ? (
                            <div className="w-full px-3 py-1.5 rounded bg-muted border border-border text-muted-foreground text-sm cursor-not-allowed">
                              {game.timeIn}
                            </div>
                          ) : (
                            <TimePicker
                              value={game.timeIn}
                              onChange={(value) => {
                                const updated = [...editGames]
                                updated[index] = { ...updated[index], timeIn: value }
                                setEditGames(updated)
                              }}
                              fixedPeriod="AM"
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Time-Out</label>
                          <TimePicker
                            value={game.timeOut}
                            onChange={(value) => {
                              const updated = [...editGames]
                              updated[index] = { ...updated[index], timeOut: value }
                              setEditGames(updated)
                            }}
                            fixedPeriod="AM"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {editShowAfternoon && (
                    <div>
                      <label className="text-[10px] text-orange-400 font-medium uppercase">Afternoon <span className="text-muted-foreground">(optional)</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">
                            Time-In
                            {isEventStarted && game.afternoonTimeIn && <span className="ml-1">(locked)</span>}
                          </label>
                          {isEventStarted && game.afternoonTimeIn ? (
                            <div className="w-full px-3 py-1.5 rounded bg-muted border border-border text-muted-foreground text-sm cursor-not-allowed">
                              {game.afternoonTimeIn}
                            </div>
                          ) : (
                            <TimePicker
                              value={game.afternoonTimeIn}
                              onChange={(value) => {
                                const updated = [...editGames]
                                updated[index] = { ...updated[index], afternoonTimeIn: value }
                                setEditGames(updated)
                              }}
                              fixedPeriod="PM"
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Time-Out</label>
                          <TimePicker
                            value={game.afternoonTimeOut}
                            onChange={(value) => {
                              const updated = [...editGames]
                              updated[index] = { ...updated[index], afternoonTimeOut: value }
                              setEditGames(updated)
                            }}
                            fixedPeriod="PM"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {editShowEvening && (
                    <div>
                      <label className="text-[10px] text-violet-400 font-medium uppercase">Evening <span className="text-muted-foreground">(optional)</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">
                            Time-In
                            {isEventStarted && game.eveningTimeIn && <span className="ml-1">(locked)</span>}
                          </label>
                          {isEventStarted && game.eveningTimeIn ? (
                            <div className="w-full px-3 py-1.5 rounded bg-muted border border-border text-muted-foreground text-sm cursor-not-allowed">
                              {game.eveningTimeIn}
                            </div>
                          ) : (
                            <TimePicker
                              value={game.eveningTimeIn}
                              onChange={(value) => {
                                const updated = [...editGames]
                                updated[index] = { ...updated[index], eveningTimeIn: value }
                                setEditGames(updated)
                              }}
                              fixedPeriod="PM"
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Time-Out</label>
                          <TimePicker
                            value={game.eveningTimeOut}
                            onChange={(value) => {
                              const updated = [...editGames]
                              updated[index] = { ...updated[index], eveningTimeOut: value }
                              setEditGames(updated)
                            }}
                            fixedPeriod="PM"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 action-button btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 action-button btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
