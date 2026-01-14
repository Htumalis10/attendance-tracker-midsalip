"use client"

import { useState, useEffect } from "react"
import { Plus, Clock, MapPin, Users, Edit, Trash2, Loader2, CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/ui/time-picker"
import { format } from "date-fns"

interface Event {
  id: string
  name: string
  description?: string
  date: string
  venue: string
  organizer: string
  timeIn: string
  timeOut: string
  status: string
  _count?: {
    attendanceRecords: number
    certificates: number
  }
}

export default function EventManagement() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Form state for new event
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    date: undefined as Date | undefined,
    venue: "",
    organizer: "",
    timeIn: "",
    timeOut: "",
    status: "UPCOMING",
  })
  
  // Form state for editing event
  const [editEventDate, setEditEventDate] = useState<Date | undefined>(undefined)

  // Fetch events from API
  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/events")
      if (!response.ok) throw new Error("Failed to fetch events")
      const data = await response.json()
      setEvents(data)
    } catch (err) {
      setError("Failed to load events")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleManageEvent = (event: Event) => {
    setSelectedEvent(event)
    setShowEditModal(true)
  }

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return

    try {
      const response = await fetch(`/api/events/${eventToDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete event")
      toast.success(`Event "${eventToDelete.name}" deleted successfully`)
      setShowDeleteDialog(false)
      setEventToDelete(null)
      fetchEvents()
    } catch (err) {
      toast.error("Failed to delete event")
    }
  }

  const confirmDeleteEvent = (event: Event) => {
    setEventToDelete(event)
    setShowDeleteDialog(true)
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const eventData = {
        ...newEvent,
        date: newEvent.date ? format(newEvent.date, "yyyy-MM-dd") : "",
      }
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) throw new Error("Failed to create event")

      setShowAddModal(false)
      setNewEvent({
        name: "",
        description: "",
        date: undefined,
        venue: "",
        organizer: "",
        timeIn: "",
        timeOut: "",
        status: "UPCOMING",
      })
      toast.success("Event created successfully")
      fetchEvents()
    } catch (err) {
      toast.error("Failed to create event")
    }
  }

  const handleSaveEvent = async (formData: any) => {
    if (!selectedEvent) return

    try {
      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error("Failed to update event")

      setShowEditModal(false)
      setSelectedEvent(null)
      toast.success("Event updated successfully")
      fetchEvents()
    } catch (err) {
      toast.error("Failed to update event")
    }
  }

  // Format status for display
  const formatStatus = (status: string) => {
    return status.charAt(0) + status.slice(1).toLowerCase()
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Event Management</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Create and manage events, assign scanners, and control attendance periods
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="action-button btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading events...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No events found. Create your first event!</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-card rounded-lg border border-border p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-foreground text-lg flex-1">{event.name}</h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  event.status === "ACTIVE"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : event.status === "UPCOMING"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                }`}
              >
                {formatStatus(event.status)}
              </span>
            </div>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{event.venue}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{event._count?.attendanceRecords || 0} attendees</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <div className="bg-muted p-2 rounded">
                <p className="text-muted-foreground text-xs">Time-In</p>
                <p className="font-semibold text-foreground">{event.timeIn}</p>
              </div>
              <div className="bg-muted p-2 rounded">
                <p className="text-muted-foreground text-xs">Time-Out</p>
                <p className="font-semibold text-foreground">{event.timeOut}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleManageEvent(event)}
                className="flex-1 action-button btn-secondary text-sm flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Manage Event
              </button>
              <button
                onClick={() => confirmDeleteEvent(event)}
                className="action-button btn-ghost text-sm p-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground mb-4">Create New Event</h2>
            <form
              onSubmit={handleCreateEvent}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Event Name</label>
                <input
                  type="text"
                  placeholder="Enter event name"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Organizer</label>
                <input
                  type="text"
                  placeholder="Enter organizer"
                  value={newEvent.organizer}
                  onChange={(e) => setNewEvent({ ...newEvent, organizer: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newEvent.date ? format(newEvent.date, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newEvent.date}
                        onSelect={(date) => setNewEvent({ ...newEvent, date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Venue</label>
                  <input
                    type="text"
                    placeholder="Enter venue"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Time-In</label>
                  <TimePicker
                    value={newEvent.timeIn}
                    onChange={(value) => setNewEvent({ ...newEvent, timeIn: value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Time-Out</label>
                  <TimePicker
                    value={newEvent.timeOut}
                    onChange={(value) => setNewEvent({ ...newEvent, timeOut: value })}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 action-button btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="flex-1 action-button btn-primary">
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && selectedEvent && (
        <EditEventModal 
          event={selectedEvent}
          editEventDate={editEventDate}
          setEditEventDate={setEditEventDate}
          onSave={handleSaveEvent}
          onClose={() => {
            setShowEditModal(false)
            setSelectedEvent(null)
            setEditEventDate(undefined)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{eventToDelete?.name}</span>? 
              This action cannot be undone and will remove all associated attendance records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEventToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Edit Event Modal Component
function EditEventModal({ 
  event, 
  editEventDate,
  setEditEventDate,
  onSave, 
  onClose 
}: { 
  event: Event
  editEventDate: Date | undefined
  setEditEventDate: (date: Date | undefined) => void
  onSave: (data: any) => void
  onClose: () => void 
}) {
  const [formData, setFormData] = useState({
    name: event.name,
    venue: event.venue,
    timeIn: event.timeIn,
    timeOut: event.timeOut,
  })
  
  // Initialize date from event
  useEffect(() => {
    if (event.date) {
      setEditEventDate(new Date(event.date))
    }
  }, [event.date, setEditEventDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      date: editEventDate ? format(editEventDate, "yyyy-MM-dd") : event.date,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-card rounded-t-lg sm:rounded-lg p-4 sm:p-6 w-full sm:max-w-lg border border-border max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4">Edit Event</h2>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Event Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editEventDate ? format(editEventDate, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editEventDate}
                    onSelect={setEditEventDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Venue</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Time-In</label>
              <TimePicker
                value={formData.timeIn}
                onChange={(value) => setFormData({ ...formData, timeIn: value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Time-Out</label>
              <TimePicker
                value={formData.timeOut}
                onChange={(value) => setFormData({ ...formData, timeOut: value })}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 action-button btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 action-button btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
