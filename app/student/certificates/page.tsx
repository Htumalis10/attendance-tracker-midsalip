"use client"

import { useState, useEffect, useCallback } from "react"
import { Download, Loader2, Award, RefreshCw } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { toast } from "sonner"

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

  // Poll for new certificates every 15 seconds (real-time feel)
  useEffect(() => {
    if (!userId) return
    
    const interval = setInterval(() => {
      fetchCertificates(false) // Silent refresh
    }, 15 * 1000)
    
    return () => clearInterval(interval)
  }, [userId, fetchCertificates])

  const handleDownloadCertificate = (certificate: Certificate) => {
    // Generate HTML certificate
    const htmlContent = `
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
    <div class="name">${userName || "Student"}</div>
    <div class="subheader">has successfully attended</div>
    <div class="event">${certificate.event.name}</div>
    <div class="date">Issued on: ${new Date(certificate.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div class="signature">Authorized Signature</div>
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading certificates...</span>
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
