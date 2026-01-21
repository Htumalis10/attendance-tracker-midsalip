"use client"

import type React from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, User, QrCode, Award, LogOut, Menu, Bell, Calendar, Clock, MapPin, Check, CheckCheck } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { logout, getCurrentUser } from "@/lib/auth"
import { formatTimeDisplay } from "@/lib/time-utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface UpcomingEvent {
  id: string
  name: string
  date: string
  venue: string
  timeIn: string
  status: string
}

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
  }
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Set dark mode as default
    if (!document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.add("dark")
    }
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  // Fetch upcoming events for notifications
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const res = await fetch("/api/events?status=upcoming")
        if (res.ok) {
          const events = await res.json()
          // Filter to only show events in the next 7 days
          const now = new Date()
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          const upcoming = events.filter((event: UpcomingEvent) => {
            const eventDate = new Date(event.date)
            return eventDate >= now && eventDate <= nextWeek
          })
          setUpcomingEvents(upcoming)
        }
      } catch (error) {
        console.error("Failed to fetch upcoming events:", error)
      }
    }
    fetchUpcomingEvents()
    // Refresh every 5 minutes
    const interval = setInterval(fetchUpcomingEvents, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch notifications from the notifications API
  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) {
      console.log("No current user ID, skipping notification fetch")
      return
    }
    
    try {
      console.log("Fetching notifications for user:", currentUser.id)
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        console.log("Notifications fetched:", data)
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      } else {
        console.error("Failed to fetch notifications:", res.status)
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (currentUser?.id) {
      // Fetch immediately when user is available
      fetchNotifications()
      // Poll every 10 seconds for new notifications (real-time feel for certificates)
      const interval = setInterval(fetchNotifications, 10 * 1000)
      return () => clearInterval(interval)
    }
  }, [currentUser?.id, fetchNotifications])

  // Also fetch when notification popover opens
  useEffect(() => {
    if (notificationsOpen && currentUser?.id) {
      fetchNotifications()
    }
  }, [notificationsOpen, currentUser?.id, fetchNotifications])

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!currentUser?.id || unreadCount === 0) return
    
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, markAllRead: true })
      })
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error("Failed to mark notifications as read:", error)
    }
  }

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Tomorrow"
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const navItems = [
    { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/profile", label: "My Profile", icon: User },
    { href: "/student/scan-history", label: "Scan History", icon: QrCode },
    { href: "/student/certificates", label: "Certificates", icon: Award },
  ]

  return (
    <div className="dark">
      <div className="min-h-screen bg-background">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="sidebar-overlay md:hidden" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`sidebar transition-all duration-300 flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        >
          <div className="p-4 sm:p-5 border-b border-sidebar-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg opacity-75 blur-sm" />
                <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SC</span>
                </div>
              </div>
              <div>
                <span className="font-semibold text-sm bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">SmartCode</span>
                <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Student Portal</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-sidebar-accent/20 rounded-md md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <nav className="sidebar-nav flex-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className={`sidebar-nav-item group ${isActive ? "active" : ""}`}
                  onClick={() => {
                    if (window.innerWidth < 768) setSidebarOpen(false)
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                </Link>
              )
            })}
          </nav>

          <div className="space-y-1 border-t border-sidebar-border p-3">
            <button
              onClick={handleLogout}
              className="sidebar-nav-item w-full flex items-center gap-3 justify-start hover:bg-red-500/10 hover:text-red-500"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* Header */}
          <div className="page-header px-4 sm:px-6 md:px-8 py-3 sm:py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-muted rounded-md transition-colors md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1" />
            
            {/* Notifications Bell - Only render after mount to avoid hydration mismatch */}
            {mounted ? (
              <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <PopoverTrigger asChild>
                  <button className="relative p-2 hover:bg-muted rounded-md transition-colors mr-4">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    {(unreadCount > 0 || upcomingEvents.length > 0) && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                        {(unreadCount + upcomingEvents.length) > 9 ? "9+" : unreadCount + upcomingEvents.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary" />
                      Notifications
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {/* System Notifications */}
                  {notifications.length > 0 && (
                    <>
                      {notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-border/50 last:border-0 transition-colors ${
                            notif.isRead ? "bg-transparent" : "bg-primary/5"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              notif.isRead ? "bg-gray-300" : "bg-primary"
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm">{notif.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {notif.message}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {new Date(notif.createdAt).toLocaleDateString("en-US", { 
                                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* Upcoming Events Section */}
                  {upcomingEvents.length > 0 && (
                    <>
                      <div className="px-3 py-2 bg-muted/50 border-b border-border">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          Upcoming Events ({upcomingEvents.length})
                        </p>
                      </div>
                      {upcomingEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="p-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm truncate">{event.name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatEventDate(event.date)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{formatTimeDisplay(event.timeIn)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{event.venue}</span>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0 ${
                              formatEventDate(event.date) === "Today" 
                                ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                : formatEventDate(event.date) === "Tomorrow"
                                  ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}>
                              {formatEventDate(event.date) === "Today" ? "Today!" : formatEventDate(event.date) === "Tomorrow" ? "Tomorrow" : "Soon"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* Empty State */}
                  {notifications.length === 0 && upcomingEvents.length === 0 && (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No notifications
                    </div>
                  )}
                </div>
                {(notifications.length > 0 || upcomingEvents.length > 0) && (
                  <div className="p-2 border-t border-border bg-muted/30">
                    <p className="text-xs text-center text-muted-foreground">
                      Stay on top of your events! 📅
                    </p>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            ) : (
              <button className="relative p-2 hover:bg-muted rounded-md transition-colors mr-4">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            
            <div className="text-sm text-muted-foreground hidden sm:block">Student Portal</div>
          </div>

          {/* Page Content */}
          <main className="p-4 sm:p-6 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
