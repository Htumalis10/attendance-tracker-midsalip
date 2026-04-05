import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { NotificationType } from "@prisma/client"
import { getPHTime, phDate } from "@/lib/time-utils"

// Calculate grace period based on event duration
// Short events (5-10 mins): 10 minutes grace
// Medium events (20-30 mins): 20 minutes grace
// Long events (1+ hour): 60 minutes grace
function calculateGracePeriod(timeIn: string, timeOut: string): number {
  const [inHour, inMin] = timeIn.split(":").map(Number)
  const [outHour, outMin] = timeOut.split(":").map(Number)
  
  // Calculate duration in minutes
  const startMinutes = inHour * 60 + inMin
  const endMinutes = outHour * 60 + outMin
  const durationMinutes = endMinutes - startMinutes
  
  // Determine grace period based on duration
  if (durationMinutes <= 10) {
    return 10 // 10 minutes grace for 5-10 min events
  } else if (durationMinutes <= 30) {
    return 20 // 20 minutes grace for 20-30 min events
  } else if (durationMinutes <= 60) {
    return 30 // 30 minutes grace for up to 1 hour events
  } else {
    return 60 // 1 hour grace for events longer than 1 hour
  }
}

// Helper: get the latest timeOut across all periods of an event
function getLastTimeOut(event: { timeOut: string; afternoonTimeOut?: string | null; eveningTimeOut?: string | null }): string {
  if (event.eveningTimeOut) return event.eveningTimeOut
  if (event.afternoonTimeOut) return event.afternoonTimeOut
  return event.timeOut
}

// Helper: get the earliest timeIn of an event
function getFirstTimeIn(event: { timeIn: string; afternoonTimeIn?: string | null; eveningTimeIn?: string | null }): string {
  if (event.timeIn) return event.timeIn
  if (event.afternoonTimeIn) return event.afternoonTimeIn
  if (event.eveningTimeIn) return event.eveningTimeIn
  return event.timeIn
}

// Helper: build time summary string for notifications
function getTimeSummary(event: { timeIn: string; timeOut: string; afternoonTimeIn?: string | null; afternoonTimeOut?: string | null; eveningTimeIn?: string | null; eveningTimeOut?: string | null }): string {
  // Spanning: morning timeIn with no morning timeOut, directly to afternoon/evening timeOut
  if (event.timeIn && !event.timeOut && !event.afternoonTimeIn && (event.afternoonTimeOut || event.eveningTimeOut)) {
    const endTime = event.eveningTimeOut && !event.eveningTimeIn ? event.eveningTimeOut : event.afternoonTimeOut
    return `${event.timeIn} - ${endTime}`
  }
  const parts = [`${event.timeIn} - ${event.timeOut}`]
  if (event.afternoonTimeIn && event.afternoonTimeOut) parts.push(`${event.afternoonTimeIn} - ${event.afternoonTimeOut}`)
  if (event.eveningTimeIn && event.eveningTimeOut) parts.push(`${event.eveningTimeIn} - ${event.eveningTimeOut}`)
  return parts.join(", ")
}

