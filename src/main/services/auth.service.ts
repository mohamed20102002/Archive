import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { hashPassword, verifyPassword, generateId, generateSecureToken } from '../utils/crypto'
import * as jwt from 'jsonwebtoken'

// JWT secret - in production, this should be stored securely
const JWT_SECRET = generateSecureToken(64)
const JWT_EXPIRES_IN = '24h'

export interface User {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'user'
  is_active: boolean
  employee_number: string | null
  shift_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  last_login_at: string | null
  deleted_at: string | null
}

export interface UserWithPassword extends User {
  password_hash: string
}

export interface AuthResult {
  success: boolean
  user?: User
  token?: string
  error?: string
}

export interface TokenPayload {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}

// In-memory session store for active tokens
const activeSessions = new Map<string, { userId: string; expiresAt: number }>()

// Brute-force protection settings
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// Password strength validation
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  return null
}

// Track failed login attempts per username
interface FailedAttempt {
  attempts: number
  lastAttemptTime: number
  lockedUntil: number | null
}
const failedAttempts = new Map<string, FailedAttempt>()

// Check if user is locked out
function isLockedOut(username: string): { locked: boolean; remainingSeconds?: number } {
  const record = failedAttempts.get(username.toLowerCase())
  if (!record || !record.lockedUntil) {
    return { locked: false }
  }

  const now = Date.now()
  if (now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000)
    return { locked: true, remainingSeconds }
  }

  // Lockout expired, reset
  failedAttempts.delete(username.toLowerCase())
  return { locked: false }
}

// Record a failed login attempt
function recordFailedAttempt(username: string): { locked: boolean; remainingAttempts: number; remainingSeconds?: number } {
  const key = username.toLowerCase()
  const now = Date.now()
  let record = failedAttempts.get(key)

  if (!record) {
    record = { attempts: 0, lastAttemptTime: now, lockedUntil: null }
  }

  // Reset if last attempt was long ago (more than lockout duration)
  if (now - record.lastAttemptTime > LOCKOUT_DURATION_MS) {
    record = { attempts: 0, lastAttemptTime: now, lockedUntil: null }
  }

  record.attempts++
  record.lastAttemptTime = now

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS
    failedAttempts.set(key, record)
    const remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000)
    return { locked: true, remainingAttempts: 0, remainingSeconds }
  }

  failedAttempts.set(key, record)
  return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - record.attempts }
}

// Clear failed attempts on successful login
function clearFailedAttempts(username: string): void {
  failedAttempts.delete(username.toLowerCase())
}

// Clear all sessions (used after database restore to force re-login)
export function clearAllSessions(): void {
  const sessionCount = activeSessions.size
  activeSessions.clear()
  console.log(`[auth] Cleared ${sessionCount} active sessions`)
}

export function checkUsernameExists(username: string): { exists: boolean; isActive: boolean } {
  const db = getDatabase()
  // Use exact case-sensitive match for username
  const user = db.prepare(
    'SELECT id, is_active FROM users WHERE username = ? AND deleted_at IS NULL'
  ).get(username) as { id: string; is_active: number } | undefined

  if (!user) {
    return { exists: false, isActive: false }
  }
  return { exists: true, isActive: !!user.is_active }
}

export async function createUser(
  username: string,
  password: string,
  displayName: string,
  role: 'admin' | 'user' = 'user',
  createdBy?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const db = getDatabase()

  // Check if username already exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    return { success: false, error: 'Username already exists' }
  }

  // Validate password strength
  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return { success: false, error: passwordError }
  }

  // Calculate next sort_order (max + 1, or 1 if no users)
  const maxSortResult = db.prepare(
    'SELECT MAX(sort_order) as max_sort FROM users WHERE deleted_at IS NULL'
  ).get() as { max_sort: number | null }
  const nextSortOrder = (maxSortResult.max_sort ?? 0) + 1

  const id = generateId()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, username, passwordHash, displayName, role, nextSortOrder, now, now)

    const user: User = {
      id,
      username,
      display_name: displayName,
      role,
      is_active: true,
      employee_number: null,
      shift_id: null,
      sort_order: nextSortOrder,
      created_at: now,
      updated_at: now,
      last_login_at: null
    }

    // Log audit entry
    logAudit(
      'USER_CREATE',
      createdBy || id,
      createdBy ? getUsername(createdBy) : username,
      'user',
      id,
      { username, display_name: displayName, role }
    )

    return { success: true, user }
  } catch (error) {
    console.error('Error creating user:', error)
    return { success: false, error: 'Failed to create user' }
  }
}

