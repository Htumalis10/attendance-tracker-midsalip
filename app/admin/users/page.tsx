"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Search, Edit, Trash2, Eye, Loader2, X, Download } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { QRCodeSVG } from "qrcode.react"

// Course options
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
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState("All Roles")
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

  // Form state for editing user
  const [editUser, setEditUser] = useState({
    id: "",
    schoolId: "",
    name: "",
    email: "",
    phone: "",
    course: "",
    year: "",
    role: "STUDENT",
    status: "ACTIVE",
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

  // Handle add user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
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

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete user")
      toast.success(`User "${userToDelete.name}" deleted successfully`)
      setShowDeleteDialog(false)
      setUserToDelete(null)
      fetchUsers()
    } catch (err) {
      toast.error("Failed to delete user")
    }
  }

  // Open delete confirmation dialog
  const confirmDelete = (user: User) => {
    setUserToDelete(user)
    setShowDeleteDialog(true)
  }

  // Handle view QR code
  const handleViewQR = (user: User) => {
    setSelectedUser(user)
    setShowQRModal(true)
  }

  // Handle open edit modal
  const handleOpenEdit = (user: User) => {
    setEditUser({
      id: user.id,
      schoolId: user.schoolId,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      course: user.course || "",
      year: user.year || "",
      role: user.role,
      status: user.status,
    })
    setShowEditModal(true)
  }

  // Handle edit user
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUser.name,
          email: editUser.email,
          phone: editUser.phone || null,
          course: editUser.course || null,
          year: editUser.year || null,
          role: editUser.role,
          status: editUser.status,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update user")
      }

      setShowEditModal(false)
      toast.success("User updated successfully")
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message)
    }
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

      {/* Search and Filter */}
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
              <SelectItem value="Faculty">Faculty</SelectItem>
              <SelectItem value="Staff">Staff</SelectItem>
            </SelectContent>
          </Select>
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
        ) : users.length === 0 ? (
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
            {users.map((user) => (
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
                      onClick={() => handleOpenEdit(user)}
                      className="p-1 sm:p-1.5 hover:bg-muted rounded-md transition-colors" 
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button 
                      onClick={() => confirmDelete(user)}
                      className="p-1 sm:p-1.5 hover:bg-red-500/10 rounded-md transition-colors" 
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
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
                  onChange={(e) => setNewUser({ ...newUser, schoolId: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
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
                  placeholder="Enter email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
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
                    <SelectValue placeholder={newUser.role === "STUDENT" ? "Select year" : "Select position"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(newUser.role === "STUDENT" ? STUDENT_YEARS : POSITIONS).map((item) => (
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
                    <SelectItem value="FACULTY">Faculty</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
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

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-md border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Edit User</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">School ID</label>
                <p className="font-mono text-primary text-sm py-2">{editUser.schoolId}</p>
                <p className="text-xs text-muted-foreground">(Cannot be changed)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
                <input
                  type="text"
                  value={editUser.phone}
                  onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Course / Department</label>
                <Select value={editUser.course} onValueChange={(value) => setEditUser({ ...editUser, course: value })}>
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
                <Select value={editUser.year} onValueChange={(value) => setEditUser({ ...editUser, year: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={editUser.role === "STUDENT" ? "Select year" : "Select position"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(editUser.role === "STUDENT" ? STUDENT_YEARS : POSITIONS).map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                  <Select value={editUser.role} onValueChange={(value) => setEditUser({ ...editUser, role: value, year: "" })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="FACULTY">Faculty</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
                  <Select value={editUser.status} onValueChange={(value) => setEditUser({ ...editUser, status: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 action-button btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="flex-1 action-button btn-primary">
                  Save Changes
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{userToDelete?.name}</span>? 
              This action cannot be undone and will remove all associated attendance records and certificates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
