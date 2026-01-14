"use client"

import { Download, Loader2, User, Mail, Phone, BookOpen, GraduationCap, Building } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { getCurrentUser } from "@/lib/auth"
import { QRCodeSVG } from "qrcode.react"

export default function StudentProfile() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    course: "",
    year: "",
    schoolId: "",
  })
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = getCurrentUser()
      
      if (currentUser) {
        // Fetch latest user data from API
        try {
          const response = await fetch(`/api/users/${currentUser.id}`)
          if (response.ok) {
            const userData = await response.json()
            setProfileData({
              name: userData.name || "",
              email: userData.email || "",
              phone: userData.phone || "",
              course: userData.course || "",
              year: userData.year || "",
              schoolId: userData.schoolId || "",
            })
            // Update currentUser with schoolId if missing
            if (!currentUser.schoolId) {
              currentUser.schoolId = userData.schoolId
              localStorage.setItem("smartcode_user", JSON.stringify(currentUser))
            }
          }
        } catch (err) {
          console.error("Failed to fetch user data:", err)
          // Fallback to localStorage data
          setProfileData({
            name: currentUser.name || "",
            email: currentUser.email || currentUser.profile?.email || "",
            phone: currentUser.profile?.phone || "",
            course: currentUser.profile?.course || "",
            year: "",
            schoolId: currentUser.schoolId || "",
          })
        }
        
        setUser(currentUser)
      }
      setIsLoading(false)
    }
    
    loadUser()
  }, [])

  // Download QR Code as PNG
  const handleDownloadQR = () => {
    if (!profileData.schoolId || !qrRef.current) return

    const schoolId = profileData.schoolId
    const svg = qrRef.current.querySelector('svg')
    if (!svg) return

    // Create canvas and draw SVG
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    
    img.onload = () => {
      canvas.width = 300
      canvas.height = 350
      if (ctx) {
        // White background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        // Draw QR code
        ctx.drawImage(img, 50, 20, 200, 200)
        // Add school ID text
        ctx.fillStyle = 'black'
        ctx.font = 'bold 16px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`School ID: ${schoolId}`, canvas.width / 2, 260)
        ctx.font = '12px sans-serif'
        ctx.fillText('Scan for Attendance', canvas.width / 2, 285)
        
        // Download as PNG
        const link = document.createElement('a')
        link.href = canvas.toDataURL('image/png')
        link.download = `qr_code_${schoolId}.png`
        link.click()
      }
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">View your profile information and QR code</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* QR Code Card - Display first for easy scanning */}
        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border/50 flex flex-col items-center justify-center">
          <h2 className="font-semibold text-foreground mb-4 sm:mb-6 text-sm">Your QR Code</h2>
          {profileData.schoolId ? (
            <>
              <div 
                ref={qrRef}
                className="bg-white p-4 sm:p-6 rounded-xl mb-4 sm:mb-6 flex items-center justify-center shadow-md border-2 border-primary/20"
              >
                <QRCodeSVG 
                  value={profileData.schoolId}
                  size={220}
                  level="H"
                  includeMargin={true}
                  className="w-[200px] h-[200px] sm:w-[250px] sm:h-[250px]"
                />
              </div>
              <p className="text-center text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">
                School ID: <span className="font-mono font-semibold text-primary">{profileData.schoolId}</span>
              </p>
              <p className="text-center text-xs text-muted-foreground mb-3 sm:mb-4">
                Present this QR code to attendance scanners
              </p>
              <button 
                onClick={handleDownloadQR}
                className="action-button btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                <p className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                  QR Code Unavailable
                </p>
                <p className="text-yellow-600/80 dark:text-yellow-400/80 text-xs mt-1">
                  Please log out and log back in to generate your QR code.
                </p>
              </div>
              <button 
                onClick={() => {
                  localStorage.removeItem("smartcode_user")
                  window.location.href = "/login"
                }}
                className="action-button btn-secondary text-sm"
              >
                Log Out & Re-login
              </button>
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-card rounded-lg p-4 sm:p-6 border border-border/50">
            <h2 className="font-semibold text-foreground mb-4 sm:mb-6 text-sm">Personal Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* Full Name */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wide">Full Name</label>
                  <p className="font-medium text-foreground mt-0.5 sm:mt-1 text-sm sm:text-base truncate">{profileData.name || "—"}</p>
                </div>
              </div>
              
              {/* School ID */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wide">School ID</label>
                  <p className="font-mono font-semibold text-primary mt-0.5 sm:mt-1 text-sm sm:text-base">{profileData.schoolId || "—"}</p>
                </div>
              </div>

              {/* Course */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wide">Course</label>
                  <p className="font-medium text-foreground mt-0.5 sm:mt-1 text-sm sm:text-base truncate">{profileData.course || "—"}</p>
                </div>
              </div>
              
              {/* Year Level */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wide">Year Level</label>
                  <p className="font-medium text-foreground mt-0.5 sm:mt-1 text-sm sm:text-base">{profileData.year || "—"}</p>
                </div>
              </div>

              {/* Email Address */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wide">Email Address</label>
                  <p className="font-medium text-foreground mt-0.5 sm:mt-1 text-sm sm:text-base truncate">{profileData.email || "—"}</p>
                </div>
              </div>
              
              {/* Phone Number */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wide">Phone Number</label>
                  <p className="font-medium text-foreground mt-0.5 sm:mt-1 text-sm sm:text-base">{profileData.phone || "—"}</p>
                </div>
              </div>
            </div>

            {/* Info Notice */}
            <div className="mt-6 p-3 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground">
                📝 To update your profile information, please contact the administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
