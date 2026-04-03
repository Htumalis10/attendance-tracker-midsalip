"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Loader2, X } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AttendanceRecord {
  id: string
  timeIn: string
  timeOut: string | null
  afternoonTimeIn?: string | null
  afternoonTimeOut?: string | null
  eveningTimeIn?: string | null
  eveningTimeOut?: string | null
  status: string
  event: {
    name: string
    date: string
  }
}

export default function ScanHistory() {
  const [searchQuery, setSearchQuery] = useState("")
  const [scanHistory, setScanHistory] = useState<AttendanceRecord[]>([])
  const [filteredHistory, setFilteredHistory] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState("All")
  const [dateFilter, setDateFilter] = useState("")

  // Fetch attendance history
  useEffect(() => {
    const fetchHistory = async () => {
      // Wait a bit for localStorage to be available on hydration
      let retries = 3
      let user = getCurrentUser()
      
      while (!user?.id && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
        user = getCurrentUser()
        retries--
      }
      
      if (!user?.id) {
        console.log("No user found after retries")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/attendance?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          setScanHistory(data)
          setFilteredHistory(data)
        }
      } catch (err) {
        console.error("Failed to fetch scan history:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchHistory()
  }, [])

  // Filter logic
  useEffect(() => {
    let filtered = [...scanHistory]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(record =>
        record.event.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "All") {
      filtered = filtered.filter(record => {
        const status = getStatus(record)
        return status === statusFilter
      })
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.event.date).toISOString().split("T")[0]
        return recordDate === dateFilter
      })
    }

    setFilteredHistory(filtered)
  }, [searchQuery, statusFilter, dateFilter, scanHistory])

  const handleApplyFilters = () => {
    setShowFilterModal(false)
  }

  const handleClearFilters = () => {
    setStatusFilter("All")
    setDateFilter("")
    setShowFilterModal(false)
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const calculateDuration = (timeIn: string, timeOut: string | null) => {
    if (!timeOut) return "—"
    const start = new Date(timeIn)
    const end = new Date(timeOut)
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.floor(diffMs / 3600000)
    const minutes = Math.floor((diffMs % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }

  const getStatus = (record: AttendanceRecord) => {
    switch (record.status) {
      case "PRESENT":
      case "APPROVED":
        return "Present"
      case "LATE":
        return "Late"
      case "PENDING":
        return "Pending"
      case "REJECTED":
        return "Rejected"
      case "ABSENT":
        return "Absent"
      default:
        return record.status
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="page-title">Scan History</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">View all your attendance records</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-card rounded-lg p-3 sm:p-4 border border-border">
        <div className="flex gap-3 sm:gap-4 items-center flex-col sm:flex-row">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder-muted-foreground text-sm"
            />
          </div>
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

      {/* Scan History Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading scan history...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {scanHistory.length === 0 
              ? "No attendance records found. Attend events to see your history."
              : "No records match your search criteria."
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-muted">
                <th>Event Name</th>
                <th className="hidden sm:table-cell">Date</th>
                <th>Time-In</th>
                <th className="hidden md:table-cell">Time-Out</th>
                <th className="hidden md:table-cell">Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((record) => (
                <tr key={record.id}>
                  <td className="font-medium text-foreground">
                    <div className="truncate max-w-[150px] sm:max-w-none">{record.event.name}</div>
                    <div className="sm:hidden text-xs text-muted-foreground">{formatDate(record.event.date)}</div>
                  </td>
                  <td className="text-muted-foreground text-sm hidden sm:table-cell">{formatDate(record.event.date)}</td>
                  <td className="text-sm">
                    <div>{formatTime(record.timeIn)}</div>
                    {record.afternoonTimeIn && <div className="text-xs text-blue-500">PM: {formatTime(record.afternoonTimeIn)}</div>}
                    {record.eveningTimeIn && <div className="text-xs text-violet-500">Eve: {formatTime(record.eveningTimeIn)}</div>}
                    <div className="md:hidden text-xs text-muted-foreground">Out: {formatTime(record.timeOut)}</div>
                  </td>
                  <td className="text-sm hidden md:table-cell">
                    <div>{formatTime(record.timeOut)}</div>
                    {record.afternoonTimeOut && <div className="text-xs text-blue-500">PM: {formatTime(record.afternoonTimeOut)}</div>}
                    {record.eveningTimeOut && <div className="text-xs text-violet-500">Eve: {formatTime(record.eveningTimeOut)}</div>}
                  </td>
                  <td className="text-sm font-medium hidden md:table-cell">{calculateDuration(record.timeIn, record.timeOut)}</td>
                  <td>
                    {getStatus(record) === "Present" ? (
                      <span className="badge-success text-xs">● Present</span>
                    ) : getStatus(record) === "Late" ? (
                      <span className="badge-warning text-xs">● Late</span>
                    ) : getStatus(record) === "Pending" ? (
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">● Pending</span>
                    ) : getStatus(record) === "Rejected" ? (
                      <span className="badge-danger text-xs">● Rejected</span>
                    ) : getStatus(record) === "Absent" ? (
                      <span className="badge-danger text-xs">● Absent</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">{getStatus(record)}</span>
                    )}
                  </td>
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
                    <SelectItem value="Present">Present</SelectItem>
                    <SelectItem value="Late">Late</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground"
                />
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