export async function login(username: string, password: string): Promise<AuthResult> {
  const db = getDatabase()

  // Check for lockout first
  const lockoutStatus = isLockedOut(username)
  if (lockoutStatus.locked) {
    const minutes = Math.ceil((lockoutStatus.remainingSeconds || 0) / 60)
    logAudit('USER_LOGIN_FAILED', null, username, 'user', null, { reason: 'Account locked out' })
    return { success: false, error: `Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` }
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE username = ? AND is_active = 1 AND deleted_at IS NULL
  `).get(username) as UserWithPassword | undefined

  if (!user) {
    const failResult = recordFailedAttempt(username)
    logAudit('USER_LOGIN_FAILED', null, username, 'user', null, { reason: 'User not found or deleted' })
    if (failResult.locked) {
      const minutes = Math.ceil((failResult.remainingSeconds || 0) / 60)
      return { success: false, error: `Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` }
    }
    return { success: false, error: `Invalid username or password. ${failResult.remainingAttempts} attempt${failResult.remainingAttempts !== 1 ? 's' : ''} remaining.` }
  }

  const validPassword = await verifyPassword(user.password_hash, password)

  if (!validPassword) {
    const failResult = recordFailedAttempt(username)
    logAudit('USER_LOGIN_FAILED', user.id, username, 'user', user.id, { reason: 'Invalid password' })
    if (failResult.locked) {
      const minutes = Math.ceil((failResult.remainingSeconds || 0) / 60)
      return { success: false, error: `Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` }
    }
    return { success: false, error: `Invalid username or password. ${failResult.remainingAttempts} attempt${failResult.remainingAttempts !== 1 ? 's' : ''} remaining.` }
  }

  // Clear failed attempts on successful login
  clearFailedAttempts(username)

  // Update last login
  const now = new Date().toISOString()
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id)

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

  // Store in active sessions
  const decoded = jwt.decode(token) as TokenPayload
  activeSessions.set(token, {
    userId: user.id,
    expiresAt: decoded.exp * 1000
  })

  // Log successful login
  logAudit('USER_LOGIN', user.id, user.username, 'user', user.id, null)

  const safeUser: User = {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role as 'admin' | 'user',
    is_active: true,
    employee_number: (user as any).employee_number || null,
    shift_id: (user as any).shift_id || null,
    sort_order: (user as any).sort_order ?? 100,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: now
  }

  return { success: true, user: safeUser, token }
}

export function logout(token: string, userId: string): void {
  activeSessions.delete(token)

  const user = getUserById(userId)
  if (user) {
    logAudit('USER_LOGOUT', userId, user.username, 'user', userId, null)
  }
}

export function verifyToken(token: string): { valid: boolean; payload?: TokenPayload; error?: string } {
  try {
    // Check if token is in active sessions
    const session = activeSessions.get(token)
    if (!session) {
      return { valid: false, error: 'Session not found' }
    }

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token)
      return { valid: false, error: 'Session expired' }
    }

    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload
    return { valid: true, payload }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      activeSessions.delete(token)
      return { valid: false, error: 'Token expired' }
    }
    return { valid: false, error: 'Invalid token' }
  }
}

export function getUserById(id: string): User | null {
  const db = getDatabase()
  const user = db.prepare(`
    SELECT id, username, display_name, role, is_active, employee_number, shift_id, created_at, updated_at, last_login_at, deleted_at
    FROM users WHERE id = ?
  `).get(id) as User | undefined

  return user || null
}

export function getUsername(userId: string): string | null {
  const user = getUserById(userId)
  return user?.username || null
}

export function getUserDisplayName(userId: string): string | null {
  const user = getUserById(userId)
  return user?.display_name || null
}

export function getAllUsers(): User[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, username, display_name, arabic_name, role, is_active, employee_number, shift_id, sort_order, created_at, updated_at, last_login_at, deleted_at
    FROM users
    ORDER BY deleted_at IS NOT NULL, sort_order ASC, created_at ASC
  `).all() as User[]
}

