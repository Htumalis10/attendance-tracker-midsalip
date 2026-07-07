import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function cleanupDuplicates() {
  console.log("🔍 Checking for duplicate attendance records...")

  // Find all attendance records grouped by userId + eventId
  const allRecords = await prisma.attendanceRecord.findMany({
    orderBy: { createdAt: "asc" },
    include: { user: true, event: true }
  })

  // Group by unique key
  const groups = new Map<string, typeof allRecords>()
  for (const record of allRecords) {
    const key = `${record.userId}::${record.eventId}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(record)
  }

  let duplicatesRemoved = 0

  for (const [key, records] of groups) {
    if (records.length > 1) {
      console.log(`\n⚠️  Duplicate found: ${records[0].user.name} + ${records[0].event.name} (${records.length} records)`)
      
      // Keep the first record (or the one with PRESENT/LATE status, or the one with timeIn)
      const keeper = records.find(r => r.timeIn !== null) || records.find(r => r.status === "PRESENT" || r.status === "LATE") || records[0]
      
      console.log(`   ✅ Keeping: id=${keeper.id}, status=${keeper.status}, timeIn=${keeper.timeIn}`)
      
      // Delete the rest
      for (const record of records) {
        if (record.id !== keeper.id) {
          console.log(`   🗑️  Deleting: id=${record.id}, status=${record.status}, timeIn=${record.timeIn}`)
          await prisma.attendanceRecord.delete({ where: { id: record.id } })
          duplicatesRemoved++
        }
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total records: ${allRecords.length}`)
  console.log(`   Duplicates removed: ${duplicatesRemoved}`)
  console.log(`   Records remaining: ${allRecords.length - duplicatesRemoved}`)
  
  // Now also check for events that are CLOSED but don't have certificates generated
  console.log("\n🔍 Checking for closed events without certificates...")
  
  const closedEvents = await prisma.event.findMany({
    where: { status: "CLOSED" },
    include: {
      _count: {
        select: {
          attendanceRecords: true,
          certificates: true,
        }
      }
    }
  })

  for (const event of closedEvents) {
    const attendeesWithTimeIn = await prisma.attendanceRecord.count({
      where: {
        eventId: event.id,
        status: { in: ["PRESENT", "LATE", "APPROVED", "INSIDE"] },
        OR: [
          { timeIn: { not: null } },
          { afternoonTimeIn: { not: null } },
          { eveningTimeIn: { not: null } },
        ],
      }
    })

    console.log(`   Event "${event.name}": ${event._count.attendanceRecords} attendance, ${event._count.certificates} certs, ${attendeesWithTimeIn} eligible attendees`)

    if (attendeesWithTimeIn > 0 && event._count.certificates === 0) {
      console.log(`   ⚠️  Missing certificates! Generating now...`)
      
      const eligibleRecords = await prisma.attendanceRecord.findMany({
        where: {
          eventId: event.id,
          status: { in: ["PRESENT", "LATE", "APPROVED", "INSIDE"] },
          OR: [
            { timeIn: { not: null } },
            { afternoonTimeIn: { not: null } },
            { eveningTimeIn: { not: null } },
          ],
        }
      })

      for (const record of eligibleRecords) {
        try {
          await prisma.certificate.upsert({
            where: {
              userId_eventId: {
                userId: record.userId,
                eventId: record.eventId,
              }
            },
            update: {},
            create: {
              userId: record.userId,
              eventId: record.eventId,
              title: `Certificate of Attendance - ${event.name}`,
            }
          })
        } catch (err) {
          // Skip
        }
      }
      
      const newCertCount = await prisma.certificate.count({ where: { eventId: event.id } })
      console.log(`   ✅ Generated certificates! Now has ${newCertCount} certificates`)
    }
  }

  console.log("\n✅ Cleanup complete!")
}

cleanupDuplicates()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ Error:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
