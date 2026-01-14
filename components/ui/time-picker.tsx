"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
  placeholder?: string
}

export function TimePicker({ value, onChange, className, placeholder = "Select time" }: TimePickerProps) {
  const [hours, setHours] = React.useState<string>("")
  const [minutes, setMinutes] = React.useState<string>("")

  // Parse initial value
  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":")
      setHours(h || "")
      setMinutes(m || "")
    }
  }, [value])

  // Update parent when hours or minutes change
  const handleHoursChange = (h: string) => {
    setHours(h)
    if (h && minutes) {
      onChange?.(`${h}:${minutes}`)
    } else if (h) {
      onChange?.(`${h}:00`)
      setMinutes("00")
    }
  }

  const handleMinutesChange = (m: string) => {
    setMinutes(m)
    if (hours && m) {
      onChange?.(`${hours}:${m}`)
    }
  }

  // Generate hour options (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
  
  // Generate minute options (00, 15, 30, 45 for simplicity, or 00-59)
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
      </div>
    </div>
  )
}

// Compact version for forms
export function TimePickerCompact({ value, onChange, className }: TimePickerProps) {
  const [hours, setHours] = React.useState<string>("")
  const [minutes, setMinutes] = React.useState<string>("")

  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":")
      setHours(h || "")
      setMinutes(m || "")
    }
  }, [value])

  const handleHoursChange = (h: string) => {
    setHours(h)
    const m = minutes || "00"
    onChange?.(`${h}:${m}`)
    if (!minutes) setMinutes("00")
  }

  const handleMinutesChange = (m: string) => {
    setMinutes(m)
    if (hours) {
      onChange?.(`${hours}:${m}`)
    }
  }

  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
  const minuteOptions = ["00", "15", "30", "45"]

  return (
    <div className={cn("flex items-center gap-1 border rounded-md px-3 py-2 bg-background", className)}>
      <Clock className="h-4 w-4 text-muted-foreground mr-2" />
      <Select value={hours} onValueChange={handleHoursChange}>
        <SelectTrigger className="w-[60px] border-0 shadow-none p-0 h-auto focus:ring-0">
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
        <SelectTrigger className="w-[60px] border-0 shadow-none p-0 h-auto focus:ring-0">
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
    </div>
  )
}
