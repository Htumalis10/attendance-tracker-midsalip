import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getPHTime } from "@/lib/time-utils"

// GET /api/attendance - Get all attendance records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId")
    const userId = searchParams.get("userId")
    const status = searchParams.get("status")
    const date = searchParams.get("date")
    const search = searchParams.get("search")

    const where: any = {}

    if (eventId) {
      where.eventId = eventId
    }

    if (userId) {
      where.userId = userId
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase()
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { user: { schoolId: { contains: search } } },
      ]
    }

    if (date) {
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)

      where.createdAt = {
        gte: startDate,
        lte: endDate,
      }
    }

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        event: true,
      },
    })

    return NextResponse.json(attendanceRecords)
  } catch (error) {
    console.error("Error fetching attendance records:", error)
    return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 })
  }
}

// POST /api/attendance - Create or update attendance record (QR scan)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolId, userId, eventId, type, approvedBy, status, period } = body

    // Default period to "morning" for backward compatibility
    const currentPeriod: "morning" | "afternoon" | "evening" = period || "morning"

    let targetUserId = userId

    // If schoolId provided instead of userId, look up the user
    if (!targetUserId && schoolId) {
      const user = await prisma.user.findUnique({
        where: { schoolId },
      })

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Only students can have attendance recorded
      if (user.role !== "STUDENT") {
        return NextResponse.json({ error: "Attendance is only for students" }, { status: 403 })
      }

      targetUserId = user.id
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "userId or schoolId is required" }, { status: 400 })
    }

    // Verify user is a student when userId is provided directly
    if (targetUserId) {
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { role: true }
      })
      if (user && user.role !== "STUDENT") {
        return NextResponse.json({ error: "Attendance is only for students" }, { status: 403 })
      }
    }

    // Simple create attendance record (for QR scanner approve flow)
    if (status && !type) {
      // Check if record already exists
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          userId_eventId: {
            userId: targetUserId,
            eventId,
          },
        },
      })

      if (existingRecord) {
        return NextResponse.json({ error: "Attendance already recorded for this event" }, { status: 400 })
      }

      // Get event to calculate late minutes
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      })

      let lateMinutes = 0
      if (event && event.timeIn) {
        const [eventHour, eventMinute] = event.timeIn.split(":").map(Number)
        const now = getPHTime()
        const eventTime = new Date(now)
        eventTime.setHours(eventHour, eventMinute, 0, 0)
        
        if (now > eventTime) {
          lateMinutes = Math.floor((now.getTime() - eventTime.getTime()) / 60000)
        }
      }

      const record = await prisma.attendanceRecord.create({
        data: {
          userId: targetUserId,
          eventId,
          timeIn: new Date(),
          status: status.toUpperCase(),
          lateMinutes: lateMinutes > 15 ? lateMinutes : null,
        },
        include: {
          user: true,
          event: true,
        },
      })

      return NextResponse.json(record, { status: 201 })
    }

    // Check if attendance record exists
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        userId_eventId: {
          userId: targetUserId,
          eventId,
        },
      },
    })

    if (type === "time-in") {
      // Check if already checked in for this period
      if (existingRecord) {
        const alreadyCheckedIn = currentPeriod === "morning" ? existingRecord.timeIn
          : currentPeriod === "afternoon" ? existingRecord.afternoonTimeIn
          : existingRecord.eveningTimeIn
        if (alreadyCheckedIn) {
          return NextResponse.json(
            { error: `Already checked in for ${currentPeriod} period` },
            { status: 400 }
          )
        }
      }

      // Get event to calculate late minutes
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      })

      let lateMinutes = 0
      let attendanceStatus = "PRESENT"
      
      // Use the appropriate period's timeIn for late calculation
      const periodTimeIn = event ? (
        currentPeriod === "morning" ? event.timeIn
        : currentPeriod === "afternoon" ? event.afternoonTimeIn
        : event.eveningTimeIn
      ) : null
      
      if (periodTimeIn) {
        const [eventHour, eventMinute] = periodTimeIn.split(":").map(Number)
        const now = getPHTime()
        const eventTime = new Date(now)
        eventTime.setHours(eventHour, eventMinute, 0, 0)
        
        if (now > eventTime) {
          lateMinutes = Math.floor((now.getTime() - eventTime.getTime()) / 60000)
          
          // More than 5 minutes late = LATE status
          if (lateMinutes > 5) {
            attendanceStatus = "LATE"
          }
        }
      }

      // Build the data object based on which period
      const timeInField = currentPeriod === "morning" ? "timeIn"
        : currentPeriod === "afternoon" ? "afternoonTimeIn"
        : "eveningTimeIn"

      const record = await prisma.attendanceRecord.upsert({
        where: {
          userId_eventId: {
            userId: targetUserId,
            eventId,
          },
        },
        update: {
          [timeInField]: new Date(),
          status: attendanceStatus,
          lateMinutes: lateMinutes > 0 ? lateMinutes : null,
        },
        create: {
          userId: targetUserId,
          eventId,
          [timeInField]: new Date(),
          status: attendanceStatus,
          lateMinutes: lateMinutes > 0 ? lateMinutes : null,
        },
        include: {
          user: true,
          event: true,
        },
      })

      return NextResponse.json(record, { status: 201 })
    } else if (type === "time-out") {
      // Check if student checked in for this period
      const periodTimeInField = currentPeriod === "morning" ? "timeIn"
        : currentPeriod === "afternoon" ? "afternoonTimeIn"
        : "eveningTimeIn"
      
      if (!existingRecord || !existingRecord[periodTimeInField]) {
        return NextResponse.json(
          { error: `Must check in for ${currentPeriod} period first` },
          { status: 400 }
        )
      }

      const timeOutField = currentPeriod === "morning" ? "timeOut"
        : currentPeriod === "afternoon" ? "afternoonTimeOut"
        : "eveningTimeOut"

      const record = await prisma.attendanceRecord.update({
        where: {
          userId_eventId: {
            userId: targetUserId,
            eventId,
          },
        },
        data: {
          [timeOutField]: new Date(),
          status: "PRESENT",
        },
        include: {
          user: true,
          event: true,
        },
      })

      return NextResponse.json(record)
    } else if (type === "approve") {
      const record = await prisma.attendanceRecord.update({
        where: {
          userId_eventId: {
            userId: targetUserId,
            eventId,
          },
        },
        data: {
          status: "APPROVED",
          approvedBy,
        },
        include: {
          user: true,
          event: true,
        },
      })

      return NextResponse.json(record)
    } else if (type === "reject") {
      const record = await prisma.attendanceRecord.update({
        where: {
          userId_eventId: {
            userId: targetUserId,
            eventId,
          },
        },
        data: {
          status: "REJECTED",
          approvedBy,
        },
        include: {
          user: true,
          event: true,
        },
      })

      return NextResponse.json(record)
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (error) {
    console.error("Error processing attendance:", error)
    return NextResponse.json({ error: "Failed to process attendance" }, { status: 500 })
  }
}

// PATCH /api/attendance - Edit attendance status (only for CLOSED events)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { recordId, status } = body

    if (!recordId || !status) {
      return NextResponse.json({ error: "recordId and status are required" }, { status: 400 })
    }

    // Get the record and check if its event is CLOSED
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { event: true }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 })
    }

    if (existingRecord.event.status !== "CLOSED") {
      return NextResponse.json({ error: "Attendance can only be edited for completed events" }, { status: 403 })
    }

    const validStatuses = ["PRESENT", "LATE", "ABSENT"]
    if (!validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const record = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { status: status.toUpperCase() },
      include: { user: true, event: true }
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error("Error updating attendance:", error)
    return NextResponse.json({ error: "Failed to update attendance" }, { status: 500 })
  }
}
