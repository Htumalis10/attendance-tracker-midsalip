import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/scanners - Get all scanner devices
export async function GET() {
  try {
    // Mark devices as offline if they haven't been seen in the last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    await prisma.scannerDevice.updateMany({
      where: {
        lastSeen: {
          lt: twoMinutesAgo,
        },
        status: "ONLINE",
      },
      data: {
        status: "OFFLINE",
      },
    })

    const scanners = await prisma.scannerDevice.findMany({
      orderBy: [{ status: "desc" }, { lastSeen: "desc" }],
    })

    return NextResponse.json(scanners)
  } catch (error) {
    console.error("Error fetching scanners:", error)
    return NextResponse.json({ error: "Failed to fetch scanners" }, { status: 500 })
  }
}

// POST /api/scanners - Register or update a device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, name, deviceType, browser, os, location, offlineRecords } = body

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    // Upsert the device (create if not exists, update if exists)
    const device = await prisma.scannerDevice.upsert({
      where: { deviceId },
      create: {
        deviceId,
        name: name || "Unknown Device",
        deviceType: deviceType || "unknown",
        browser: browser || null,
        os: os || null,
        location: location || null,
        status: "ONLINE",
        lastSeen: new Date(),
        offlineRecords: offlineRecords || 0,
      },
      update: {
        name: name || undefined,
        deviceType: deviceType || undefined,
        browser: browser || undefined,
        os: os || undefined,
        location: location || undefined,
        status: "ONLINE",
        lastSeen: new Date(),
        offlineRecords: offlineRecords !== undefined ? offlineRecords : undefined,
      },
    })

    return NextResponse.json(device)
  } catch (error) {
    console.error("Error registering device:", error)
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 })
  }
}

// PUT /api/scanners - Update device status (heartbeat)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, status, offlineRecords } = body

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    const device = await prisma.scannerDevice.update({
      where: { deviceId },
      data: {
        status: status || "ONLINE",
        lastSeen: new Date(),
        offlineRecords: offlineRecords !== undefined ? offlineRecords : undefined,
      },
    })

    return NextResponse.json(device)
  } catch (error) {
    console.error("Error updating device status:", error)
    return NextResponse.json({ error: "Failed to update device status" }, { status: 500 })
  }
}

// DELETE /api/scanners - Remove a device
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("deviceId")

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    await prisma.scannerDevice.delete({
      where: { deviceId },
    })

    return NextResponse.json({ message: "Device removed successfully" })
  } catch (error) {
    console.error("Error removing device:", error)
    return NextResponse.json({ error: "Failed to remove device" }, { status: 500 })
  }
}
