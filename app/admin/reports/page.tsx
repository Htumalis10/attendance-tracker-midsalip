"use client"
import { Download, FileText, ChevronDown, Loader2 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
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

interface ReportData {
  department: string
  present: number
  absent: number
  late: number
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
  status: string
}

export default function Reports() {
  const [selectedEvent, setSelectedEvent] = useState("Select Event")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState("All Courses")
  const [selectedYear, setSelectedYear] = useState("All Years")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [reportData, setReportData] = useState<ReportData[]>([])
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

  const handleGenerateReport = async () => {
    if (!selectedEventId) {
      toast.warning("Please select an event to generate report")
      return
    }

    setIsGenerating(true)
    setIsLoading(true)
    
    try {
      const params = new URLSearchParams()
      params.set("eventId", selectedEventId)
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

        // Process data for chart
        const departmentStats: Record<string, { present: number; absent: number; late: number }> = {}
        
        data.forEach((record: AttendanceRecord) => {
          const dept = record.user.course || "Unknown"
          if (!departmentStats[dept]) {
            departmentStats[dept] = { present: 0, absent: 0, late: 0 }
          }
          if (record.status === "PRESENT") {
            departmentStats[dept].present++
          } else if (record.status === "ABSENT") {
            departmentStats[dept].absent++
          } else if (record.status === "LATE") {
            departmentStats[dept].late++
          }
        })

        const chartData = Object.entries(departmentStats).map(([department, stats]) => ({
          department: department.length > 20 ? department.substring(0, 20) + "..." : department,
          ...stats
        }))

        setReportData(chartData)
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
      toast.warning("Please generate a report first")
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
    link.download = `attendance_report_${selectedEvent.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleExportPDF = () => {
    if (!generatedReport || attendanceRecords.length === 0) {
      toast.warning("Please generate a report first")
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
          <td>${new Date(record.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
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
        <h2 className="font-semibold text-foreground mb-3 sm:mb-4">Generate Report</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Event</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full px-3 sm:px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors text-sm">
                <span className="truncate">{selectedEvent}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem onClick={() => { setSelectedEvent("Select Event"); setSelectedEventId(null); }}>
                  Select Event
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
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="w-full action-button btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
        {generatedReport && (
          <p className="text-sm text-green-600 dark:text-green-400">✓ Report generated successfully ({attendanceRecords.length} records)</p>
        )}
      </div>

      {/* Chart */}
      <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
        <h2 className="font-semibold text-foreground mb-3 sm:mb-4">Attendance by Department</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading chart data...</span>
          </div>
        ) : reportData.length > 0 ? (
          <div className="h-[300px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reportData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="department" stroke="var(--muted-foreground)" style={{ fontSize: "10px" }} tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "10px" }} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#f5f5f5",
                }}
                labelStyle={{
                  color: "#f5f5f5",
                }}
                itemStyle={{
                  color: "#f5f5f5",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="present" fill="var(--primary)" name="Present" />
              <Bar dataKey="absent" fill="var(--destructive)" name="Absent" />
              <Bar dataKey="late" fill="var(--accent)" name="Late" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Generate a report to see the chart
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
