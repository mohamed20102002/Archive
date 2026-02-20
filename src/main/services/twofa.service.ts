import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateSecureToken } from '../utils/crypto'
import * as outlookService from './outlook.service'
import * as settingsService from './settings.service'

// Code storage with expiry
interface TwoFACode {
  code: string
  userId: string
  email: string
  expiresAt: number
  attempts: number
  createdAt: number
}

const activeCodes = new Map<string, TwoFACode>()

// Configuration
const CODE_LENGTH = 6
const CODE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ATTEMPTS = 3
const MAX_RESENDS = 3
const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute between resends

// Track resend attempts per user session
const resendCounts = new Map<string, { count: number; lastResend: number }>()

// Generate a numeric code
function generateNumericCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  return code
}

// Generate a session token for 2FA flow
export function generateTwoFASessionToken(): string {
  return generateSecureToken(32)
}

// Check if 2FA is enabled for a user
export function isTwoFAEnabled(userId: string): boolean {
  const db = getDatabase()
  try {
    const user = db.prepare(`
      SELECT two_factor_enabled FROM users WHERE id = ?
    `).get(userId) as { two_factor_enabled: number } | undefined

    return user?.two_factor_enabled === 1
  } catch (e) {
    // Column might not exist yet
    return false
  }
}

// Enable/disable 2FA for a user
export function setTwoFAEnabled(
  userId: string,
  enabled: boolean,
  adminId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare(`
      UPDATE users SET two_factor_enabled = ?, updated_at = ? WHERE id = ?
    `).run(enabled ? 1 : 0, new Date().toISOString(), userId)

    logAudit(
      enabled ? 'USER_2FA_ENABLED' : 'USER_2FA_DISABLED',
      adminId,
      null,
      'user',
      userId,
      { enabled }
    )

    return { success: true }
  } catch (e) {
    console.error('Error setting 2FA:', e)
    return { success: false, error: 'Failed to update 2FA setting' }
  }
}

// Get user email for 2FA
function getUserEmail(userId: string): string | null {
  const db = getDatabase()
  const user = db.prepare(`
    SELECT email FROM users WHERE id = ?
  `).get(userId) as { email: string } | undefined

  return user?.email || null
}

// Initiate 2FA - send code via email
export async function initiateTwoFA(
  userId: string,
  sessionToken: string
): Promise<{ success: boolean; maskedEmail?: string; error?: string }> {
  // Get user's email
  const email = getUserEmail(userId)
  if (!email) {
    // Try to get from settings as fallback
    const settings = settingsService.getAllSettings()
    const fallbackEmail = settings.twofa_fallback_email as string | undefined

    if (!fallbackEmail) {
      return { success: false, error: 'No email configured for 2FA. Please contact administrator.' }
    }
  }

  const targetEmail = email || (settingsService.getAllSettings().twofa_fallback_email as string)

  // Check resend limits
  const resendRecord = resendCounts.get(sessionToken)
  if (resendRecord) {
    if (resendRecord.count >= MAX_RESENDS) {
      return { success: false, error: 'Maximum resend attempts reached. Please try logging in again.' }
    }

    const timeSinceLastResend = Date.now() - resendRecord.lastResend
    if (timeSinceLastResend < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastResend) / 1000)
      return { success: false, error: `Please wait ${waitSeconds} seconds before requesting another code.` }
    }
  }

  // Generate code
  const code = generateNumericCode()
  const now = Date.now()

  // Store code
  activeCodes.set(sessionToken, {
    code,
    userId,
    email: targetEmail,
    expiresAt: now + CODE_EXPIRY_MS,
    attempts: 0,
    createdAt: now
  })

  // Update resend count
  resendCounts.set(sessionToken, {
    count: (resendRecord?.count || 0) + 1,
    lastResend: now
  })

  // Send email via Outlook
  try {
    const db = getDatabase()
    const user = db.prepare(`
      SELECT display_name FROM users WHERE id = ?
    `).get(userId) as { display_name: string } | undefined

    const displayName = user?.display_name || 'User'

    const subject = 'Your login verification code'
    const body = `
Hello ${displayName},

Your verification code is: ${code}

This code will expire in 5 minutes.

If you did not request this code, please ignore this email and contact your administrator.

---
Project Data Archiving System
    `.trim()

    await outlookService.sendEmail(targetEmail, subject, body)

    // Mask email for display
    const [localPart, domain] = targetEmail.split('@')
    const maskedLocal = localPart.length > 3
      ? localPart.substring(0, 2) + '***' + localPart.substring(localPart.length - 1)
      : localPart.substring(0, 1) + '***'
    const maskedEmail = `${maskedLocal}@${domain}`

    logAudit('USER_2FA_CODE_SENT', userId, null, 'user', userId, { email: maskedEmail })

    return { success: true, maskedEmail }
  } catch (e) {
    console.error('Error sending 2FA email:', e)
    // Clean up the stored code on failure
    activeCodes.delete(sessionToken)
    return { success: false, error: 'Failed to send verification email. Please try again.' }
  }
}

