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

    // Get attendance records based on criteria
    let whereCondition: any = { eventId }
    
    if (criteria === "Time-In & Time-Out") {
      whereCondition.timeOut = { not: null }
      whereCondition.status = "PRESENT"
    } else if (criteria === "Time-In Only") {
      whereCondition.timeIn = { not: null }
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
      // Check if certificate already exists
      const existingCert = await prisma.certificate.findFirst({
        where: {
          userId: record.userId,
          eventId: record.eventId,
        },
      })

      if (!existingCert) {
        const certificate = await prisma.certificate.create({
          data: {
            userId: record.userId,
            eventId: record.eventId,
            title: `Certificate of Attendance - ${record.event.name}`,
          },
        })
        certificatesCreated.push(certificate)

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
