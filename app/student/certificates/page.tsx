"use client"

import { useState, useEffect, useCallback } from "react"
import { Download, Loader2, Award, RefreshCw } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface Certificate {
  id: string
  userId: string
  eventId: string
  issuedAt: string
  certificateUrl: string | null
  event: {
    name: string
    date: string
  }
}

export default function StudentCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [userName, setUserName] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [lastCount, setLastCount] = useState(0)

  const fetchCertificates = useCallback(async (showLoading = true) => {
    if (!userId) return
    
    if (showLoading) {
      setIsRefreshing(true)
    }
    
    try {
      const response = await fetch(`/api/certificates?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        
        // Check if new certificates were added
        if (data.length > lastCount && lastCount > 0) {
          const newCount = data.length - lastCount
          toast.success(`🎉 ${newCount} new certificate${newCount > 1 ? 's' : ''} available!`)
        }
        
        setCertificates(data)
        setLastCount(data.length)
      }
    } catch (err) {
      console.error("Failed to fetch certificates:", err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [userId, lastCount])

  // Initial load
  useEffect(() => {
    const user = getCurrentUser()
    if (user) {
      setUserName(user.name)
      setUserId(user.id)
    } else {
      setIsLoading(false)
    }
  }, [])

  // Fetch certificates when userId is set
  useEffect(() => {
    if (userId) {
      fetchCertificates()
    }
  }, [userId, fetchCertificates])

  // Poll for new certificates every 10 seconds (real-time feel)
  useEffect(() => {
    if (!userId) return
    
    const interval = setInterval(() => {
      fetchCertificates(false) // Silent refresh
    }, 10 * 1000) // Check every 10 seconds for new certificates
    
    return () => clearInterval(interval)
  }, [userId, fetchCertificates])

  const handleDownloadCertificate = (certificate: Certificate) => {
    // Generate HTML certificate with enhanced design
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Certificate of Attendance - ${userName || "Student"}</title>
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
      <div class="name">${userName || "Student"}</div>
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
          <div class="signature-label">School Administrator</div>
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

    const blob = new Blob([htmlContent], { type: "text/html" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `certificate_${certificate.event.name.replace(/\s+/g, "_")}.html`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">My Certificates</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">Download your attendance certificates</p>
        </div>
        <button
          onClick={() => fetchCertificates()}
          disabled={isRefreshing}
          className="action-button btn-secondary flex items-center gap-2 text-sm w-fit"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Certificates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-10 sm:py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">No certificates available yet.</p>
          <p className="text-sm text-muted-foreground mt-2">Attend events to receive certificates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-card rounded-lg border border-border p-4 sm:p-6 hover:border-primary/50 transition-colors"
            >
              <div className="mb-3 sm:mb-4">
                <h3 className="font-semibold text-foreground text-base sm:text-lg mb-2 line-clamp-2">{cert.event.name}</h3>
                <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                  <p>Event Date: {formatDate(cert.event.date)}</p>
                  <p>Issued: {formatDate(cert.issuedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <span className="badge-success text-xs">● Available</span>
              </div>
              <button 
                onClick={() => handleDownloadCertificate(cert)}
                className="w-full action-button btn-primary flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