// Verify 2FA code
export function verifyTwoFACode(
  sessionToken: string,
  code: string
): { valid: boolean; error?: string; remainingAttempts?: number } {
  const storedCode = activeCodes.get(sessionToken)

  if (!storedCode) {
    return { valid: false, error: 'Verification session expired. Please try logging in again.' }
  }

  // Check expiry
  if (Date.now() > storedCode.expiresAt) {
    activeCodes.delete(sessionToken)
    resendCounts.delete(sessionToken)
    return { valid: false, error: 'Verification code has expired. Please request a new one.' }
  }

  // Check attempts
  if (storedCode.attempts >= MAX_ATTEMPTS) {
    activeCodes.delete(sessionToken)
    resendCounts.delete(sessionToken)
    logAudit('USER_2FA_MAX_ATTEMPTS', storedCode.userId, null, 'user', storedCode.userId, null)
    return { valid: false, error: 'Too many incorrect attempts. Please try logging in again.' }
  }

  // Verify code (constant-time comparison to prevent timing attacks)
  const normalizedInput = code.trim()
  const normalizedStored = storedCode.code

  let isValid = normalizedInput.length === normalizedStored.length
  for (let i = 0; i < normalizedStored.length; i++) {
    if (normalizedInput.charAt(i) !== normalizedStored.charAt(i)) {
      isValid = false
    }
  }

  if (!isValid) {
    storedCode.attempts++
    const remainingAttempts = MAX_ATTEMPTS - storedCode.attempts

    logAudit('USER_2FA_FAILED', storedCode.userId, null, 'user', storedCode.userId, {
      attempts: storedCode.attempts,
      remaining: remainingAttempts
    })

    return {
      valid: false,
      error: 'Invalid verification code.',
      remainingAttempts
    }
  }

  // Code is valid - clean up
  activeCodes.delete(sessionToken)
  resendCounts.delete(sessionToken)

  logAudit('USER_2FA_SUCCESS', storedCode.userId, null, 'user', storedCode.userId, null)

  return { valid: true }
}

// Cancel 2FA session
export function cancelTwoFA(sessionToken: string): void {
  const storedCode = activeCodes.get(sessionToken)
  if (storedCode) {
    logAudit('USER_2FA_CANCELLED', storedCode.userId, null, 'user', storedCode.userId, null)
  }
  activeCodes.delete(sessionToken)
  resendCounts.delete(sessionToken)
}

// Get remaining time for a code
export function getTwoFARemainingTime(sessionToken: string): number | null {
  const storedCode = activeCodes.get(sessionToken)
  if (!storedCode) return null

  const remaining = storedCode.expiresAt - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

// Cleanup expired codes periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, code] of activeCodes.entries()) {
    if (now > code.expiresAt) {
      activeCodes.delete(token)
      resendCounts.delete(token)
    }
  }
}, 60000) // Check every minute