// Helper function to determine the correct event status based on date/time
function getCorrectEventStatus(event: { date: Date; timeIn: string; timeOut: string; status: string; afternoonTimeIn?: string | null; afternoonTimeOut?: string | null; eveningTimeIn?: string | null; eveningTimeOut?: string | null }): string {
  const now = getPHTime()
  const eventDate = new Date(event.date)
  
  // Extract year, month, day from event date (in UTC since MySQL stores as UTC)
  const eventYear = eventDate.getUTCFullYear()
  const eventMonth = eventDate.getUTCMonth()
  const eventDay = eventDate.getUTCDate()
  
  // Get today's date components in Philippine time
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()
  const todayDay = now.getDate()
  
  // Parse the FIRST timeIn and the LAST timeOut
  const firstTimeIn = getFirstTimeIn(event)
  const lastTimeOut = getLastTimeOut(event)
  
  if (!firstTimeIn || !lastTimeOut) return "UPCOMING"
  
  const [timeInHour, timeInMin] = firstTimeIn.split(":").map(Number)
  const [timeOutHour, timeOutMin] = lastTimeOut.split(":").map(Number)
  
  // Create full datetime for event start and end in PHT
  const eventStart = phDate(eventYear, eventMonth, eventDay, timeInHour, timeInMin)
  const eventEnd = phDate(eventYear, eventMonth, eventDay, timeOutHour, timeOutMin)
  
  // Calculate dynamic grace period based on event duration
  const gracePeriodMinutes = calculateGracePeriod(firstTimeIn, lastTimeOut)
  
  // Add grace period for time-out
  const eventEndWithGrace = new Date(eventEnd.getTime() + gracePeriodMinutes * 60 * 1000)
  
  // Compare dates (year, month, day only)
  const isEventInPast = 
    eventYear < todayYear || 
    (eventYear === todayYear && eventMonth < todayMonth) ||
    (eventYear === todayYear && eventMonth === todayMonth && eventDay < todayDay)
  
  const isEventToday = 
    eventYear === todayYear && 
    eventMonth === todayMonth && 
    eventDay === todayDay
  
  const isEventInFuture = 
    eventYear > todayYear || 
    (eventYear === todayYear && eventMonth > todayMonth) ||
    (eventYear === todayYear && eventMonth === todayMonth && eventDay > todayDay)
  
  // If event date is in the past (before today), mark as CLOSED
  if (isEventInPast) {
    return "CLOSED"
  }
  
  // If event is today
  if (isEventToday) {
    // Compare using absolute timestamps for correct cross-timezone behavior
    const nowMs = now.getTime()
    const eventEndWithGraceMs = eventEndWithGrace.getTime()
    const eventStartMs = eventStart.getTime()
    
    // If current time is after event end time + grace period, mark as CLOSED
    if (nowMs >= eventEndWithGraceMs) {
      return "CLOSED"
    }
    // If current time is within event time window (including grace period), mark as ACTIVE
    if (nowMs >= eventStartMs && nowMs < eventEndWithGraceMs) {
      return "ACTIVE"
    }
    // If event hasn't started yet today, keep as UPCOMING
    return "UPCOMING"
  }
  
  // If event date is in the future, keep as UPCOMING
  if (isEventInFuture) {
    return "UPCOMING"
  }
  
  return "UPCOMING"
}

// Auto-generate certificates for attendees of a closed event
async function autoGenerateCertificates(eventId: string, eventName: string) {
  try {
    // Get all attendance records with timeIn and status PRESENT/APPROVED/INSIDE
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        eventId,
        status: { in: ["PRESENT", "APPROVED", "INSIDE"] },
        timeIn: { not: null }
      },
      include: {
        user: true
      }
    })

    let certificatesCreated = 0

    for (const record of attendanceRecords) {
      // Check if certificate already exists
      const existingCert = await prisma.certificate.findUnique({
        where: {
          userId_eventId: {
            userId: record.userId,
            eventId: record.eventId,
          }
        }
      })

      if (!existingCert) {
        // Create certificate
        await prisma.certificate.create({
          data: {
            userId: record.userId,
            eventId: record.eventId,
            title: `Certificate of Attendance - ${eventName}`,
          }
        })
        certificatesCreated++

        // Create notification for student
        await prisma.notification.create({
          data: {
            userId: record.userId,
            eventId: record.eventId,
            title: "Certificate Available! 🎉",
            message: `Your certificate for "${eventName}" is now available for download.`,
            type: NotificationType.CERTIFICATE_AVAILABLE
          }
        })
      }
    }

    console.log(`Auto-generated ${certificatesCreated} certificates for event ${eventId}`)
  } catch (error) {
    console.error("Error auto-generating certificates:", error)
  }
}

