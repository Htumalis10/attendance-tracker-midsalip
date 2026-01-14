"use client"

import { useState, useEffect } from "react"
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"
import { Calendar, Clock, Award, TrendingUp, Loader2, MapPin, Bell, CalendarDays } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"

interface DashboardStats {
  eventsAttended: number
  certificatesEarned: number
  totalEvents: number
  attendanceRate: number
}

interface AttendanceRecord {
  id: string
  timeIn: string
  timeOut: string | null
  status: string
  event: {
    id: string
    name: string
    date: string
    timeOut: string
    venue: string
  }
}

interface MonthlyData {
  month: string
  attended: number
  total: number
}

interface UpcomingEvent {
  id: string
  name: string
  date: string
  venue: string
  timeIn: string
  timeOut: string
  status: string
}

export default function StudentDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    eventsAttended: 0,
    certificatesEarned: 0,
    totalEvents: 0,
    attendanceRate: 0,
  })
  const [recentEvents, setRecentEvents] = useState<AttendanceRecord[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [attendanceData, setAttendanceData] = useState<MonthlyData[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const fetchDashboardData = async () => {
      const user = getCurrentUser()
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch attendance records for this user
        const attendanceRes = await fetch(`/api/attendance?userId=${user.id}`)
        const attendanceRecords: AttendanceRecord[] = attendanceRes.ok ? await attendanceRes.json() : []

        // Fetch certificates for this user
        const certsRes = await fetch(`/api/certificates?userId=${user.id}`)
        const certsData = certsRes.ok ? await certsRes.json() : []

        // Fetch all events to calculate total
        const eventsRes = await fetch(`/api/events`)
        const eventsData = eventsRes.ok ? await eventsRes.json() : []

        // Filter upcoming events (within next 14 days)
        const now = new Date()
        const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        const upcoming = eventsData
          .filter((event: UpcomingEvent) => {
            const eventDate = new Date(event.date)
            return eventDate >= now && eventDate <= twoWeeksLater && event.status === "UPCOMING"
          })
          .sort((a: UpcomingEvent, b: UpcomingEvent) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 5)
        setUpcomingEvents(upcoming)

        // Calculate stats
        const eventsAttended = attendanceRecords.filter(
          (a) => a.status === "PRESENT" || a.status === "APPROVED" || a.status === "LATE"
        ).length
        const certificatesEarned = certsData.length
        const totalEvents = eventsData.length
        const attendanceRate = totalEvents > 0 ? Math.round((eventsAttended / totalEvents) * 100) : 0

        setStats({
          eventsAttended,
          certificatesEarned,
          totalEvents,
          attendanceRate,
        })

        // Set recent events (last 5)
        setRecentEvents(attendanceRecords.slice(0, 5))

        // Calculate monthly attendance data
        const monthlyStats: { [key: string]: { attended: number; total: number } } = {}
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        // Initialize last 4 months
        const currentDate = new Date()
        for (let i = 3; i >= 0; i--) {
          const monthIndex = (currentDate.getMonth() - i + 12) % 12
          monthlyStats[months[monthIndex]] = { attended: 0, total: 0 }
        }

        // Count events per month
        eventsData.forEach((event: any) => {
          const eventDate = new Date(event.date)
          const monthName = months[eventDate.getMonth()]
          if (monthlyStats[monthName]) {
            monthlyStats[monthName].total++
          }
        })

        // Count attendance per month
        attendanceRecords.forEach((record) => {
          const eventDate = new Date(record.event.date)
          const monthName = months[eventDate.getMonth()]
          if (monthlyStats[monthName] && (record.status === "PRESENT" || record.status === "APPROVED" || record.status === "LATE")) {
            monthlyStats[monthName].attended++
          }
        })

        setAttendanceData(
          Object.entries(monthlyStats).map(([month, data]) => ({
            month,
            attended: data.attended,
            total: data.total,
          }))
        )
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PRESENT":
      case "APPROVED":
        return "Attended"
      case "LATE":
        return "Late"
      case "PENDING":
        return "Pending"
      default:
        return status
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "PRESENT":
      case "APPROVED":
        return "bg-green-500/10 text-green-600 dark:text-green-400"
      case "LATE":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
      case "PENDING":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400"
    }
  }

  const formatUpcomingDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const eventDate = new Date(date)
    eventDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return { text: "Today", urgent: true }
    if (diffDays === 1) return { text: "Tomorrow", urgent: true }
    if (diffDays <= 3) return { text: `In ${diffDays} days`, urgent: true }
    return { text: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), urgent: false }
  }

  const statCards = [
    { icon: Calendar, label: "Events Attended", value: stats.eventsAttended.toString(), color: "primary" },
    { icon: Award, label: "Certificates Earned", value: stats.certificatesEarned.toString(), color: "accent" },
    { icon: Clock, label: "Total Events", value: stats.totalEvents.toString(), color: "secondary" },
    { icon: TrendingUp, label: "Attendance Rate", value: `${stats.attendanceRate}%`, color: "primary" },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">Your attendance overview and progress</p>
      </div>

      {/* Upcoming Events Alert Banner */}
      {upcomingEvents.length > 0 && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg border border-primary/20 p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
                <span>Upcoming Events</span>
                <span className="px-1.5 sm:px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                  {upcomingEvents.length} event{upcomingEvents.length > 1 ? "s" : ""}
                </span>
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Don&apos;t forget to attend these upcoming events!
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
            {upcomingEvents.slice(0, 3).map((event) => {
              const dateInfo = formatUpcomingDate(event.date)
              return (
                <div
                  key={event.id}
                  className={`bg-card rounded-lg p-3 border ${dateInfo.urgent ? "border-primary/30 shadow-sm" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-foreground text-sm truncate flex-1">{event.name}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0 ${
                        dateInfo.urgent
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {dateInfo.text}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{event.timeIn} - {event.timeOut}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{event.venue}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {upcomingEvents.length > 3 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              +{upcomingEvents.length - 3} more upcoming event{upcomingEvents.length - 3 > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <div key={idx} className="stat-card p-3 sm:p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="stat-label text-xs sm:text-sm">{stat.label}</p>
                  <p className="stat-value text-lg sm:text-2xl">{mounted ? stat.value : "—"}</p>
                </div>
                <div
                  className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-md flex-shrink-0 ${
                    stat.color === "primary"
                      ? "bg-primary/10"
                      : stat.color === "accent"
                        ? "bg-accent/10"
                        : "bg-secondary/10"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 sm:w-5 sm:h-5 ${
                      stat.color === "primary"
                        ? "text-primary"
                        : stat.color === "accent"
                          ? "text-accent"
                          : "text-secondary"
                    }`}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border/50">
          <h2 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm">Attendance Trend</h2>
          {attendanceData.length > 0 ? (
            <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" style={{ fontSize: "10px" }} tick={{ fontSize: 10 }} />
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
                <Line type="monotone" dataKey="attended" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} name="Attended" />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--muted-foreground)"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  name="Total Events"
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground text-sm">
              No attendance data yet
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border/50">
          <h2 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm">Recent Events</h2>
          <div className="space-y-2 sm:space-y-3">
            {recentEvents.length > 0 ? (
              recentEvents.map((record) => (
                <div key={record.id} className="flex items-start justify-between py-2 sm:py-3 border-b border-border/50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-xs sm:text-sm truncate">{record.event.name}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 sm:mt-1">
                      {new Date(record.event.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs font-medium flex-shrink-0 ml-2 ${getStatusStyle(record.status)}`}
                  >
                    {getStatusLabel(record.status)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
                No events attended yet. Start attending events to see your history.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
