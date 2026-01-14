import { PrismaClient, Role, Status, EventStatus, DeviceStatus } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting database seed...")

  // Clear existing data
  await prisma.certificate.deleteMany()
  await prisma.attendanceRecord.deleteMany()
  await prisma.event.deleteMany()
  await prisma.user.deleteMany()
  await prisma.scannerDevice.deleteMany()

  console.log("✅ Cleared existing data")

  // Create Admin Users
  const admins = await Promise.all([
    prisma.user.create({
      data: {
        schoolId: "ADMIN123",
        name: "Administrator",
        email: "admin@zdspgc.edu.ph",
        role: Role.ADMIN,
        status: Status.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: "ADMIN002",
        name: "Admin User",
        email: "admin2@zdspgc.edu.ph",
        role: Role.ADMIN,
        status: Status.ACTIVE,
      },
    }),
  ])

  console.log(`✅ Created ${admins.length} admin users`)

  // Create Student Users
  const students = await Promise.all([
    prisma.user.create({
      data: {
        schoolId: "20240001",
        name: "Maria Santos",
        email: "maria.santos@student.zdspgc.edu.ph",
        phone: "+63 912 345 6789",
        course: "BS Information Technology",
        year: "3rd Year",
        role: Role.STUDENT,
        status: Status.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: "20240002",
        name: "Juan dela Cruz",
        email: "juan.delacruz@student.zdspgc.edu.ph",
        phone: "+63 923 456 7890",
        course: "BS Computer Science",
        year: "2nd Year",
        role: Role.STUDENT,
        status: Status.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: "20240003",
        name: "Angela Reyes",
        email: "angela.reyes@student.zdspgc.edu.ph",
        phone: "+63 934 567 8901",
        course: "BS Information Technology",
        year: "4th Year",
        role: Role.STUDENT,
        status: Status.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: "20240004",
        name: "Carlos Santos",
        email: "carlos.santos@student.zdspgc.edu.ph",
        phone: "+63 945 678 9012",
        course: "BS Computer Science",
        year: "1st Year",
        role: Role.STUDENT,
        status: Status.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: "20240005",
        name: "Lisa Wong",
        email: "lisa.wong@student.zdspgc.edu.ph",
        phone: "+63 956 789 0123",
        course: "BS Nursing",
        year: "3rd Year",
        role: Role.STUDENT,
        status: Status.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: "20240006",
        name: "Mark Johnson",
        email: "mark.johnson@student.zdspgc.edu.ph",
        phone: "+63 967 890 1234",
        course: "BS Business Administration",
        year: "2nd Year",
        role: Role.STUDENT,
        status: Status.INACTIVE,
      },
    }),
  ])

  console.log(`✅ Created ${students.length} student users`)

  // Create Faculty Users
  const faculty = await Promise.all([
    prisma.user.create({
      data: {
        schoolId: "FAC001",
        name: "Dr. Robert Tan",
        email: "robert.tan@zdspgc.edu.ph",
        course: "Department of Engineering",
        year: "Faculty",
        role: Role.FACULTY,
        status: Status.ACTIVE,
      },
    }),
  ])

  console.log(`✅ Created ${faculty.length} faculty users`)

  // Create Staff Users
  const staff = await prisma.user.create({
    data: {
      schoolId: "STAFF001",
      name: "Ana Martinez",
      email: "ana.martinez@zdspgc.edu.ph",
      course: "Registrar Office",
      year: "Staff",
      role: Role.STAFF,
      status: Status.ACTIVE,
    },
  })

  console.log("✅ Created 1 staff user")

  // Create Events
  const events = await Promise.all([
    prisma.event.create({
      data: {
        name: "Programming Seminar 2024",
        description: "An in-depth seminar on modern programming practices and technologies.",
        date: new Date("2024-01-20"),
        venue: "Auditorium A",
        organizer: "IT Department",
        timeIn: "08:00",
        timeOut: "12:00",
        status: EventStatus.ACTIVE,
      },
    }),
    prisma.event.create({
      data: {
        name: "Leadership Workshop",
        description: "Workshop on developing leadership skills for student leaders.",
        date: new Date("2024-01-22"),
        venue: "Conference Room 1",
        organizer: "Student Affairs",
        timeIn: "14:00",
        timeOut: "17:00",
        status: EventStatus.ACTIVE,
      },
    }),
    prisma.event.create({
      data: {
        name: "Health & Wellness Fair",
        description: "Annual health fair with free checkups and wellness activities.",
        date: new Date("2024-01-25"),
        venue: "Campus Grounds",
        organizer: "Health Services",
        timeIn: "09:00",
        timeOut: "15:00",
        status: EventStatus.UPCOMING,
      },
    }),
    prisma.event.create({
      data: {
        name: "Annual Faculty Meeting",
        description: "Yearly meeting for all faculty members.",
        date: new Date("2024-01-18"),
        venue: "Board Room",
        organizer: "Administration",
        timeIn: "10:00",
        timeOut: "12:00",
        status: EventStatus.CLOSED,
      },
    }),
    prisma.event.create({
      data: {
        name: "Career Fair 2024",
        description: "Annual career fair with top companies and recruitment opportunities.",
        date: new Date("2024-02-15"),
        venue: "Main Gymnasium",
        organizer: "Career Services",
        timeIn: "09:00",
        timeOut: "16:00",
        status: EventStatus.UPCOMING,
      },
    }),
  ])

  console.log(`✅ Created ${events.length} events`)

  // Create Attendance Records
  const attendanceRecords = await Promise.all([
    // Programming Seminar attendance
    prisma.attendanceRecord.create({
      data: {
        userId: students[0].id,
        eventId: events[0].id,
        timeIn: new Date("2024-01-20T08:05:00"),
        timeOut: new Date("2024-01-20T11:55:00"),
        status: "PRESENT",
        lateMinutes: 5,
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        userId: students[1].id,
        eventId: events[0].id,
        timeIn: new Date("2024-01-20T08:32:00"),
        status: "INSIDE",
        lateMinutes: 32,
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        userId: students[2].id,
        eventId: events[0].id,
        timeIn: new Date("2024-01-20T07:55:00"),
        timeOut: new Date("2024-01-20T12:05:00"),
        status: "PRESENT",
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        userId: students[3].id,
        eventId: events[0].id,
        status: "ABSENT",
      },
    }),
    // Leadership Workshop attendance
    prisma.attendanceRecord.create({
      data: {
        userId: students[4].id,
        eventId: events[1].id,
        timeIn: new Date("2024-01-22T14:02:00"),
        timeOut: new Date("2024-01-22T17:00:00"),
        status: "PRESENT",
        lateMinutes: 2,
      },
    }),
    prisma.attendanceRecord.create({
      data: {
        userId: students[5].id,
        eventId: events[1].id,
        timeIn: new Date("2024-01-22T14:15:00"),
        timeOut: new Date("2024-01-22T16:45:00"),
        status: "PRESENT",
        lateMinutes: 15,
      },
    }),
  ])

  console.log(`✅ Created ${attendanceRecords.length} attendance records`)

  // Create Certificates
  const certificates = await Promise.all([
    prisma.certificate.create({
      data: {
        userId: students[0].id,
        eventId: events[0].id,
        title: "Certificate of Participation - Programming Seminar 2024",
        downloaded: true,
      },
    }),
    prisma.certificate.create({
      data: {
        userId: students[2].id,
        eventId: events[0].id,
        title: "Certificate of Participation - Programming Seminar 2024",
        downloaded: false,
      },
    }),
    prisma.certificate.create({
      data: {
        userId: students[0].id,
        eventId: events[3].id,
        title: "Certificate of Attendance - Annual Faculty Meeting",
        downloaded: true,
      },
    }),
  ])

  console.log(`✅ Created ${certificates.length} certificates`)

  // Create Scanner Devices
  const scanners = await Promise.all([
    prisma.scannerDevice.create({
      data: {
        deviceId: "SCAN-01",
        name: "Scanner Device 01",
        location: "Auditorium A",
        status: DeviceStatus.ONLINE,
        lastSync: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        offlineRecords: 0,
      },
    }),
    prisma.scannerDevice.create({
      data: {
        deviceId: "SCAN-02",
        name: "Scanner Device 02",
        location: "Auditorium B",
        status: DeviceStatus.ONLINE,
        lastSync: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        offlineRecords: 0,
      },
    }),
    prisma.scannerDevice.create({
      data: {
        deviceId: "SCAN-03",
        name: "Scanner Device 03",
        location: "Conference Room 1",
        status: DeviceStatus.OFFLINE,
        lastSync: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        offlineRecords: 23,
      },
    }),
    prisma.scannerDevice.create({
      data: {
        deviceId: "SCAN-04",
        name: "Scanner Device 04",
        location: "Campus Grounds",
        status: DeviceStatus.ONLINE,
        lastSync: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
        offlineRecords: 0,
      },
    }),
  ])

  console.log(`✅ Created ${scanners.length} scanner devices`)

  console.log("\n🎉 Database seed completed successfully!")
  console.log("\n📋 Summary:")
  console.log(`   - ${admins.length} admin users`)
  console.log(`   - ${students.length} student users`)
  console.log(`   - ${faculty.length} faculty users`)
  console.log(`   - 1 staff user`)
  console.log(`   - ${events.length} events`)
  console.log(`   - ${attendanceRecords.length} attendance records`)
  console.log(`   - ${certificates.length} certificates`)
  console.log(`   - ${scanners.length} scanner devices`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ Error seeding database:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
