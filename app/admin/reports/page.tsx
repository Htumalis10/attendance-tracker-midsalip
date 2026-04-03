"use client"
import { Download, FileText, ChevronDown, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

// Course options - same as in users page
const COURSES = [
  "BS Information Technology",
  "BS Computer Science",
  "BS Information Systems",
  "BS Computer Engineering",
  "BS Electronics Engineering",
  "BS Electrical Engineering",
  "BS Civil Engineering",
  "BS Mechanical Engineering",
  "BS Accountancy",
  "BS Business Administration",
  "BS Hospitality Management",
  "BS Tourism Management",
  "BS Nursing",
  "BS Education",
  "BA Communication",
  "Other",
]

interface Event {
  id: string
  name: string
}

interface AttendanceRecord {
  id: string
  user: {
    name: string
    schoolId: string
    course: string | null
    year: string | null
    role: string
  }
  event: {
    name: string
  }
  timeIn: string
  timeOut: string | null
  afternoonTimeIn?: string | null
  afternoonTimeOut?: string | null
  eveningTimeIn?: string | null
  eveningTimeOut?: string | null
  status: string
}

export default function Reports() {
  const [selectedEvent, setSelectedEvent] = useState("All Events")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState("All Courses")
  const [selectedYear, setSelectedYear] = useState("All Years")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)

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

  // Auto-generate report when filters change
  useEffect(() => {
    handleGenerateReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, selectedCourse, selectedYear])

  const handleGenerateReport = async () => {
    setIsGenerating(true)
    setIsLoading(true)
    
    try {
      const params = new URLSearchParams()
      if (selectedEventId) {
        params.set("eventId", selectedEventId)
      }
      if (selectedCourse !== "All Courses") {
        params.set("course", selectedCourse)
      }
      if (selectedYear !== "All Years") {
        params.set("year", selectedYear)
      }

      const response = await fetch(`/api/attendance?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAttendanceRecords(data)
        setGeneratedReport(true)
        toast.success("Report generated successfully")
      }
    } catch (err) {
      console.error("Failed to generate report:", err)
      toast.error("Failed to generate report")
    } finally {
      setIsGenerating(false)
      setIsLoading(false)
    }
  }

  const handleExportExcel = () => {
    if (!generatedReport || attendanceRecords.length === 0) {
      toast.warning("No records to export")
      return
    }

    // Generate CSV (Excel compatible)
    const headers = ["Name", "School ID", "Course", "Year", "Event", "Time-In", "Time-Out", "Status"]
    const csvData = attendanceRecords.map(record => [
      record.user.name,
      record.user.schoolId,
      record.user.course || "N/A",
      record.user.year || "N/A",
      record.event.name,
      record.timeIn ? new Date(record.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
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
    link.download = `attendance_report_${selectedEvent.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleExportPDF = () => {
    if (!generatedReport || attendanceRecords.length === 0) {
      toast.warning("No records to export")
      return
    }

    // Generate HTML report that can be printed as PDF
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Attendance Report - ${selectedEvent}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { color: #1a365d; text-align: center; }
    .meta { text-align: center; color: #666; margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #1a365d; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .summary { margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; }
    .summary h3 { margin-bottom: 15px; }
    .stat { display: inline-block; margin-right: 30px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1a365d; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Attendance Report</h1>
  <div class="meta">
    <p><strong>Event:</strong> ${selectedEvent}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Filters:</strong> ${selectedCourse} | ${selectedYear}</p>
  </div>
  
  <div class="summary">
    <h3>Summary</h3>
    <div class="stat">
      <span class="stat-value">${attendanceRecords.length}</span>
      <span> Total Records</span>
    </div>
    <div class="stat">
      <span class="stat-value">${attendanceRecords.filter(r => r.status === "PRESENT").length}</span>
      <span> Present</span>
    </div>
    <div class="stat">
      <span class="stat-value">${attendanceRecords.filter(r => r.status === "LATE").length}</span>
      <span> Late</span>
    </div>
    <div class="stat">
      <span class="stat-value">${attendanceRecords.filter(r => r.status === "ABSENT").length}</span>
      <span> Absent</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>School ID</th>
        <th>Course</th>
        <th>Year</th>
        <th>Event</th>
        <th>Time-In</th>
        <th>Time-Out</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${attendanceRecords.map(record => `
        <tr>
          <td>${record.user.name}</td>
          <td>${record.user.schoolId}</td>
          <td>${record.user.course || "N/A"}</td>
          <td>${record.user.year || "N/A"}</td>
          <td>${record.event.name}</td>
          <td>${record.timeIn ? new Date(record.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
          <td>${record.timeOut ? new Date(record.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
          <td>${record.status}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <script>window.print();</script>
</body>
</html>`

    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url, "_blank")
    if (printWindow) {
      printWindow.onload = () => {
        URL.revokeObjectURL(url)
      }
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Generate attendance reports with filters and export options</p>
        </div>
      </div>

      {/* Report Filters */}
      <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
        <h2 className="font-semibold text-foreground mb-3 sm:mb-4">Report Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Event</label>
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
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Course</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full px-3 sm:px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors text-sm">
                <span className="truncate">{selectedCourse}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full max-h-[300px] overflow-y-auto">
                <DropdownMenuItem onClick={() => setSelectedCourse("All Courses")}>All Courses</DropdownMenuItem>
                {COURSES.map((course) => (
                  <DropdownMenuItem key={course} onClick={() => setSelectedCourse(course)}>
                    {course}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Year Level</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full px-3 sm:px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors text-sm">
                <span className="truncate">{selectedYear}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem onClick={() => setSelectedYear("All Years")}>All Years</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedYear("1st Year")}>1st Year</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedYear("2nd Year")}>2nd Year</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedYear("3rd Year")}>3rd Year</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedYear("4th Year")}>4th Year</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 mt-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Generating report...</span>
          </div>
        )}
        {generatedReport && !isGenerating && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-3">✓ Report generated automatically ({attendanceRecords.length} records)</p>
        )}
      </div>

      {/* Summary Stats */}
      {generatedReport && !isGenerating && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card rounded-lg p-4 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">{attendanceRecords.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Records</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-green-500/20 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{attendanceRecords.filter(r => r.status === "PRESENT").length}</p>
            <p className="text-xs text-muted-foreground mt-1">Present</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-yellow-500/20 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{attendanceRecords.filter(r => r.status === "LATE").length}</p>
            <p className="text-xs text-muted-foreground mt-1">Late</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-red-500/20 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{attendanceRecords.filter(r => r.status === "ABSENT").length}</p>
            <p className="text-xs text-muted-foreground mt-1">Absent</p>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border">
          <h2 className="font-semibold text-foreground">Attendance Records</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading records...</span>
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No attendance records found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-muted">
                  <th>#</th>
                  <th>Name</th>
                  <th className="hidden sm:table-cell">School ID</th>
                  <th className="hidden md:table-cell">Course</th>
                  <th className="hidden lg:table-cell">Year</th>
                  <th className="hidden md:table-cell">Event</th>
                  <th>Time-In</th>
                  <th className="hidden sm:table-cell">Time-Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map((record, index) => (
                  <tr key={record.id}>
                    <td className="text-muted-foreground text-sm">{index + 1}</td>
                    <td className="font-medium text-foreground">
                      <div>{record.user.name}</div>
                      <div className="sm:hidden text-xs text-muted-foreground">{record.user.schoolId}</div>
                      <div className="md:hidden text-xs text-muted-foreground">{record.event.name}</div>
                    </td>
                    <td className="font-mono text-sm text-primary hidden sm:table-cell">{record.user.schoolId}</td>
                    <td className="text-muted-foreground text-sm hidden md:table-cell">{record.user.course || "N/A"}</td>
                    <td className="text-muted-foreground text-sm hidden lg:table-cell">{record.user.year || "N/A"}</td>
                    <td className="text-muted-foreground text-sm hidden md:table-cell">{record.event.name}</td>
                    <td className="text-sm">
                      <div>{record.timeIn ? new Date(record.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                      {record.afternoonTimeIn && <div className="text-xs text-blue-500">PM: {new Date(record.afternoonTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                      {record.eveningTimeIn && <div className="text-xs text-violet-500">Eve: {new Date(record.eveningTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                      <div className="sm:hidden text-xs text-muted-foreground">Out: {record.timeOut ? new Date(record.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                    </td>
                    <td className="text-sm hidden sm:table-cell">
                      <div>{record.timeOut ? new Date(record.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                      {record.afternoonTimeOut && <div className="text-xs text-blue-500">PM: {new Date(record.afternoonTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                      {record.eveningTimeOut && <div className="text-xs text-violet-500">Eve: {new Date(record.eveningTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
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

      {/* Export Options */}
      <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
        <h2 className="font-semibold text-foreground mb-3 sm:mb-4">Export Report</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button 
            onClick={handleExportExcel} 
            disabled={!generatedReport}
            className="action-button btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Export as Excel
          </button>
          <button 
            onClick={handleExportPDF} 
            disabled={!generatedReport}
            className="action-button btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
        </div>
      </div>
    </div>
  )
}
