"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Download, ChevronDown, Loader2, X, CalendarIcon } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { format } from "date-fns"

interface AttendanceRecord {
  id: string
  userId: string
  eventId: string
  timeIn: string
  timeOut: string | null
  status: string
  user: {
    name: string
    schoolId: string
  }
  event: {
    name: string
  }
}

interface Event {
  id: string
  name: string
}

export default function AttendanceMonitoring() {
  const [selectedEvent, setSelectedEvent] = useState("All Events")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/events")
        if (response.ok) {
          const data = await response.json()
          setEvents(data)
        }
      } catch (err) {
        console.error("Failed to fetch events:", err)
      }
    }
    fetchEvents()
  }, [])

  // Fetch attendance records
  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedEventId) {
          params.set("eventId", selectedEventId)
        }
        if (searchQuery) {
          params.set("search", searchQuery)
        }
        if (statusFilter !== "All") {
          params.set("status", statusFilter)
        }
        if (dateFilter) {
          params.set("date", format(dateFilter, "yyyy-MM-dd"))
        }
        
        const response = await fetch(`/api/attendance?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setAttendanceRecords(data)
        }
      } catch (err) {
        console.error("Failed to fetch attendance:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAttendance()
  }, [selectedEventId, searchQuery, statusFilter, dateFilter])

  // Export to CSV
  const handleExportData = () => {
    if (attendanceRecords.length === 0) {
      toast.warning("No data to export")
      return
    }

    const headers = ["Name", "School ID", "Event", "Time-In", "Time-Out", "Status"]
    const csvData = attendanceRecords.map(record => [
      record.user.name,
      record.user.schoolId,
      record.event.name,
      new Date(record.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      record.timeOut ? new Date(record.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
      record.status
    ])

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `attendance_records_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // Apply filters
  const handleApplyFilters = () => {
    setShowFilterModal(false)
  }

  // Clear filters
  const handleClearFilters = () => {
    setStatusFilter("All")
    setDateFilter(undefined)
    setShowFilterModal(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <span className="badge-success">● Present</span>
      case "INSIDE":
        return <span className="badge-warning">● Inside</span>
      case "ABSENT":
        return <span className="badge-danger">● Absent</span>
      case "LATE":
        return <span className="badge-warning">● Late</span>
      default:
        return <span className="text-muted-foreground text-xs">—</span>
    }
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Attendance Monitoring</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">Real-time attendance tracking and monitoring</p>
        </div>
        <button 
          onClick={handleExportData}
          className="action-button btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Download className="w-4 h-4" />
          Export Data
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg p-3 sm:p-4 border border-border">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Select Event</label>
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full px-3 sm:px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors text-sm">
                  <span className="truncate">{selectedEvent}</span>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  <DropdownMenuItem onClick={() => { setSelectedEvent("All Events"); setSelectedEventId(null); }}>
                    All Events
                  </DropdownMenuItem>
                  {events.map(event => (
                    <DropdownMenuItem 
                      key={event.id} 
                      onClick={() => { setSelectedEvent(event.name); setSelectedEventId(event.id); }}
                    >
                      {event.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder-muted-foreground text-sm"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => setShowFilterModal(true)}
                className="action-button btn-ghost flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Filter className="w-4 h-4" />
                Filter
                {(statusFilter !== "All" || dateFilter) && (
                  <span className="w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading attendance records...</span>
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No attendance records found</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-muted">
                <th>Name</th>
                <th className="hidden sm:table-cell">School ID</th>
                <th className="hidden md:table-cell">Event</th>
                <th>Time-In</th>
                <th className="hidden sm:table-cell">Time-Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map((record) => (
                <tr key={record.id}>
                  <td className="font-medium text-foreground">
                    <div>{record.user.name}</div>
                    <div className="sm:hidden text-xs text-muted-foreground">{record.user.schoolId}</div>
                    <div className="md:hidden text-xs text-muted-foreground">{record.event.name}</div>
                  </td>
                  <td className="font-mono text-sm text-primary hidden sm:table-cell">{record.user.schoolId}</td>
                  <td className="text-muted-foreground text-sm hidden md:table-cell">{record.event.name}</td>
                  <td className="text-sm">
                    <div>{formatTime(record.timeIn)}</div>
                    <div className="sm:hidden text-xs text-muted-foreground">Out: {formatTime(record.timeOut)}</div>
                  </td>
                  <td className="text-sm hidden sm:table-cell">{formatTime(record.timeOut)}</td>
                  <td>{getStatusBadge(record.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-md border border-border max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Filter Options</h2>
              <button onClick={() => setShowFilterModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="INSIDE">Inside</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFilter ? format(dateFilter, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFilter}
                      onSelect={setDateFilter}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleClearFilters} className="flex-1 action-button btn-ghost">
                  Clear Filters
                </button>
                <button onClick={handleApplyFilters} className="flex-1 action-button btn-primary">
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
