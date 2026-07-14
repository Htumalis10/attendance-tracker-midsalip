import { PrismaClient, Role, Status, DeviceStatus } from "@prisma/client"
import * as XLSX from "xlsx"
import * as path from "path"

const prisma = new PrismaClient()

// Map year numbers to readable strings
function formatYear(year: number | string): string {
  const yearNum = typeof year === "string" ? parseInt(year) : year
  switch (yearNum) {
    case 1: return "1st Year"
    case 2: return "2nd Year"
    case 3: return "3rd Year"
    case 4: return "4th Year"
    default: return `${year}th Year`
  }
}

// Build full name from parts
function buildFullName(firstName: string, lastName: string, middleName?: string, suffixName?: string): string {
  let name = `${firstName} ${lastName}`
  if (middleName) {
    name = `${firstName} ${middleName.charAt(0)}. ${lastName}`
  }
  if (suffixName) {
    name += ` ${suffixName}`
  }
  return name
}

// Generate email from name and student number
function generateEmail(firstName: string, lastName: string, studentNumber: string): string {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "").substring(0, 15)
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "").substring(0, 15)
  return `${cleanFirst}.${cleanLast}.${studentNumber.toLowerCase()}@student.zdspgc.edu.ph`
}

async function main() {
  console.log("🌱 Starting database seed from EXCEL MIDSALIP.xlsx...")

  // Clear existing data (in correct order for relations)
  console.log("🗑️  Clearing existing data...")
  await prisma.notification.deleteMany()
  await prisma.certificate.deleteMany()
  await prisma.attendanceRecord.deleteMany()
  await prisma.event.deleteMany()
  await prisma.scannerDevice.deleteMany()
  await prisma.user.deleteMany()
  console.log("✅ Cleared existing data")

  // ========================================
  // 1. Create Admin Users
  // ========================================
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

  // ========================================
  // 2. Create SG Officer Users
  // ========================================
  const sgOfficers = await Promise.all([
    prisma.user.create({
      data: {
        schoolId: "SGO00001",
        name: "SG Officer 1",
        email: "sgofficer1@zdspgc.edu.ph",
        role: Role.SG_OFFICER,
        status: Status.ACTIVE,
      },
    }),
  ])
  console.log(`✅ Created ${sgOfficers.length} SG Officer users`)

  // ========================================
  // 3. Import Students from Excel
  // ========================================
  const excelPath = path.join(process.cwd(), "EXCEL MIDSALIP.xlsx")
  const workbook = XLSX.readFile(excelPath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawData = XLSX.utils.sheet_to_json(sheet)

  // Filter out header rows that got mixed into the data
  const studentRows = rawData.filter((row: any) => {
    // Skip rows where "Student Number" is literally "Student Number" (repeated headers)
    if (row["Student Number"] === "Student Number") return false
    // Skip rows without a student number
    if (!row["Student Number"]) return false
    // Skip rows where Year is not a number
    if (typeof row["Year"] !== "number") return false
    return true
  })

  console.log(`📊 Found ${studentRows.length} students in Excel file`)

  // Track unique student numbers to avoid duplicates
  const seenStudentNumbers = new Set<string>()
  const seenEmails = new Set<string>()
  let importedCount = 0
  let skippedCount = 0

  for (const row of studentRows as any[]) {
    const studentNumber = String(row["Student Number"]).trim().toUpperCase()
    const lastName = String(row["Last Name"] || "").trim()
    const firstName = String(row["First Name"] || "").trim()
    const middleName = row["Middle Name"] ? String(row["Middle Name"]).trim() : undefined
    const suffixName = row["Suffix Name"] ? String(row["Suffix Name"]).trim() : undefined
    const sex = String(row["Sex"] || "").trim()
    const year = row["Year"]
    const program = String(row["Program"] || "").trim()

    // Skip if already seen (duplicate student number)
    if (seenStudentNumbers.has(studentNumber)) {
      skippedCount++
      continue
    }
    seenStudentNumbers.add(studentNumber)

    // Build name and email
    const fullName = buildFullName(firstName, lastName, middleName, suffixName)
    let email = generateEmail(firstName, lastName, studentNumber)

    // Ensure unique email
    if (seenEmails.has(email)) {
      email = `${studentNumber.toLowerCase()}@student.zdspgc.edu.ph`
    }
    seenEmails.add(email)

    try {
      await prisma.user.create({
        data: {
          schoolId: studentNumber,
          name: fullName,
          email: email,
          course: program,
          year: formatYear(year),
          role: Role.STUDENT,
          status: Status.ACTIVE,
        },
      })
      importedCount++
    } catch (err: any) {
      console.error(`  ⚠️  Failed to import ${studentNumber} (${fullName}): ${err.message}`)
      skippedCount++
    }
  }

  console.log(`✅ Imported ${importedCount} students from Excel (${skippedCount} skipped)`)

  // ========================================
  // 4. Create Scanner Devices
  // ========================================
  const scanners = await Promise.all([
    prisma.scannerDevice.create({
      data: {
        deviceId: "SCAN-01",
        name: "Scanner Device 01",
        location: "Main Entrance",
        status: DeviceStatus.OFFLINE,
        offlineRecords: 0,
      },
    }),
  ])
  console.log(`✅ Created ${scanners.length} scanner device(s)`)

  // ========================================
  // Summary
  // ========================================
  const totalUsers = await prisma.user.count()
  const totalStudents = await prisma.user.count({ where: { role: "STUDENT" } })

  console.log("\n🎉 Database seed completed successfully!")
  console.log("\n📋 Summary:")
  console.log(`   - ${admins.length} admin users`)
  console.log(`   - ${sgOfficers.length} SG Officer users`)
  console.log(`   - ${totalStudents} student users (from Excel)`)
  console.log(`   - ${scanners.length} scanner device(s)`)
  console.log(`   - ${totalUsers} total users`)
  console.log(`   - 0 events (create them from the admin dashboard)`)
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
