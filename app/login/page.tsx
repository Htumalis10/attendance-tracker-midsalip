"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { LogIn, User, ShieldCheck } from "lucide-react"
import { authenticateUser, setCurrentUser } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<"admin" | "student">("student")
  const [id, setId] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (!id.trim()) {
        setError(`Please enter your ${role === "admin" ? "Admin" : "Student"} ID`)
        setIsLoading(false)
        return
      }

      // Use async authentication with database
      const user = await authenticateUser(id.trim().toUpperCase(), role)

      if (!user) {
        setError(`Invalid ${role === "admin" ? "Admin" : "Student"} ID. Please check and try again.`)
        setIsLoading(false)
        return
      }

      // Set user and redirect
      setCurrentUser(user)

      if (role === "admin") {
        router.push("/admin/qr-scanner")
      } else {
        router.push("/student/profile")
      }
    } catch (err) {
      setError("An error occurred during login. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 sm:p-6">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-60 sm:w-80 h-60 sm:h-80 bg-emerald-200/30 dark:bg-emerald-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-60 sm:w-80 h-60 sm:h-80 bg-teal-200/30 dark:bg-teal-900/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* School Logo & Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="relative inline-block">
            {/* Animated gradient ring */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 rounded-full opacity-75 blur-sm animate-pulse" />
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-white dark:bg-gray-800 p-1 sm:p-1.5 overflow-hidden">
              <div className="w-full h-full rounded-full overflow-hidden">
                <Image
                  src="/ZDSPGC LOGO.jpg"
                  alt="ZDSPGC Logo"
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
          <div className="mt-4 sm:mt-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500" />
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
                ZDSPGC SMART QR CODE
              </h1>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-teal-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium tracking-wider uppercase">
              ATTENDANCE TRACKING SYSTEM FOR MULTIPLE EVENTS
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl shadow-emerald-500/10">
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Welcome Back</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg sm:rounded-xl animate-in slide-in-from-top-2 duration-200">
              <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
            {/* Role Selection */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
                Login As
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <label
                  className={`relative flex items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    role === "student"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                      : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <input
                    type="radio"
                    value="student"
                    checked={role === "student"}
                    onChange={(e) => {
                      setRole(e.target.value as "admin" | "student")
                      setError("")
                    }}
                    className="sr-only"
                  />
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-medium text-sm sm:text-base">Student</span>
                  {role === "student" && (
                    <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 bg-emerald-500 rounded-full" />
                  )}
                </label>
                <label
                  className={`relative flex items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    role === "admin"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                      : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <input
                    type="radio"
                    value="admin"
                    checked={role === "admin"}
                    onChange={(e) => {
                      setRole(e.target.value as "admin" | "student")
                      setError("")
                    }}
                    className="sr-only"
                  />
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-medium text-sm sm:text-base">Admin</span>
                  {role === "admin" && (
                    <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 bg-emerald-500 rounded-full" />
                  )}
                </label>
              </div>
            </div>

            {/* ID Input */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {role === "admin" ? "Admin ID" : "Student Number"}
              </label>
              <div className="relative">
                <input
                  type={role === "admin" ? "password" : "text"}
                  placeholder={role === "admin" ? "e.g., ADMIN123" : "e.g., 20240001"}
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value)
                    setError("")
                  }}
                  className="w-full px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-3 sm:py-3.5 px-4 rounded-lg sm:rounded-xl flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-4 sm:mt-6">
          © 2026 ZDSPGC. All rights reserved.
        </p>
      </div>
    </div>
  )
}
