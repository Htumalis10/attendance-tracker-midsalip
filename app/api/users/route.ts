import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/users - Get all users with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const schoolId = searchParams.get("schoolId")
    const limit = searchParams.get("limit")

    const where: any = {}

    if (role && role !== "all") {
      where.role = role.toUpperCase()
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase()
    }

    if (schoolId) {
      where.schoolId = schoolId.toUpperCase()
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { schoolId: { contains: search } },
        { email: { contains: search } },
        { course: { contains: search } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit) : undefined,
      include: {
        _count: {
          select: {
            attendanceRecords: true,
            certificates: true,
          },
        },
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolId, name, email, phone, course, year, role, status } = body

    // Validate School ID: exactly 8 digits
    if (!schoolId || !/^\d{8}$/.test(schoolId)) {
      return NextResponse.json(
        { error: "School ID must be exactly 8 digits" },
        { status: 400 }
      )
    }

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      )
    }

    // Validate phone number if provided: exactly 11 digits
    if (phone && !/^\d{11}$/.test(phone)) {
      return NextResponse.json(
        { error: "Phone number must be exactly 11 digits" },
        { status: 400 }
      )
    }

    // Check if user with same schoolId or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ schoolId }, { email }],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this School ID or Email already exists" },
        { status: 400 }
      )
    }

    const user = await prisma.user.create({
      data: {
        schoolId,
        name,
        email,
        phone,
        course,
        year,
        role: role?.toUpperCase() || "STUDENT",
        status: status?.toUpperCase() || "ACTIVE",
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}
