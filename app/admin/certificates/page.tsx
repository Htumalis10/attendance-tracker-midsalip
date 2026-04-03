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
    course: string | null
  }
  event: {
    name: string
  }
}

interface Event {
  id: string
  name: string
  status: string
}

export default function CertificateGenerator() {
  const [selectedEvent, setSelectedEvent] = useState("All Events")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
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
  <title>Certificate of Attendance - ${certificate.user.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Cormorant+Garamond:wght@400;500;600&family=Great+Vibes&display=swap" rel="stylesheet">
  <style>
    @page { size: landscape; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Cormorant Garamond', 'Times New Roman', serif; 
      text-align: center; 
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .certificate-wrapper {
      background: linear-gradient(145deg, #1a365d 0%, #2c5282 50%, #1a365d 100%);
      padding: 12px;
      border-radius: 8px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.4);
    }
    .certificate {
      background: linear-gradient(180deg, #fffef9 0%, #faf8f0 100%);
      border: 3px solid #c9a227;
      padding: 40px 60px;
      width: 950px;
      min-height: 650px;
      position: relative;
      overflow: hidden;
    }
    .certificate::before {
      content: '';
      position: absolute;
      top: 15px;
      left: 15px;
      right: 15px;
      bottom: 15px;
      border: 2px solid #c9a227;
      pointer-events: none;
    }
    .corner-ornament {
      position: absolute;
      width: 80px;
      height: 80px;
      opacity: 0.15;
    }
    .corner-ornament.top-left { top: 20px; left: 20px; }
    .corner-ornament.top-right { top: 20px; right: 20px; transform: rotate(90deg); }
    .corner-ornament.bottom-left { bottom: 20px; left: 20px; transform: rotate(-90deg); }
    .corner-ornament.bottom-right { bottom: 20px; right: 20px; transform: rotate(180deg); }
    .logo-container {
      margin-bottom: 15px;
    }
    .logo {
      width: 90px;
      height: 90px;
      object-fit: contain;
      border-radius: 50%;
      border: 3px solid #c9a227;
      padding: 5px;
      background: white;
    }
    .school-name {
      font-family: 'Playfair Display', serif;
      font-size: 16px;
      color: #1a365d;
      font-weight: 600;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .header {
      font-family: 'Great Vibes', cursive;
      font-size: 58px;
      color: #1a365d;
      margin: 15px 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }
    .divider {
      width: 300px;
      height: 3px;
      background: linear-gradient(90deg, transparent, #c9a227, transparent);
      margin: 15px auto;
    }
    .certify-text {
      font-size: 18px;
      color: #4a5568;
      font-style: italic;
      margin: 20px 0 10px;
    }
    .name {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      color: #1a365d;
      font-weight: 700;
      margin: 15px 0;
      text-transform: uppercase;
      letter-spacing: 4px;
      border-bottom: 3px double #c9a227;
      display: inline-block;
      padding-bottom: 8px;
    }
    .attended-text {
      font-size: 18px;
      color: #4a5568;
      margin: 20px 0 10px;
    }
    .event {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      color: #2c5282;
      font-weight: 600;
      margin: 10px 0;
      font-style: italic;
    }
    .date {
      font-size: 16px;
      color: #718096;
      margin-top: 25px;
    }
    .footer {
      display: flex;
      justify-content: space-around;
      margin-top: 35px;
      padding-top: 20px;
    }
    .signature-block {
      text-align: center;
      min-width: 200px;
    }
    .signature-line {
      width: 180px;
      border-top: 2px solid #1a365d;
      margin: 0 auto 8px;
    }
    .signature-label {
      font-size: 14px;
      color: #4a5568;
      font-weight: 500;
    }
    .certificate-id {
      position: absolute;
      bottom: 25px;
      right: 30px;
      font-size: 10px;
      color: #a0aec0;
      font-family: monospace;
    }
    .seal {
      position: absolute;
      bottom: 80px;
      right: 60px;
      width: 80px;
      height: 80px;
      border: 3px solid #c9a227;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #fff 0%, #f0f0f0 100%);
    }
    .seal-inner {
      width: 60px;
      height: 60px;
      border: 2px solid #c9a227;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Playfair Display', serif;
      font-size: 10px;
      color: #1a365d;
      text-transform: uppercase;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="certificate-wrapper">
    <div class="certificate">
      <svg class="corner-ornament top-left" viewBox="0 0 100 100"><path d="M0,0 L100,0 L100,20 L20,20 L20,100 L0,100 Z" fill="#c9a227"/></svg>
      <svg class="corner-ornament top-right" viewBox="0 0 100 100"><path d="M0,0 L100,0 L100,20 L20,20 L20,100 L0,100 Z" fill="#c9a227"/></svg>
      <svg class="corner-ornament bottom-left" viewBox="0 0 100 100"><path d="M0,0 L100,0 L100,20 L20,20 L20,100 L0,100 Z" fill="#c9a227"/></svg>
      <svg class="corner-ornament bottom-right" viewBox="0 0 100 100"><path d="M0,0 L100,0 L100,20 L20,20 L20,100 L0,100 Z" fill="#c9a227"/></svg>
      
      <div class="logo-container">
        <img src="${window.location.origin}/ZDSPGC%20LOGO.jpg" alt="School Logo" class="logo" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MCIgaGVpZ2h0PSI5MCIgdmlld0JveD0iMCAwIDkwIDkwIj48Y2lyY2xlIGN4PSI0NSIgY3k9IjQ1IiByPSI0MCIgZmlsbD0iIzFhMzY1ZCIvPjx0ZXh0IHg9IjQ1IiB5PSI1NSIgZm9udC1mYW1pbHk9IlBsYXlmYWlyIERpc3BsYXkiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlosRC5TLlAuRy5DPC90ZXh0Pjwvc3ZnPg==';">
        <div class="school-name">Zamboanga del Sur Provincial Government College</div>
      </div>
      
      <div class="header">Certificate of Attendance</div>
      <div class="divider"></div>
      
      <p class="certify-text">This is to certify that</p>
      <div class="name">${certificate.user.name}</div>
      <p class="attended-text">has successfully attended the event</p>
      <div class="event">"${certificate.event.name}"</div>
      
      <p class="date">Issued on ${new Date(certificate.issuedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      
      <div class="footer">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-label">Event Coordinator</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-label">School Coordinator<br/><span style="font-size:11px;color:#718096;">${certificate.user.course || 'Department'}</span></div>
        </div>
      </div>
      
      <div class="seal">
        <div class="seal-inner">Official Seal</div>
      </div>
      
      <div class="certificate-id">Certificate ID: ${certificate.id.slice(0, 8).toUpperCase()}</div>
    </div>
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
          <h1 className="page-title">Certificates</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Certificates are auto-generated when events are completed</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
        <h2 className="font-semibold text-foreground mb-3 sm:mb-4">Filter Certificates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Event</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full px-3 sm:px-4 py-2 rounded-lg bg-background border border-border text-foreground text-left flex items-center justify-between hover:bg-muted transition-colors text-sm">
                <span className="truncate">{selectedEvent}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem onClick={() => { setSelectedEvent("All Events"); setSelectedEventId(null); }}>
                  All Events
                </DropdownMenuItem>
                {events.filter(e => e.status === "CLOSED").length === 0 ? (
                  <DropdownMenuItem disabled>
                    No completed events available
                  </DropdownMenuItem>
                ) : (
                  events.filter(e => e.status === "CLOSED").map(event => (
                    <DropdownMenuItem 
                      key={event.id} 
                      onClick={() => { setSelectedEvent(event.name); setSelectedEventId(event.id); }}
                    >
                      {event.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="text-xs text-muted-foreground mt-1">Filter by completed event or view all</p>
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
            No certificates yet. Certificates are automatically generated when events are completed.
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
