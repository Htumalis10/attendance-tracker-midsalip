import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/certificates - Get all certificates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const eventId = searchParams.get("eventId")

    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (eventId) {
      where.eventId = eventId
    }

    const certificates = await prisma.certificate.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      include: {
        user: true,
        event: true,
      },
    })

    return NextResponse.json(certificates)
  } catch (error) {
    console.error("Error fetching certificates:", error)
    return NextResponse.json({ error: "Failed to fetch certificates" }, { status: 500 })
  }
}

// POST /api/certificates - Issue a certificate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, eventId, title } = body

    // Check if certificate already exists
    const existingCertificate = await prisma.certificate.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    })

    if (existingCertificate) {
      return NextResponse.json(
        { error: "Certificate already issued for this event" },
        { status: 400 }
      )
    }

    const certificate = await prisma.certificate.create({
      data: {
        userId,
        eventId,
        title,
      },
      include: {
        user: true,
        event: true,
      },
    })

    return NextResponse.json(certificate, { status: 201 })
  } catch (error) {
    console.error("Error creating certificate:", error)
    return NextResponse.json({ error: "Failed to create certificate" }, { status: 500 })
  }
}
