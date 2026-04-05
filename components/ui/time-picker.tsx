"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value?: string // Stored as 24-hour format "HH:mm"
  onChange?: (value: string) => void
  className?: string
  placeholder?: string
  fixedPeriod?: "AM" | "PM" // Lock AM/PM (e.g., morning=AM, afternoon/evening=PM)
}

// Helper to convert 24-hour to 12-hour format
function to12HourParts(time24: string): { hours: string; minutes: string; period: "AM" | "PM" } {
  if (!time24) return { hours: "", minutes: "", period: "AM" }
  
  const [h, m] = time24.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return { hours: "", minutes: "", period: "AM" }
  
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM"
  const hours12 = h % 12 || 12
  
  return {
    hours: hours12.toString().padStart(2, "0"),
    minutes: m.toString().padStart(2, "0"),
    period
  }
}

// Helper to convert 12-hour to 24-hour format
function to24HourString(hours: string, minutes: string, period: "AM" | "PM"): string {
  if (!hours || !minutes) return ""
  
  let h = parseInt(hours, 10)
  if (period === "PM" && h !== 12) h += 12
  else if (period === "AM" && h === 12) h = 0
  
  return `${h.toString().padStart(2, "0")}:${minutes}`
}

export function TimePicker({ value, onChange, className, placeholder = "Select time", fixedPeriod }: TimePickerProps) {
  const [hours, setHours] = React.useState<string>("")
  const [minutes, setMinutes] = React.useState<string>("")
  const [period, setPeriod] = React.useState<"AM" | "PM">(fixedPeriod || "AM")

  // Parse initial value (24-hour format) to 12-hour display
  React.useEffect(() => {
    if (value) {
      const parts = to12HourParts(value)
      setHours(parts.hours)
      setMinutes(parts.minutes)
      setPeriod(fixedPeriod || parts.period)
    }
  }, [value, fixedPeriod])

  // If fixedPeriod changes, re-emit the correct 24h value
  React.useEffect(() => {
    if (fixedPeriod && hours && minutes && period !== fixedPeriod) {
      setPeriod(fixedPeriod)
      updateTime(hours, minutes, fixedPeriod)
    }
  }, [fixedPeriod])

  // Update parent when any part changes
  const updateTime = (h: string, m: string, p: "AM" | "PM") => {
    if (h && m) {
      const time24 = to24HourString(h, m, p)
      onChange?.(time24)
    }
  }

  const handleHoursChange = (h: string) => {
    setHours(h)
    const m = minutes || "00"
    if (!minutes) setMinutes("00")
    updateTime(h, m, period)
  }

  const handleMinutesChange = (m: string) => {
    setMinutes(m)
    if (hours) {
      updateTime(hours, m, period)
    }
  }

  const handlePeriodChange = (p: "AM" | "PM") => {
    setPeriod(p)
    if (hours && minutes) {
      updateTime(hours, minutes, p)
    }
  }

  // Generate hour options (01-12 for 12-hour format)
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"))
  
  // Generate minute options (00-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1">
        <Select value={hours} onValueChange={handleHoursChange}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {hourOptions.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground font-medium">:</span>
        <Select value={minutes} onValueChange={handleMinutesChange}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {minuteOptions.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fixedPeriod ? (
          <div className="w-[70px] h-9 px-3 flex items-center justify-center rounded-md border border-border bg-muted text-sm font-medium text-muted-foreground">
            {fixedPeriod}
          </div>
        ) : (
          <Select value={period} onValueChange={(v) => handlePeriodChange(v as "AM" | "PM")}>
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder="AM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

// Compact version for forms
export function TimePickerCompact({ value, onChange, className }: TimePickerProps) {
  const [hours, setHours] = React.useState<string>("")
  const [minutes, setMinutes] = React.useState<string>("")
  const [period, setPeriod] = React.useState<"AM" | "PM">("AM")

  React.useEffect(() => {
    if (value) {
      const parts = to12HourParts(value)
      setHours(parts.hours)
      setMinutes(parts.minutes)
      setPeriod(parts.period)
    }
  }, [value])

  const updateTime = (h: string, m: string, p: "AM" | "PM") => {
    if (h && m) {
      const time24 = to24HourString(h, m, p)
      onChange?.(time24)
    }
  }

  const handleHoursChange = (h: string) => {
    setHours(h)
    const m = minutes || "00"
    if (!minutes) setMinutes("00")
    updateTime(h, m, period)
  }

  const handleMinutesChange = (m: string) => {
    setMinutes(m)
    if (hours) {
      updateTime(hours, m, period)
    }
  }

  const handlePeriodChange = (p: "AM" | "PM") => {
    setPeriod(p)
    if (hours && minutes) {
      updateTime(hours, minutes, p)
    }
  }

  // 12-hour format options
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"))
  const minuteOptions = ["00", "15", "30", "45"]

  return (
    <div className={cn("flex items-center gap-1 border rounded-md px-3 py-2 bg-background", className)}>
      <Clock className="h-4 w-4 text-muted-foreground mr-2" />
      <Select value={hours} onValueChange={handleHoursChange}>
        <SelectTrigger className="w-[50px] border-0 shadow-none p-0 h-auto focus:ring-0">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {hourOptions.map((hour) => (
            <SelectItem key={hour} value={hour}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={minutes} onValueChange={handleMinutesChange}>
        <SelectTrigger className="w-[50px] border-0 shadow-none p-0 h-auto focus:ring-0">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {minuteOptions.map((minute) => (
            <SelectItem key={minute} value={minute}>
              {minute}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={period} onValueChange={(v) => handlePeriodChange(v as "AM" | "PM")}>
        <SelectTrigger className="w-[55px] border-0 shadow-none p-0 h-auto focus:ring-0">
          <SelectValue placeholder="AM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