// Mark students as ABSENT if they didn't attend the event
async function markAbsentStudents(eventId: string, eventName: string) {
  try {
    // Get all active students
    const allStudents = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        status: "ACTIVE"
      },
      select: { id: true, name: true }
    })

    // Get all students who have attendance records for this event
    const attendedStudentIds = await prisma.attendanceRecord.findMany({
      where: { eventId },
      select: { userId: true }
    })

    const attendedIds = new Set(attendedStudentIds.map(r => r.userId))

    // Find students who didn't attend
    const absentStudents = allStudents.filter(student => !attendedIds.has(student.id))

    let absentCount = 0

    // Create ABSENT records for students who didn't scan
    for (const student of absentStudents) {
      try {
        await prisma.attendanceRecord.create({
          data: {
            userId: student.id,
            eventId: eventId,
            status: "ABSENT",
            timeIn: null,
            timeOut: null,
          }
        })
        absentCount++
      } catch (err) {
        // Record might already exist (shouldn't happen but just in case)
        console.error(`Failed to create absent record for ${student.name}:`, err)
      }
    }

    console.log(`Marked ${absentCount} students as ABSENT for event "${eventName}" (${eventId})`)
  } catch (error) {
    console.error("Error marking absent students:", error)
  }
}

// Auto-update event statuses
async function updateEventStatuses() {
  try {
    // Check ALL events that aren't manually set - events can transition in any direction
    // UPCOMING -> ACTIVE -> CLOSED (normal flow)
    // CLOSED -> ACTIVE (if event was created with wrong time or time was adjusted)
    const events = await prisma.event.findMany({
      where: {
        status: { in: ["UPCOMING", "ACTIVE", "CLOSED"] }
      }
    })
    
    for (const event of events) {
      const correctStatus = getCorrectEventStatus(event)
      if (correctStatus !== event.status) {
        const wasClosedBefore = event.status === "CLOSED"
        
        await prisma.event.update({
          where: { id: event.id },
          data: { status: correctStatus as any }
        })
        
        // If event just closed (and wasn't closed before), mark absent students and auto-generate certificates
        if (correctStatus === "CLOSED" && !wasClosedBefore) {
          // First mark absent students
          await markAbsentStudents(event.id, event.name)
          // Then generate certificates for those who attended
          await autoGenerateCertificates(event.id, event.name)
        }
      }
    }
  } catch (error) {
    console.error("Error updating event statuses:", error)
  }
}

