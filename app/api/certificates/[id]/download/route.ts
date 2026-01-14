import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// PUT /api/certificates/[id]/download - Mark certificate as downloaded
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const certificate = await prisma.certificate.update({
      where: { id },
      data: { downloaded: true },
      include: {
        user: true,
        event: true,
      },
    })

    return NextResponse.json(certificate)
  } catch (error) {
    console.error("Error updating certificate:", error)
    return NextResponse.json({ error: "Failed to update certificate" }, { status: 500 })
  }
}
