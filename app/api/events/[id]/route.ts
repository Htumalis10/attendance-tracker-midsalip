import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { NotificationType } from "@prisma/client"

// GET /api/events/[id] - Get a specific event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        attendanceRecords: {
          include: {
            user: true,
          },
          orderBy: { createdAt: "desc" },
        },
        certificates: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            attendanceRecords: true,
            certificates: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error fetching event:", error)
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 })
  }
}

// PUT /api/events/[id] - Update an event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, date, venue, organizer, timeIn, timeOut, status } = body

    // Get the current event to check if status is changing
    const currentEvent = await prisma.event.findUnique({ where: { id } })
    const isClosingEvent = status?.toUpperCase() === "CLOSED" && currentEvent?.status !== "CLOSED"

    const event = await prisma.event.update({
      where: { id },
      data: {
        name,
        description,
        date: date ? new Date(date) : undefined,
        venue,
        organizer,
        timeIn,
        timeOut,
        status: status?.toUpperCase(),
      },
    })

    // If event is being closed, auto-generate certificates for attendees
    if (isClosingEvent) {
      try {
        const attendanceRecords = await prisma.attendanceRecord.findMany({
          where: {
            eventId: id,
            status: { in: ["PRESENT", "APPROVED", "INSIDE"] },
            timeIn: { not: null }
          }
        })

        for (const record of attendanceRecords) {
          const existingCert = await prisma.certificate.findUnique({
            where: {
              userId_eventId: { userId: record.userId, eventId: record.eventId }
            }
          })

          if (!existingCert) {
            await prisma.certificate.create({
              data: {
                userId: record.userId,
                eventId: record.eventId,
                title: `Certificate of Attendance - ${event.name}`,
              }
            })

            // Notify student about certificate
            await prisma.notification.create({
              data: {
                userId: record.userId,
                eventId: record.eventId,
                title: "Certificate Available! 🎉",
                message: `Your certificate for "${event.name}" is now available for download.`,
                type: NotificationType.CERTIFICATE_AVAILABLE
              }
            })
          }
        }
      } catch (certError) {
        console.error("Error auto-generating certificates:", certError)
      }
    } else {
      // Create notifications for all active students about the updated event
      try {
        const activeStudents = await prisma.user.findMany({
          where: { role: "STUDENT", status: "ACTIVE" },
          select: { id: true }
        })

        if (activeStudents.length > 0) {
          const eventDate = new Date(event.date)
          await prisma.notification.createMany({
            data: activeStudents.map(student => ({
              userId: student.id,
              eventId: event.id,
              title: "Event Updated",
              message: `${event.name} has been updated. Date: ${eventDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${event.venue}. Time: ${event.timeIn} - ${event.timeOut}`,
              type: NotificationType.EVENT_UPDATED
            }))
          })
        }
      } catch (notifError) {
        console.error("Error creating notifications:", notifError)
      }
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error updating event:", error)
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  }
}

// DELETE /api/events/[id] - Delete an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.event.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Event deleted successfully" })
  } catch (error) {
    console.error("Error deleting event:", error)
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
}