// GET /api/events - Get all events with optional filters
export async function GET(request: NextRequest) {
  try {
    // First, auto-update event statuses based on current date/time
    await updateEventStatuses()
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: any = {}

    if (status && status !== "all") {
      where.status = status.toUpperCase()
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { venue: { contains: search } },
        { organizer: { contains: search } },
      ]
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            attendanceRecords: true,
            certificates: true,
          },
        },
        games: {
          include: {
            _count: {
              select: {
                attendanceRecords: true,
              },
            },
          },
          orderBy: { date: "asc" },
        },
      },
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, date, venue, organizer, timeIn, timeOut, afternoonTimeIn, afternoonTimeOut, eveningTimeIn, eveningTimeOut, status, type, parentEventId } = body

    const eventDate = new Date(date)
    
    // Block creating events with past dates (prevent recreating finished events)
    // Use UTC components from the event date (since "YYYY-MM-DD" parses as UTC midnight)
    // and compare with Philippine time date components for "today"
    const now = getPHTime()
    const todayYear = now.getFullYear()
    const todayMonth = now.getMonth()
    const todayDay = now.getDate()
    
    const eventYear = eventDate.getUTCFullYear()
    const eventMonth = eventDate.getUTCMonth()
    const eventDayNum = eventDate.getUTCDate()
    
    const isEventInPast = 
      eventYear < todayYear ||
      (eventYear === todayYear && eventMonth < todayMonth) ||
      (eventYear === todayYear && eventMonth === todayMonth && eventDayNum < todayDay)
    
    if (isEventInPast) {
      return NextResponse.json({ error: "Cannot create events with past dates. The event date has already passed." }, { status: 400 })
    }
    
    const isEventToday = eventYear === todayYear && eventMonth === todayMonth && eventDayNum === todayDay
    
    // If the event is today, check if the timeOut has already passed
    if (isEventToday) {
      const correctStatus = getCorrectEventStatus({
        date: eventDate,
        timeIn: timeIn || "",
        timeOut: timeOut || "",
        afternoonTimeIn: afternoonTimeIn || null,
        afternoonTimeOut: afternoonTimeOut || null,
        eveningTimeIn: eveningTimeIn || null,
        eveningTimeOut: eveningTimeOut || null,
        status: "UPCOMING"
      })
      if (correctStatus === "CLOSED") {
        return NextResponse.json({ error: "Cannot create events that have already ended. The event time has passed." }, { status: 400 })
      }
    }
    
    // Determine correct status based on date/time
    let correctStatus = status?.toUpperCase() || "UPCOMING"
    if (!status || status === "UPCOMING") {
      correctStatus = getCorrectEventStatus({
        date: eventDate,
        timeIn: timeIn || "",
        timeOut: timeOut || "",
        afternoonTimeIn: afternoonTimeIn || null,
        afternoonTimeOut: afternoonTimeOut || null,
        eveningTimeIn: eveningTimeIn || null,
        eveningTimeOut: eveningTimeOut || null,
        status: "UPCOMING"
      })
    }

    const event = await prisma.event.create({
      data: {
        name,
        description,
        date: eventDate,
        venue,
        organizer,
        timeIn,
        timeOut,
        afternoonTimeIn: afternoonTimeIn || null,
        afternoonTimeOut: afternoonTimeOut || null,
        eveningTimeIn: eveningTimeIn || null,
        eveningTimeOut: eveningTimeOut || null,
        status: correctStatus as any,
        type: (type?.toUpperCase() as any) || "REGULAR",
        parentEventId: parentEventId || null,
      },
    })

    // Create notifications for all active students about the new event
    try {
      const activeStudents = await prisma.user.findMany({
        where: { role: "STUDENT", status: "ACTIVE" },
        select: { id: true }
      })

      console.log(`Creating notifications for ${activeStudents.length} active students for event: ${name}`)

      if (activeStudents.length > 0) {
        await prisma.notification.createMany({
          data: activeStudents.map(student => ({
            userId: student.id,
            eventId: event.id,
            title: "New Event Created",
            message: `${name} scheduled for ${eventDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${venue}. Time: ${getTimeSummary({ timeIn, timeOut, afternoonTimeIn, afternoonTimeOut, eveningTimeIn, eveningTimeOut })}`,
            type: NotificationType.EVENT_CREATED
          }))
        })
        console.log(`Successfully created ${activeStudents.length} notifications`)
      }
    } catch (notifError) {
      console.error("Error creating notifications:", notifError)
      // Don't fail the event creation if notifications fail
    }

    // Notify SG Officers about scan assignment
    try {
      const sgOfficers = await prisma.user.findMany({
        where: { role: "SG_OFFICER", status: "ACTIVE" },
        select: { id: true }
      })

      if (sgOfficers.length > 0) {
        await prisma.notification.createMany({
          data: sgOfficers.map(officer => ({
            userId: officer.id,
            eventId: event.id,
            title: "Scan Assignment 📋",
            message: `You are assigned to scan attendance for "${name}" on ${eventDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${venue}. Scanning window: ${getTimeSummary({ timeIn, timeOut, afternoonTimeIn, afternoonTimeOut, eveningTimeIn, eveningTimeOut })}`,
            type: NotificationType.SCAN_ASSIGNMENT
          }))
        })
        console.log(`Notified ${sgOfficers.length} SG Officers about scan assignment`)
      }
    } catch (notifError) {
      console.error("Error notifying SG Officers:", notifError)
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}
