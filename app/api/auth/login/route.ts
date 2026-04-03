import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// POST /api/auth/login - Authenticate user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolId, role } = body

    if (!schoolId || !role) {
      return NextResponse.json(
        { error: "School ID and role are required" },
        { status: 400 }
      )
    }

    // Find user by schoolId
    const user = await prisma.user.findUnique({
      where: { schoolId: schoolId.toUpperCase() },
    })

    if (!user) {
      const label = role === "admin" ? "Admin" : role === "sg_officer" ? "SG Officer" : "Student"
      return NextResponse.json(
        { error: `Invalid ${label} ID` },
        { status: 401 }
      )
    }

    // Verify role matches
    const isAdmin = role === "admin" && user.role === "ADMIN"
    const isSGOfficer = role === "sg_officer" && user.role === "SG_OFFICER"
    const isStudent = role === "student" && user.role === "STUDENT"

    if (!isAdmin && !isSGOfficer && !isStudent) {
      const label = role === "admin" ? "Admin" : role === "sg_officer" ? "SG Officer" : "Student"
      return NextResponse.json(
        { error: `Invalid ${label} ID` },
        { status: 401 }
      )
    }

    // Check if user is active
    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is inactive. Please contact administrator." },
        { status: 401 }
      )
    }

    // Return user data (without sensitive info)
    const roleMap: Record<string, string> = {
      ADMIN: "admin",
      SG_OFFICER: "sg_officer",
      STUDENT: "student",
    }

    return NextResponse.json({
      id: user.id,
      schoolId: user.schoolId,
      name: user.name,
      email: user.email,
      role: roleMap[user.role] || user.role.toLowerCase(),
      profile: user.role === "STUDENT" ? {
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        course: user.course || "",
        schoolId: user.schoolId,
      } : undefined,
    })
  } catch (error) {
    console.error("Error during authentication:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
