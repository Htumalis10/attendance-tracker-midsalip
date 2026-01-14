import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { NotificationType } from "@prisma/client"

// Helper function to determine the correct event status based on date/time
function getCorrectEventStatus(event: { date: Date; timeIn: string; timeOut: string; status: string }): string {
  const now = new Date()
  const eventDate = new Date(event.date)
  
  // Set event date to start of day for comparison
  const eventDateStart = new Date(eventDate)
  eventDateStart.setHours(0, 0, 0, 0)
  
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  
  // Parse timeIn and timeOut
  const [timeInHour, timeInMin] = event.timeIn.split(":").map(Number)
  const [timeOutHour, timeOutMin] = event.timeOut.split(":").map(Number)
  
  // Create full datetime for event start and end
  const eventStart = new Date(eventDate)
  eventStart.setHours(timeInHour, timeInMin, 0, 0)
  
  const eventEnd = new Date(eventDate)
  eventEnd.setHours(timeOutHour, timeOutMin, 0, 0)
  
  // If event date is in the past (before today), mark as CLOSED
  if (eventDateStart < todayStart) {
    return "CLOSED"
  }
  
  // If event is today
  if (eventDateStart.getTime() === todayStart.getTime()) {
    // If current time is after event end time, mark as CLOSED
    if (now >= eventEnd) {
      return "CLOSED"
    }
    // If current time is within event time window, mark as ACTIVE
    if (now >= eventStart && now < eventEnd) {
      return "ACTIVE"
    }
    // If event hasn't started yet today, keep as UPCOMING
    return "UPCOMING"
  }
  
  // If event date is in the future, keep as UPCOMING
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

// Auto-update event statuses
async function updateEventStatuses() {
  try {
    const events = await prisma.event.findMany({
      where: {
        status: { in: ["UPCOMING", "ACTIVE"] }
      }
    })
    
    for (const event of events) {
      const correctStatus = getCorrectEventStatus(event)
      if (correctStatus !== event.status) {
        await prisma.event.update({
          where: { id: event.id },
          data: { status: correctStatus as any }
        })
        
        // If event just closed, auto-generate certificates
        if (correctStatus === "CLOSED") {
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
      orderBy: { date: "desc" },
      include: {
        _count: {
          select: {
            attendanceRecords: true,
            certificates: true,
          },
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
    const { name, description, date, venue, organizer, timeIn, timeOut, status } = body

    const eventDate = new Date(date)
    
    // Determine correct status based on date/time
    let correctStatus = status?.toUpperCase() || "UPCOMING"
    if (!status || status === "UPCOMING") {
      correctStatus = getCorrectEventStatus({
        date: eventDate,
        timeIn: timeIn || "08:00",
        timeOut: timeOut || "17:00",
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
        status: correctStatus as any,
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
            message: `${name} scheduled for ${eventDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${venue}. Time: ${timeIn} - ${timeOut}`,
            type: NotificationType.EVENT_CREATED
          }))
        })
        console.log(`Successfully created ${activeStudents.length} notifications`)
      }
    } catch (notifError) {
      console.error("Error creating notifications:", notifError)
      // Don't fail the event creation if notifications fail
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}
