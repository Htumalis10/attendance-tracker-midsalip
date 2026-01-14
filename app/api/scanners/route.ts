import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/scanners - Get all scanner devices
export async function GET() {
  try {
    const scanners = await prisma.scannerDevice.findMany({
      orderBy: { deviceId: "asc" },
    })

    return NextResponse.json(scanners)
  } catch (error) {
    console.error("Error fetching scanners:", error)
    return NextResponse.json({ error: "Failed to fetch scanners" }, { status: 500 })
  }
}

// POST /api/scanners/sync - Sync all devices
export async function POST() {
  try {
    // Update all devices to show sync
    await prisma.scannerDevice.updateMany({
      where: { status: "ONLINE" },
      data: {
        lastSync: new Date(),
        offlineRecords: 0,
      },
    })

    const scanners = await prisma.scannerDevice.findMany({
      orderBy: { deviceId: "asc" },
    })

    return NextResponse.json({
      message: "Sync completed successfully",
      scanners,
    })
  } catch (error) {
    console.error("Error syncing devices:", error)
    return NextResponse.json({ error: "Failed to sync devices" }, { status: 500 })
  }
}
