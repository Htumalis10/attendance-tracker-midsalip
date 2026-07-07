import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { NotificationType } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, criteria } = body

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    // Check if event is completed (CLOSED) before generating certificates
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { status: true, name: true }
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (event.status !== "CLOSED") {
      return NextResponse.json({ error: "Certificates can only be generated for completed events. This event is still " + event.status.toLowerCase() + "." }, { status: 400 })
    }

    // Get attendance records based on criteria
    let whereCondition: any = { eventId }
    
    if (criteria === "Time-In & Time-Out") {
      // Must have at least one time-in AND at least one time-out in any period
      whereCondition.AND = [
        {
          OR: [
            { timeIn: { not: null } },
            { afternoonTimeIn: { not: null } },
            { eveningTimeIn: { not: null } },
          ]
        },
        {
          OR: [
            { timeOut: { not: null } },
            { afternoonTimeOut: { not: null } },
            { eveningTimeOut: { not: null } },
          ]
        }
      ]
      whereCondition.status = { in: ["PRESENT", "LATE", "APPROVED"] }
    } else if (criteria === "Time-In Only") {
      whereCondition.OR = [
        { timeIn: { not: null } },
        { afternoonTimeIn: { not: null } },
        { eveningTimeIn: { not: null } },
      ]
    }
    // "All Attendees" - no additional conditions

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: whereCondition,
      include: {
        user: true,
        event: true,
      },
    })

    // Generate certificates for each attendee who doesn't already have one
    const certificatesCreated = []

    for (const record of attendanceRecords) {
      try {
        // Use upsert to safely handle concurrent calls
        const cert = await prisma.certificate.upsert({
          where: {
            userId_eventId: {
              userId: record.userId,
              eventId: record.eventId,
            },
          },
          update: {}, // No update needed if already exists
          create: {
            userId: record.userId,
            eventId: record.eventId,
            title: `Certificate of Attendance - ${record.event.name}`,
          },
        })

        // Only create notification if certificate was just created (issuedAt is recent)
        const isNew = (Date.now() - new Date(cert.issuedAt).getTime()) < 5000
        if (isNew) {
          certificatesCreated.push(cert)

          // Create notification for the student
          try {
            await prisma.notification.create({
              data: {
                userId: record.userId,
                eventId: record.eventId,
                title: "Certificate Available! 🎉",
                message: `Your certificate for "${record.event.name}" is now available for download.`,
                type: NotificationType.CERTIFICATE_AVAILABLE
              }
            })
          } catch (notifError) {
            console.error("Error creating notification:", notifError)
          }
        }
      } catch (certErr) {
        console.error(`Error creating certificate for user ${record.userId}:`, certErr)
      }
    }

    return NextResponse.json({
      success: true,
      count: certificatesCreated.length,
      message: `Generated ${certificatesCreated.length} new certificates`,
    })
  } catch (error) {
    console.error("Failed to generate certificates:", error)
    return NextResponse.json({ error: "Failed to generate certificates" }, { status: 500 })
  }
}