export async function updateUser(
  id: string,
  updates: {
    username?: string
    display_name?: string
    arabic_name?: string | null
    role?: 'admin' | 'user'
    is_active?: boolean
    employee_number?: string | null
    shift_id?: string | null
    sort_order?: number
  },
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDatabase()

  const user = getUserById(id)
  if (!user) {
    return { success: false, error: 'User not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (updates.username !== undefined) {
    // Check if new username already exists for a different user
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(updates.username, id)
    if (existingUser) {
      return { success: false, error: 'Username already exists' }
    }
    fields.push('username = ?')
    values.push(updates.username)
  }

  if (updates.display_name !== undefined) {
    fields.push('display_name = ?')
    values.push(updates.display_name)
  }

  if (updates.arabic_name !== undefined) {
    fields.push('arabic_name = ?')
    values.push(updates.arabic_name)
  }

  if (updates.role !== undefined) {
    fields.push('role = ?')
    values.push(updates.role)
  }

  if (updates.is_active !== undefined) {
    fields.push('is_active = ?')
    values.push(updates.is_active ? 1 : 0)
  }

  if (updates.employee_number !== undefined) {
    fields.push('employee_number = ?')
    values.push(updates.employee_number)
  }

  if (updates.shift_id !== undefined) {
    fields.push('shift_id = ?')
    values.push(updates.shift_id)
  }

  if (updates.sort_order !== undefined) {
    // Check for duplicate sort_order
    const duplicate = db.prepare(
      'SELECT id, display_name FROM users WHERE sort_order = ? AND id != ? AND deleted_at IS NULL'
    ).get(updates.sort_order, id) as { id: string; display_name: string } | undefined
    if (duplicate) {
      return { success: false, error: `Sort order ${updates.sort_order} is already used by "${duplicate.display_name}"` }
    }
    fields.push('sort_order = ?')
    values.push(updates.sort_order)
  }

  if (fields.length === 0) {
    return { success: false, error: 'No updates provided' }
  }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'USER_UPDATE',
      updatedBy,
      getUsername(updatedBy),
      'user',
      id,
      { updates, target_user: user.username }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating user:', error)
    return { success: false, error: 'Failed to update user' }
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDatabase()

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserWithPassword | undefined
  if (!user) {
    return { success: false, error: 'User not found' }
  }

  const validPassword = await verifyPassword(user.password_hash, currentPassword)
  if (!validPassword) {
    return { success: false, error: 'Current password is incorrect' }
  }

  const passwordError = validatePasswordStrength(newPassword)
  if (passwordError) {
    return { success: false, error: passwordError }
  }

  const newHash = await hashPassword(newPassword)
  const now = new Date().toISOString()

  try {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, now, userId)

    logAudit('USER_UPDATE', userId, user.username, 'user', userId, { action: 'password_change' })

    return { success: true }
  } catch (error) {
    console.error('Error changing password:', error)
    return { success: false, error: 'Failed to change password' }
  }
}

export async function resetPassword(
  userId: string,
  newPassword: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDatabase()

  // Verify admin is actually an admin
  const admin = getUserById(adminId)
  if (!admin || admin.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const user = getUserById(userId)
  if (!user) {
    return { success: false, error: 'User not found' }
  }

  const passwordError = validatePasswordStrength(newPassword)
  if (passwordError) {
    return { success: false, error: passwordError }
  }

  const newHash = await hashPassword(newPassword)
  const now = new Date().toISOString()

  try {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, now, userId)

    logAudit(
      'USER_UPDATE',
      adminId,
      admin.username,
      'user',
      userId,
      { action: 'password_reset', target_user: user.username }
    )

    return { success: true }
  } catch (error) {
    console.error('Error resetting password:', error)
    return { success: false, error: 'Failed to reset password' }
  }
}

export function hasAdminUser(): boolean {
  const db = getDatabase()
  const result = db.prepare(
    "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL"
  ).get() as { count: number }
  return result.count > 0
}

export function deleteUser(
  userId: string,
  adminId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Verify admin is actually an admin
  const admin = getUserById(adminId)
  if (!admin || admin.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Cannot delete yourself
  if (userId === adminId) {
    return { success: false, error: 'You cannot delete your own account' }
  }

  const user = getUserById(userId)
  if (!user) {
    return { success: false, error: 'User not found' }
  }

  // Check if already deleted
  if (user.deleted_at) {
    return { success: false, error: 'User is already deleted' }
  }

  // Check if this is the last active admin
  const adminCount = db.prepare(
    "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL AND id != ?"
  ).get(userId) as { count: number }

  if (user.role === 'admin' && adminCount.count === 0) {
    return { success: false, error: 'Cannot delete the last admin user' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE users
      SET deleted_at = ?, is_active = 0, updated_at = ?
      WHERE id = ?
    `).run(now, now, userId)

    logAudit(
      'USER_DELETE',
      adminId,
      admin.username,
      'user',
      userId,
      { deleted_user: user.username, deleted_display_name: user.display_name }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      activeSessions.delete(token)
    }
  }
}, 60000) // Check every minute
