"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Archive, Eye, Loader2, X, Download, BookOpen } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getCurrentUser } from "@/lib/auth"
import { QRCodeSVG } from "qrcode.react"

// Course options — based on actual enrolled programs
const COURSES = [
  "ACT-AD",
  "ACT-SM",
  "BSIS",
  "BTVTED",
  "BTVTED-CHS",
]

// Year options for students
const STUDENT_YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
]

// Position options for faculty/staff
const POSITIONS = [
  "Instructor",
  "Assistant Professor",
  "Associate Professor",
  "Professor",
  "Department Head",
  "Dean",
  "Staff",
  "Administrative Assistant",
  "Registrar",
  "Librarian",
  "IT Support",
  "Other",
]

interface User {
  id: string
  schoolId: string
  name: string
  email: string
  phone: string | null
  course: string | null
  year: string | null
  role: string
  status: string
  createdAt: string
  _count?: {
    attendanceRecords: number
    certificates: number
  }
}

export default function UserManagement() {
  const router = useRouter()

  // Admin-only page guard
  useEffect(() => {
    const user = getCurrentUser()
    if (user && user.role !== "admin") {
      router.push("/admin/dashboard")
    }
  }, [router])

  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState("All Roles")
  const [selectedCourse, setSelectedCourse] = useState("All Courses")
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const qrRef = useRef<HTMLDivElement>(null)

  // Form state for adding new user
  const [newUser, setNewUser] = useState({
    schoolId: "",
    name: "",
    email: "",
    phone: "",
    course: "",
    year: "",
    role: "STUDENT",
  })



  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (selectedRole !== "All Roles") {
        params.set("role", selectedRole.toUpperCase())
      }
      if (searchQuery) {
        params.set("search", searchQuery)
      }

      const response = await fetch(`/api/users?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch users")
      
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      setError("Failed to load users")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [selectedRole, searchQuery])

  // Derive unique courses from fetched users for the filter dropdown
  const availableCourses = useMemo(() => {
    const courses = [...new Set(users.map(u => u.course).filter(Boolean))] as string[]
    return courses.sort((a, b) => a.localeCompare(b))
  }, [users])

  // Filter by course and sort alphabetically by name
  const displayUsers = useMemo(() => {
    let filtered = users
    if (selectedCourse !== "All Courses") {
      filtered = filtered.filter(u => u.course === selectedCourse)
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [users, selectedCourse])

  // Handle add user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validate School ID: exactly 8 digits
    if (!/^\d{8}$/.test(newUser.schoolId)) {
      toast.error("School ID must be exactly 8 digits")
      return
    }
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      toast.error("Please enter a valid email address")
      return
    }
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add user")
      }

      setShowAddModal(false)
      setNewUser({ schoolId: "", name: "", email: "", phone: "", course: "", year: "", role: "STUDENT" })
      toast.success("User added successfully")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Handle archive user (soft delete — sets status to INACTIVE)
  const handleArchiveUser = async (user: User) => {
    if (user.status === "INACTIVE") {
      // Unarchive
      try {
        await fetch(`/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: user.name,
            email: user.email,
            phone: user.phone || null,
            course: user.course || null,
            year: user.year || null,
            role: user.role,
            status: "ACTIVE",
          }),
        })
        toast.success(`User "${user.name}" restored to active`)
        fetchUsers()
      } catch {
        toast.error("Failed to restore user")
      }
      return
    }
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          course: user.course || null,
          year: user.year || null,
          role: user.role,
          status: "INACTIVE",
        }),
      })
      if (!response.ok) throw new Error("Failed to archive user")
      toast.success(`User "${user.name}" archived (set to Inactive)`)
      fetchUsers()
    } catch {
      toast.error("Failed to archive user")
    }
  }

  // Handle view QR code
  const handleViewQR = (user: User) => {
    setSelectedUser(user)
    setShowQRModal(true)
  }

  // Download QR code as PNG
  const handleDownloadQR = () => {
    if (!selectedUser || !qrRef.current) return

    const schoolId = selectedUser.schoolId
    const svg = qrRef.current.querySelector('svg')
    if (!svg) return

    // Create canvas and draw SVG
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    
    img.onload = () => {
      canvas.width = 300
      canvas.height = 350
      if (ctx) {
        // White background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        // Draw QR code
        ctx.drawImage(img, 50, 20, 200, 200)
        // Add user info
        ctx.fillStyle = 'black'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(selectedUser.name, canvas.width / 2, 250)
        ctx.font = 'bold 16px monospace'
        ctx.fillText(`ID: ${schoolId}`, canvas.width / 2, 275)
        ctx.font = '12px sans-serif'
        ctx.fillText('Scan for Attendance', canvas.width / 2, 300)
        
        // Download as PNG
        const link = document.createElement('a')
        link.href = canvas.toDataURL('image/png')
        link.download = `qr_code_${schoolId}.png`
        link.click()
        toast.success("QR Code downloaded successfully")
      }
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  // Format role display
  const formatRole = (role: string) => {
    if (role === "SG_OFFICER") return "SG Officer"
    return role.charAt(0) + role.slice(1).toLowerCase()
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">Manage and organize system users</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="action-button btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      {/* Search and Role Filter */}
      <div className="bg-card rounded-lg p-3 sm:p-4 border border-border/50">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, ID, or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md bg-background border border-border text-foreground placeholder-muted-foreground text-sm"
            />
          </div>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Roles">All Roles</SelectItem>
              <SelectItem value="Student">Student</SelectItem>
              <SelectItem value="Sg_officer">SG Officer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Course Navigation Buttons */}
      <div className="bg-card rounded-lg p-3 sm:p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Filter by Course</span>
          {selectedCourse !== "All Courses" && (
            <button
              onClick={() => setSelectedCourse("All Courses")}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCourse("All Courses")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedCourse === "All Courses"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            All Courses
          </button>
          {availableCourses.map(course => (
            <button
              key={course}
              onClick={() => setSelectedCourse(course)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCourse === course
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {course}
            </button>
          ))}
          {availableCourses.length === 0 && !isLoading && (
            <span className="text-xs text-muted-foreground">No courses found</span>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading users...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : displayUsers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No users found</div>
        ) : (
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr className="bg-muted/40">
              <th>School ID</th>
              <th>Name</th>
              <th className="hidden md:table-cell">Course / Department</th>
              <th className="hidden sm:table-cell">Year</th>
              <th>Role</th>
              <th className="hidden sm:table-cell">Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayUsers.map((user) => (
              <tr key={user.id}>
                <td className="font-mono text-xs sm:text-sm text-primary">{user.schoolId}</td>
                <td className="font-medium text-foreground text-xs sm:text-sm">{user.name}</td>
                <td className="text-muted-foreground text-sm hidden md:table-cell">{user.course || "—"}</td>
                <td className="text-muted-foreground text-sm hidden sm:table-cell">{user.year || "—"}</td>
                <td>
                  <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {formatRole(user.role)}
                  </span>
                </td>
                <td className="hidden sm:table-cell">
                  {user.status === "ACTIVE" ? (
                    <span className="badge-success">● Active</span>
                  ) : (
                    <span className="badge-warning">● Inactive</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button 
                      onClick={() => handleViewQR(user)}
                      className="p-1 sm:p-1.5 hover:bg-muted rounded-md transition-colors" 
                      title="View QR Code"
                    >
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => handleArchiveUser(user)}
                      className={`p-1 sm:p-1.5 rounded-md transition-colors ${
                        user.status === "INACTIVE"
                          ? "hover:bg-green-500/10 text-green-500"
                          : "hover:bg-amber-500/10 text-amber-500"
                      }`}
                      title={user.status === "INACTIVE" ? "Restore user" : "Archive user"}
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto border border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Add New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">School ID</label>
                <input
                  type="text"
                  placeholder="e.g., 20240001"
                  value={newUser.schoolId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 8)
                    setNewUser({ ...newUser, schoolId: val })
                  }}
                  required
                  maxLength={8}
                  pattern="\d{8}"
                  title="School ID must be exactly 8 digits"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
                {newUser.schoolId && newUser.schoolId.length !== 8 && (
                  <p className="text-xs text-yellow-500 mt-1">{newUser.schoolId.length}/8 digits</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="Enter email (e.g., name@example.com)"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Phone Number <span className="text-xs text-muted-foreground">(optional)</span></label>
                <input
                  type="tel"
                  placeholder="e.g., 09171234567"
                  value={newUser.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 11)
                    setNewUser({ ...newUser, phone: val })
                  }}
                  maxLength={11}
                  pattern="\d{11}"
                  title="Phone number must be 11 digits (e.g., 09171234567)"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
                {newUser.phone && newUser.phone.length !== 11 && (
                  <p className="text-xs text-yellow-500 mt-1">{newUser.phone.length}/11 digits</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Course / Department</label>
                <Select value={newUser.course} onValueChange={(value) => setNewUser({ ...newUser, course: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select course/department" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSES.map((course) => (
                      <SelectItem key={course} value={course}>{course}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Year / Position</label>
                <Select value={newUser.year} onValueChange={(value) => setNewUser({ ...newUser, year: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={(newUser.role === "STUDENT" || newUser.role === "SG_OFFICER") ? "Select year" : "Select position"} />
                  </SelectTrigger>
                  <SelectContent>
                    {((newUser.role === "STUDENT" || newUser.role === "SG_OFFICER") ? STUDENT_YEARS : POSITIONS).map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value, year: "" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="SG_OFFICER">SG Officer</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 action-button btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="flex-1 action-button btn-primary">
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* QR Code Modal */}
      {showQRModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">QR Code</h2>
              <button onClick={() => setShowQRModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center">
              <div className="mb-4">
                <p className="font-medium text-foreground">{selectedUser.name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.schoolId}</p>
              </div>
              <div ref={qrRef} className="bg-white p-4 rounded-lg inline-block mb-4">
                <QRCodeSVG
                  value={selectedUser.schoolId}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <button 
                onClick={handleDownloadQR}
                className="w-full action-button btn-primary flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
