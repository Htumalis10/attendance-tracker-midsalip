// Time utility functions for handling 12-hour (AM/PM) and 24-hour formats

/**
 * Convert 24-hour time string to 12-hour format with AM/PM
 * @param time24 - Time in "HH:mm" format (e.g., "14:30")
 * @returns Time in "hh:mm AM/PM" format (e.g., "02:30 PM")
 */
export function to12Hour(time24: string): string {
  if (!time24) return ""
  
  const [hours, minutes] = time24.split(":").map(Number)
  
  if (isNaN(hours) || isNaN(minutes)) return time24
  
  const period = hours >= 12 ? "PM" : "AM"
  const hours12 = hours % 12 || 12 // Convert 0 to 12
  
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`
}

/**
 * Convert 12-hour time string to 24-hour format
 * @param time12 - Time in "hh:mm AM/PM" format (e.g., "02:30 PM")
 * @returns Time in "HH:mm" format (e.g., "14:30")
 */
export function to24Hour(time12: string): string {
  if (!time12) return ""
  
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return time12
  
  let hours = parseInt(match[1], 10)
  const minutes = match[2]
  const period = match[3].toUpperCase()
  
  if (period === "PM" && hours !== 12) {
    hours += 12
  } else if (period === "AM" && hours === 12) {
    hours = 0
  }
  
  return `${hours.toString().padStart(2, "0")}:${minutes}`
}

/**
 * Parse time string (supports both 12-hour and 24-hour formats)
 * @param time - Time string in either format
 * @returns Object with hours (0-23) and minutes (0-59)
 */
export function parseTime(time: string): { hours: number; minutes: number } | null {
  if (!time) return null
  
  // Check if it's 12-hour format (contains AM/PM)
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    let hours = parseInt(match12[1], 10)
    const minutes = parseInt(match12[2], 10)
    const period = match12[3].toUpperCase()
    
    if (period === "PM" && hours !== 12) {
      hours += 12
    } else if (period === "AM" && hours === 12) {
      hours = 0
    }
    
    return { hours, minutes }
  }
  
  // Check if it's 24-hour format
  const match24 = time.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    return {
      hours: parseInt(match24[1], 10),
      minutes: parseInt(match24[2], 10)
    }
  }
  
  return null
}

/**
 * Format time for display (always shows 12-hour format)
 * @param time - Time in any supported format
 * @returns Formatted time string in 12-hour format
 */
export function formatTimeDisplay(time: string): string {
  const parsed = parseTime(time)
  if (!parsed) return time
  
  const period = parsed.hours >= 12 ? "PM" : "AM"
  const hours12 = parsed.hours % 12 || 12
  
  return `${hours12}:${parsed.minutes.toString().padStart(2, "0")} ${period}`
}

/**
 * Get time with buffer added
 * @param time - Time in "HH:mm" format
 * @param bufferMinutes - Minutes to add (default 60 = 1 hour)
 * @returns Time with buffer in "HH:mm" format
 */
export function addTimeBuffer(time: string, bufferMinutes: number = 60): string {
  const parsed = parseTime(time)
  if (!parsed) return time
  
  let totalMinutes = parsed.hours * 60 + parsed.minutes + bufferMinutes
  
  // Handle overflow past midnight
  if (totalMinutes >= 24 * 60) {
    totalMinutes = 24 * 60 - 1 // Cap at 23:59
  }
  
  const newHours = Math.floor(totalMinutes / 60)
  const newMinutes = totalMinutes % 60
  
  return `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`
}

/**
 * Check if current time is within the attendance window
 * @param timeIn - Event start time (HH:mm)
 * @param timeOut - Event end time (HH:mm)
 * @param gracePeriodMinutes - Grace period after event ends (default 60 minutes)
 * @returns Object with isWithinTimeIn, isWithinTimeOut, and isActive
 */
export function isWithinAttendanceWindow(
  timeIn: string, 
  timeOut: string, 
  gracePeriodMinutes: number = 60
): { isWithinTimeIn: boolean; isWithinTimeOut: boolean; isActive: boolean } {
  const now = new Date()
  const currentHours = now.getHours()
  const currentMinutes = now.getMinutes()
  const currentTotalMinutes = currentHours * 60 + currentMinutes
  
  const timeInParsed = parseTime(timeIn)
  const timeOutParsed = parseTime(timeOut)
  
  if (!timeInParsed || !timeOutParsed) {
    return { isWithinTimeIn: false, isWithinTimeOut: false, isActive: false }
  }
  
  const timeInMinutes = timeInParsed.hours * 60 + timeInParsed.minutes
  const timeOutMinutes = timeOutParsed.hours * 60 + timeOutParsed.minutes
  const timeOutWithGrace = timeOutMinutes + gracePeriodMinutes
  
  // Time-in is allowed from event start time until event end time
  const isWithinTimeIn = currentTotalMinutes >= timeInMinutes && currentTotalMinutes <= timeOutMinutes
  
  // Time-out is allowed from event start time until grace period after end
  const isWithinTimeOut = currentTotalMinutes >= timeInMinutes && currentTotalMinutes <= timeOutWithGrace
  
  // Event is active during the time window (including grace period)
  const isActive = currentTotalMinutes >= timeInMinutes && currentTotalMinutes <= timeOutWithGrace
  
  return { isWithinTimeIn, isWithinTimeOut, isActive }
}
