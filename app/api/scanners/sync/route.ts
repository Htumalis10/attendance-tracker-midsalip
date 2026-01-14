import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { syncAll, deviceId } = body

    if (syncAll) {
      // Sync all devices with offline records
      const devicesWithRecords = await prisma.scannerDevice.findMany({
        where: {
          offlineRecords: { gt: 0 }
        }
      })

      let totalRecordsSynced = 0

      for (const device of devicesWithRecords) {
        // Simulate syncing records - in real app, this would process actual offline data
        totalRecordsSynced += device.offlineRecords

        // Update device status
        await prisma.scannerDevice.update({
          where: { id: device.id },
          data: {
            offlineRecords: 0,
            lastSync: new Date(),
            status: "ONLINE",
          }
        })
      }

      return NextResponse.json({
        success: true,
        syncedCount: devicesWithRecords.length,
        recordsSynced: totalRecordsSynced,
      })
    } else if (deviceId) {
      // Sync specific device
      const device = await prisma.scannerDevice.findUnique({
        where: { id: deviceId }
      })

      if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }

      const recordsSynced = device.offlineRecords

      // Update device status
      await prisma.scannerDevice.update({
        where: { id: deviceId },
        data: {
          offlineRecords: 0,
          lastSync: new Date(),
          status: "ONLINE",
        }
      })

      return NextResponse.json({
        success: true,
        recordsSynced,
      })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error) {
    console.error("Failed to sync devices:", error)
    return NextResponse.json({ error: "Failed to sync devices" }, { status: 500 })
  }
}
