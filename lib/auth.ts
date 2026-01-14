// Authentication types and functions
export interface StudentProfile {
  name: string
  email: string
  phone: string
  course: string
  schoolId?: string
}

export interface User {
  id: string
  schoolId: string
  name: string
  role: "admin" | "student"
  email: string
  profile?: StudentProfile
}

// Authenticate user via API
export async function authenticateUser(id: string, role: "admin" | "student"): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ schoolId: id, role }),
    })

    if (!response.ok) {
      return null
    }

    const user = await response.json()
    return user
  } catch (error) {
    console.error("Authentication error:", error)
    return null
  }
}

// Synchronous authentication for backward compatibility (uses local storage cache)
export function authenticateUserSync(id: string, role: "admin" | "student"): User | null {
  // This is a fallback that checks if user exists in localStorage
  // Real authentication should use the async version
  const cachedUsers = localStorage.getItem("smartcode_cached_users")
  if (cachedUsers) {
    const users = JSON.parse(cachedUsers)
    const user = users.find((u: User) => 
      u.schoolId.toUpperCase() === id.toUpperCase() && 
      u.role === role
    )
    return user || null
  }
  return null
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null
  const userStr = localStorage.getItem("smartcode_user")
  return userStr ? JSON.parse(userStr) : null
}

export function setCurrentUser(user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("smartcode_user", JSON.stringify(user))
  }
}

export function updateStudentProfile(profile: StudentProfile): void {
  if (typeof window !== "undefined") {
    const user = getCurrentUser()
    if (user) {
      user.profile = profile
      setCurrentUser(user)
    }
  }
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("smartcode_user")
  }
}
