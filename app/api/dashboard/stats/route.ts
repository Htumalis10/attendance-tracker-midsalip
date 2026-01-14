import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET() {
  try {
    // Get user counts
    const totalUsers = await prisma.user.count()
    const activeStudents = await prisma.user.count({
      where: { role: "STUDENT", status: "ACTIVE" },
    })

    // Get event counts
    const activeEvents = await prisma.event.count({
      where: { status: "ACTIVE" },
    })
    const upcomingEvents = await prisma.event.count({
      where: { status: "UPCOMING" },
    })

    // Get today's attendance
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayAttendance = await prisma.attendanceRecord.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // Get total certificates
    const totalCertificates = await prisma.certificate.count()

    // Get weekly attendance data (last 7 days)
    const weeklyData = []
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      const count = await prisma.attendanceRecord.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate,
          },
        },
      })
      
      // Get expected attendance (total active students)
      const expectedCount = await prisma.event.count({
        where: {
          date: {
            gte: date,
            lt: nextDate,
          },
          status: { in: ["ACTIVE", "CLOSED"] },
        },
      })
      
      weeklyData.push({
        date: dayNames[date.getDay()],
        fullDate: date.toISOString().split('T')[0],
        attendance: count,
        expected: expectedCount > 0 ? activeStudents * expectedCount : 0,
      })
    }

    // Get monthly attendance data (last 6 months)
    const monthlyData = []
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      date.setDate(1)
      date.setHours(0, 0, 0, 0)
      
      const nextMonth = new Date(date)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      
      const attendanceCount = await prisma.attendanceRecord.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextMonth,
          },
          status: { in: ["PRESENT", "APPROVED", "INSIDE"] },
        },
      })
      
      const eventCount = await prisma.event.count({
        where: {
          date: {
            gte: date,
            lt: nextMonth,
          },
        },
      })
      
      monthlyData.push({
        month: monthNames[date.getMonth()],
        attended: attendanceCount,
        total: eventCount,
      })
    }

    // Get attendance by status for pie chart
    const attendanceByStatus = await prisma.attendanceRecord.groupBy({
      by: ["status"],
      _count: true,
    })

    // Recent events with attendance
    const recentEvents = await prisma.event.findMany({
      take: 5,
      orderBy: { date: "desc" },
      include: {
        _count: {
          select: { attendanceRecords: true },
        },
      },
    })

    // Calculate week-over-week change
    const lastWeekStart = new Date()
    lastWeekStart.setDate(lastWeekStart.getDate() - 14)
    lastWeekStart.setHours(0, 0, 0, 0)
    const lastWeekEnd = new Date()
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7)
    lastWeekEnd.setHours(0, 0, 0, 0)
    
    const thisWeekStart = new Date()
    thisWeekStart.setDate(thisWeekStart.getDate() - 7)
    thisWeekStart.setHours(0, 0, 0, 0)
    
    const lastWeekAttendance = await prisma.attendanceRecord.count({
      where: {
        createdAt: {
          gte: lastWeekStart,
          lt: lastWeekEnd,
        },
      },
    })
    
    const thisWeekAttendance = await prisma.attendanceRecord.count({
      where: {
        createdAt: {
          gte: thisWeekStart,
        },
      },
    })
    
    const weeklyChange = lastWeekAttendance > 0 
      ? Math.round(((thisWeekAttendance - lastWeekAttendance) / lastWeekAttendance) * 100)
      : thisWeekAttendance > 0 ? 100 : 0

    return NextResponse.json({
      stats: {
        totalUsers,
        activeStudents,
        activeEvents,
        upcomingEvents,
        todayAttendance,
        totalCertificates,
        weeklyChange,
      },
      weeklyData,
      monthlyData,
      attendanceByStatus: attendanceByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        name: event.name,
        date: event.date,
        attendees: event._count.attendanceRecords,
        status: event.status,
      })),
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 })
  }
}
