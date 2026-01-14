"use client"

import { useState, useEffect } from "react"
import { Download, ChevronDown, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface Certificate {
  id: string
  userId: string
  eventId: string
  issuedAt: string
  certificateUrl: string | null
  user: {
    name: string
    schoolId: string
  }
  event: {
    name: string
  }
}

interface Event {
  id: string
  name: string
}

export default function CertificateGenerator() {
  const [selectedEvent, setSelectedEvent] = useState("Select Event")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedCriteria, setSelectedCriteria] = useState("Time-In & Time-Out")
  const [isGenerating, setIsGenerating] = useState(false)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/events")
        if (response.ok) {
          const data = await response.json()
          setEvents(data)
        }
      } catch (err) {
        console.error("Failed to fetch events:", err)
      }
    }
    fetchEvents()
  }, [])

  // Fetch certificates
  useEffect(() => {
    const fetchCertificates = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedEventId) {
          params.set("eventId", selectedEventId)
        }
        const response = await fetch(`/api/certificates?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setCertificates(data)
        }
      } catch (err) {
        console.error("Failed to fetch certificates:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCertificates()
  }, [selectedEventId])

  const handleGenerateCertificates = async () => {
    if (!selectedEventId) {
      toast.warning("Please select an event first")
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          criteria: selectedCriteria
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate certificates")
      }

      const result = await response.json()
      toast.success(`Successfully generated ${result.count} certificates for ${selectedEvent}`)
      
      // Refresh certificates list
      const certResponse = await fetch(`/api/certificates?eventId=${selectedEventId}`)
      if (certResponse.ok) {
        const data = await certResponse.json()
        setCertificates(data)
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadCertificate = async (certificate: Certificate) => {
    try {
      // Generate PDF certificate
      const certificateContent = generateCertificatePDF(certificate)
      
      const blob = new Blob([certificateContent], { type: "text/html" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `certificate_${certificate.user.schoolId}_${certificate.event.name.replace(/\s+/g, "_")}.html`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success("Certificate downloaded successfully")
    } catch (err) {
      toast.error("Failed to download certificate")
    }
  }

  // Generate HTML certificate (can be printed as PDF)
  const generateCertificatePDF = (certificate: Certificate) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Certificate of Attendance</title>
  <style>
    @page { size: landscape; margin: 0; }
    body { 
      font-family: 'Times New Roman', serif; 
      text-align: center; 
      padding: 40px;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .certificate {
      background: white;
      border: 8px double #1a365d;
      padding: 60px 80px;
      max-width: 900px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header { font-size: 48px; color: #1a365d; margin-bottom: 20px; }
    .subheader { font-size: 24px; color: #4a5568; margin-bottom: 40px; }
    .name { font-size: 36px; color: #2d3748; font-weight: bold; margin: 30px 0; }
    .event { font-size: 24px; color: #4a5568; margin: 20px 0; }
    .date { font-size: 18px; color: #718096; margin-top: 40px; }
    .signature { margin-top: 60px; border-top: 2px solid #1a365d; display: inline-block; padding-top: 10px; min-width: 200px; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">Certificate of Attendance</div>
    <div class="subheader">This is to certify that</div>
    <div class="name">${certificate.user.name}</div>
    <div class="subheader">has successfully attended</div>
    <div class="event">${certificate.event.name}</div>
    <div class="date">Issued on: ${new Date(certificate.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div class="signature">Authorized Signature</div>
  </div>
</body>
</html>`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Certificate Generator</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Auto-generate and manage attendance certificates</p>
        </div>
      </div>

      {/* Generate Certificates Form */}
      <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
        <h2 className="font-semibold text-foreground mb-3 sm:mb-4">Generate Certificates for Event</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Select Event</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full px-3 sm:px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors text-sm">
                <span className="truncate">{selectedEvent}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                {events.map(event => (
                  <DropdownMenuItem 
                    key={event.id} 
                    onClick={() => { setSelectedEvent(event.name); setSelectedEventId(event.id); }}
                  >
                    {event.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Criteria</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full px-3 sm:px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors text-sm">
                <span className="truncate">{selectedCriteria}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem onClick={() => setSelectedCriteria("Time-In & Time-Out")}>
                  Time-In & Time-Out
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedCriteria("Time-In Only")}>Time-In Only</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedCriteria("All Attendees")}>All Attendees</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerateCertificates}
              disabled={isGenerating || !selectedEventId}
              className="w-full action-button btn-secondary disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate Now"}
            </button>
          </div>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading certificates...</span>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No certificates found. Select an event and generate certificates.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-muted">
                <th>Name</th>
                <th className="hidden sm:table-cell">School ID</th>
                <th className="hidden md:table-cell">Event</th>
                <th className="hidden sm:table-cell">Issued Date</th>
                <th className="hidden md:table-cell">Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => (
                <tr key={cert.id}>
                  <td className="font-medium text-foreground">
                    <div>{cert.user.name}</div>
                    <div className="sm:hidden text-xs text-muted-foreground">{cert.user.schoolId}</div>
                    <div className="md:hidden text-xs text-muted-foreground">{cert.event.name}</div>
                  </td>
                  <td className="font-mono text-sm text-primary hidden sm:table-cell">{cert.user.schoolId}</td>
                  <td className="text-muted-foreground text-sm hidden md:table-cell">{cert.event.name}</td>
                  <td className="text-sm hidden sm:table-cell">{formatDate(cert.issuedAt)}</td>
                  <td className="hidden md:table-cell">
                    <span className="badge-success">● Generated</span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDownloadCertificate(cert)}
                      className="action-button btn-ghost text-sm flex items-center gap-1 sm:gap-2 p-1 sm:p-2"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
