"use client"

import { useState, useEffect } from "react"
import { Users, Calendar, Activity, Award, TrendingUp, TrendingDown, Loader2, Bell, QrCode, Clock, MapPin, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentUser } from "@/lib/auth"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
  event?: {
    id: string
    name: string
    date: string
    venue: string
    timeIn: string
    timeOut: string
    status: string
  }
}

interface DashboardStats {
  totalUsers: number
  activeStudents: number
  activeEvents: number
  upcomingEvents: number
  todayAttendance: number
  totalCertificates: number
  weeklyChange: number
}

interface AttendanceByStatus {
  status: string
  count: number
}

interface RecentEvent {
  id: string
  name: string
  date: string
  attendees: number
  status: string
}

interface WeeklyData {
  date: string
  fullDate: string
  attendance: number
  expected: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [attendanceByStatus, setAttendanceByStatus] = useState<AttendanceByStatus[]>([])
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [user, setUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading] = useState(true)

  const isSGOfficer = user?.role === "sg_officer"

  useEffect(() => {
    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (currentUser?.role === "sg_officer") {
      // Fetch SG Officer notifications
      const fetchNotifications = async () => {
        try {
          setNotifLoading(true)
          const res = await fetch(`/api/notifications?userId=${currentUser.id}`)
          if (res.ok) {
            const data = await res.json()
            setNotifications(data.notifications || [])
          }
        } catch (err) {
          console.error("Error fetching notifications:", err)
        } finally {
          setNotifLoading(false)
          setIsLoading(false)
        }
      }
      fetchNotifications()
    } else {
      // Fetch admin dashboard data
      const fetchDashboardData = async () => {
        try {
          setIsLoading(true)
          const response = await fetch("/api/dashboard/stats")
          if (!response.ok) throw new Error("Failed to fetch dashboard stats")
          
          const data = await response.json()
          setStats(data.stats)
          setAttendanceByStatus(data.attendanceByStatus || [])
          setRecentEvents(data.recentEvents || [])
          setWeeklyData(data.weeklyData || [])
        } catch (error) {
          console.error("Error fetching dashboard stats:", error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchDashboardData()
    }
  }, [])

  const statCards = [
    { icon: Users, label: "Total Users", value: stats?.totalUsers?.toLocaleString() || "0", color: "primary" },
    { icon: Calendar, label: "Active Events", value: stats?.activeEvents?.toString() || "0", color: "accent" },
    { icon: Activity, label: "Today's Attendance", value: stats?.todayAttendance?.toLocaleString() || "0", color: "secondary" },
    { icon: Award, label: "Certificates Generated", value: stats?.totalCertificates?.toLocaleString() || "0", color: "primary" },
  ]

  const statusColorMap: Record<string, string> = {
    PRESENT: "#22c55e",
    APPROVED: "#22c55e",
    ABSENT: "#ef4444",
    LATE: "#f59e0b",
    PENDING: "#3b82f6",
    REJECTED: "#f97316",
  }

  const statusData = attendanceByStatus.map(item => ({
    name: item.status.charAt(0) + item.status.slice(1).toLowerCase(),
    value: item.count,
    color: statusColorMap[item.status] || "oklch(0.6 0.1 200)",
  }))

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        
        {/* Skeleton Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4 sm:p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-48 w-48 rounded-full mx-auto" />
          </div>
        </div>

        {/* Skeleton Recent Events */}
        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="divide-y divide-border">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // SG Officer Dashboard - Show scan assignments and notifications
  if (isSGOfficer) {
    const scanAssignments = notifications.filter(n => n.type === "SCAN_ASSIGNMENT")
    const otherNotifications = notifications.filter(n => n.type !== "SCAN_ASSIGNMENT")

    const activeAssignments = scanAssignments.filter(n => n.event && n.event.status !== "CLOSED")
    const closedAssignments = scanAssignments.filter(n => n.event && n.event.status === "CLOSED")

    const getEventStatusInfo = (notif: Notification) => {
      if (!notif.event) return { label: "Unknown", color: "bg-gray-500/10 text-gray-500", dotColor: "bg-gray-400" }
      const eventDate = new Date(notif.event.date)
      const isToday = eventDate.toDateString() === new Date().toDateString()
      
      if (notif.event.status === "CLOSED") return { label: "Completed", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dotColor: "bg-emerald-500" }
      if (notif.event.status === "ACTIVE") return { label: "Active Now", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dotColor: "bg-blue-500" }
      if (isToday) return { label: "Today", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dotColor: "bg-amber-500" }
      return { label: "Upcoming", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", dotColor: "bg-violet-500" }
    }

    const renderAssignmentCard = (notif: Notification, showScanButton: boolean) => {
      const statusInfo = getEventStatusInfo(notif)
      const isClosed = notif.event?.status === "CLOSED"
      const isActive = notif.event?.status === "ACTIVE"

      return (
        <div
          key={notif.id}
          className={`group relative bg-card rounded-xl border overflow-hidden transition-all duration-200 ${
            isClosed 
              ? "border-emerald-500/20 opacity-80" 
              : isActive 
                ? "border-blue-500/30 shadow-sm shadow-blue-500/5 hover:shadow-md hover:shadow-blue-500/10" 
                : "border-border hover:border-primary/30 hover:shadow-sm"
          }`}
        >
          {/* Status stripe */}
          <div className={`h-1 w-full ${
            isClosed ? "bg-emerald-500/40" : isActive ? "bg-blue-500" : "bg-primary/30"
          }`} />

          <div className="p-4 sm:p-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isClosed 
                    ? "bg-emerald-500/10" 
                    : isActive 
                      ? "bg-blue-500/10" 
                      : "bg-primary/10"
                }`}>
                  {isClosed ? (
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
                  ) : (
                    <QrCode className={`w-4.5 h-4.5 ${isActive ? "text-blue-500" : "text-primary"}`} />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground text-sm truncate">
                    {notif.event?.name || notif.title}
                  </h3>
                  <p className="text-muted-foreground/60 text-[10px] mt-0.5">
                    Assigned {new Date(notif.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${statusInfo.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor} ${isActive ? "animate-pulse" : ""}`} />
                {statusInfo.label}
              </span>
            </div>

            {/* Event details */}
            {notif.event && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(notif.event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {notif.event.timeIn} - {notif.event.timeOut}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {notif.event.venue}
                </span>
              </div>
            )}

            {/* Action area */}
            {showScanButton && !isClosed && (
              <button
                onClick={() => router.push("/admin/qr-scanner")}
                className={`w-full mt-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm" 
                    : "bg-primary/10 hover:bg-primary/20 text-primary"
                }`}
              >
                <QrCode className="w-4 h-4" />
                {isActive ? "Scan Now" : "Open Scanner"}
              </button>
            )}

            {isClosed && (
              <div className="mt-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Event Completed</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-5 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="page-title">SG Officer Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Welcome, {user?.name}. Manage your scan assignments below.
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/qr-scanner")}
            className="w-full sm:w-auto action-button btn-primary flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg"
          >
            <QrCode className="w-4 h-4" />
            Open QR Scanner
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-card rounded-xl border border-border p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{scanAssignments.length}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Total Assignments</div>
          </div>
          <div className="bg-card rounded-xl border border-blue-500/20 p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{activeAssignments.length}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Active / Upcoming</div>
          </div>
          <div className="bg-card rounded-xl border border-emerald-500/20 p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{closedAssignments.length}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Completed</div>
          </div>
        </div>

        {/* Active & Upcoming Assignments */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-primary" />
            <h2 className="font-semibold text-foreground text-sm">Active & Upcoming Assignments</h2>
            {activeAssignments.length > 0 && (
              <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                {activeAssignments.length}
              </span>
            )}
          </div>
          {notifLoading ? (
            <div className="bg-card rounded-xl border border-border p-12 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground text-sm">Loading assignments...</span>
            </div>
          ) : activeAssignments.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">No active assignments</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Admin will assign you when there's an event to scan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {activeAssignments.map((notif) => renderAssignmentCard(notif, true))}
            </div>
          )}
        </div>

        {/* Completed Assignments */}
        {closedAssignments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-emerald-500" />
              <h2 className="font-semibold text-foreground text-sm">Completed Assignments</h2>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full">
                {closedAssignments.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {closedAssignments.map((notif) => renderAssignmentCard(notif, false))}
            </div>
          </div>
        )}

        {/* Other Notifications */}
        {otherNotifications.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full bg-muted-foreground/30" />
              <h2 className="font-semibold text-foreground text-sm">Other Notifications</h2>
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
              {otherNotifications.slice(0, 10).map((notif) => (
                <div key={notif.id} className={`p-4 ${!notif.isRead ? "bg-primary/5" : ""}`}>
                  <p className="font-medium text-foreground text-sm">{notif.title}</p>
                  <p className="text-muted-foreground text-xs mt-1">{notif.message}</p>
                  <p className="text-muted-foreground/50 text-[10px] mt-1.5">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">Overview of your system's key metrics and activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <div key={idx} className="stat-card p-3 sm:p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="stat-label text-xs sm:text-sm">{stat.label}</p>
                  <p className="stat-value text-lg sm:text-2xl">{stat.value}</p>
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
              {idx === 2 && stats?.weeklyChange !== undefined && (
                <div className={`flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 text-xs font-medium ${
                  stats.weeklyChange >= 0 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {stats.weeklyChange >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span className="truncate">{stats.weeklyChange >= 0 ? "+" : ""}{stats.weeklyChange}% from last week</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 bg-card rounded-lg border border-border/50 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Recent Events</h2>
          </div>
          {recentEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No recent events</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-muted">
                    <th>Event Name</th>
                    <th className="hidden sm:table-cell">Date</th>
                    <th>Attendees</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="font-medium text-foreground text-sm">
                        <div>{event.name}</div>
                        <div className="sm:hidden text-xs text-muted-foreground">{new Date(event.date).toLocaleDateString()}</div>
                      </td>
                      <td className="text-muted-foreground text-sm hidden sm:table-cell">{new Date(event.date).toLocaleDateString()}</td>
                      <td className="text-sm font-medium text-foreground">{event.attendees}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          event.status === "ACTIVE" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                          event.status === "UPCOMING" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                          "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                        }`}>
                          ● {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border/50">
          <h2 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm">Attendance Status</h2>
          <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={1}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #2a2a3e",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#f1f1f1",
                  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.4)",
                  padding: "8px 12px",
                }}
                labelStyle={{
                  color: "#f1f1f1",
                  fontWeight: 600,
                }}
                itemStyle={{
                  color: "#d1d5db",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          </div>
          <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-xs">
            {statusData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
