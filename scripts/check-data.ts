import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkData() {
  // Check events
  const events = await prisma.event.findMany({
    include: {
      _count: {
        select: {
          attendanceRecords: true,
          certificates: true,
        }
      }
    }
  })

  console.log("📋 Events:")
  for (const event of events) {
    console.log(`   "${event.name}" | status: ${event.status} | date: ${event.date.toISOString().split('T')[0]} | att: ${event._count.attendanceRecords} | certs: ${event._count.certificates}`)
  }

  // Check attendance status breakdown per event
  console.log("\n📊 Attendance breakdown per event:")
  for (const event of events) {
    const statusCounts = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { eventId: event.id },
      _count: true,
    })
    console.log(`   "${event.name}":`)
    for (const sc of statusCounts) {
      console.log(`      ${sc.status}: ${sc._count}`)
    }
  }

  // Check total students
  const studentCount = await prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } })
  console.log(`\n👥 Active students: ${studentCount}`)

  // Check total records
  const totalRecords = await prisma.attendanceRecord.count()
  console.log(`📝 Total attendance records: ${totalRecords}`)

  // Check certificates
  const totalCerts = await prisma.certificate.count()
  console.log(`🏆 Total certificates: ${totalCerts}`)
}

checkData()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Error:", e)
    await prisma.$disconnect()
  })
