"use client"

import { useState, useEffect } from "react"
import { Users, Calendar, Activity, Award, TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

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
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [attendanceByStatus, setAttendanceByStatus] = useState<AttendanceByStatus[]>([])
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])

  useEffect(() => {
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
  }, [])

  const statCards = [
    { icon: Users, label: "Total Users", value: stats?.totalUsers?.toLocaleString() || "0", color: "primary" },
    { icon: Calendar, label: "Active Events", value: stats?.activeEvents?.toString() || "0", color: "accent" },
    { icon: Activity, label: "Today's Attendance", value: stats?.todayAttendance?.toLocaleString() || "0", color: "secondary" },
    { icon: Award, label: "Certificates Generated", value: stats?.totalCertificates?.toLocaleString() || "0", color: "primary" },
  ]

  const statusColorMap: Record<string, string> = {
    PRESENT: "oklch(0.68 0.14 145)",
    APPROVED: "oklch(0.68 0.14 145)",
    ABSENT: "oklch(0.6 0.24 27)",
    LATE: "oklch(0.78 0.11 85)",
    PENDING: "oklch(0.7 0.1 220)",
    REJECTED: "oklch(0.5 0.2 27)",
  }

  const statusData = attendanceByStatus.map(item => ({
    name: item.status.charAt(0) + item.status.slice(1).toLowerCase(),
    value: item.count,
    color: statusColorMap[item.status] || "oklch(0.6 0.1 200)",
  }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading dashboard...</span>
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
        <div className="lg:col-span-2 bg-card rounded-lg p-4 sm:p-6 border border-border/50">
          <h2 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm">Weekly Attendance Trend</h2>
          {weeklyData.length > 0 ? (
            <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" style={{ fontSize: "10px" }} tick={{ fontSize: 10 }} />
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
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--primary)", r: 3 }}
                  name="Actual Attendance"
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  name="Expected"
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground text-sm">
              No attendance data available
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

      {/* Recent Activity */}
      <div className="bg-card rounded-lg p-4 sm:p-6 border border-border/50">
        <h2 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm">Recent Events</h2>
        <div className="space-y-2 sm:space-y-3">
          {recentEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No recent events</p>
          ) : (
            recentEvents.map((event, idx) => (
              <div key={event.id} className="flex items-start justify-between py-2 sm:py-3 border-b border-border/50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-xs sm:text-sm truncate">{event.name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 sm:mt-1">
                    {event.attendees} attendees • {event.status}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs whitespace-nowrap ml-3 sm:ml-4">
                  {new Date(event.date).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
