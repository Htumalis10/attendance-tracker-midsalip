"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Activity,
  FileText,
  Award,
  Wifi,
  LogOut,
  Menu,
  QrCode,
} from "lucide-react"
import { getCurrentUser, logout } from "@/lib/auth"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    setMounted(true)
    const currentUser = getCurrentUser()
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "sg_officer")) {
      router.push("/login")
    } else {
      setUser(currentUser)
    }
    setAuthChecked(true)

    // Set dark mode as default
    if (!document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.add("dark")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Don't render anything until auth is checked to prevent flash/redirect
  if (!authChecked) {
    return (
      <div className="dark">
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const isAdmin = user?.role === "admin"

  // Full nav for admin, limited for SG Officers
  const allNavItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "sg_officer"] },
    { href: "/admin/users", label: "User Management", icon: Users, roles: ["admin"] },
    { href: "/admin/events", label: "Event Management", icon: Calendar, roles: ["admin"] },
    { href: "/admin/qr-scanner", label: "QR Scanner", icon: QrCode, roles: ["sg_officer"] },
    { href: "/admin/attendance", label: "Attendance Monitoring", icon: Activity, roles: ["admin"] },
    { href: "/admin/reports", label: "Reports", icon: FileText, roles: ["admin"] },
    { href: "/admin/certificates", label: "Certificates", icon: Award, roles: ["sg_officer"] },
    { href: "/admin/sync-status", label: "Sync Status", icon: Wifi, roles: ["admin"] },
  ]

  const navItems = user ? allNavItems.filter(item => item.roles.includes(user.role)) : []

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
                <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">{isAdmin ? "Admin Panel" : "SG Officer Panel"}</p>
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
            <div className="text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-none">{mounted && user ? user.name : isAdmin ? "Admin Panel" : "SG Officer Panel"}</div>
          </div>

          {/* Page Content */}
          <main className="p-4 sm:p-6 md:p-8 relative">{children}</main>
        </div>
      </div>
    </div>
  )
}
