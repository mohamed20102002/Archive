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
  created_at: string
  updated_at: string
  last_login_at: string | null
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
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }

  const id = generateId()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, username, passwordHash, displayName, role, now, now)

    const user: User = {
      id,
      username,
      display_name: displayName,
      role,
      is_active: true,
      employee_number: null,
      shift_id: null,
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

  const user = db.prepare(`
    SELECT * FROM users WHERE username = ? AND is_active = 1
  `).get(username) as UserWithPassword | undefined

  if (!user) {
    logAudit('USER_LOGIN_FAILED', null, username, 'user', null, { reason: 'User not found' })
    return { success: false, error: 'Invalid username or password' }
  }

  const validPassword = await verifyPassword(user.password_hash, password)

  if (!validPassword) {
    logAudit('USER_LOGIN_FAILED', user.id, username, 'user', user.id, { reason: 'Invalid password' })
    return { success: false, error: 'Invalid username or password' }
  }

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
    SELECT id, username, display_name, role, is_active, employee_number, shift_id, created_at, updated_at, last_login_at
    FROM users WHERE id = ?
  `).get(id) as User | undefined

  return user || null
}

export function getUsername(userId: string): string | null {
  const user = getUserById(userId)
  return user?.username || null
}

export function getAllUsers(): User[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT id, username, display_name, role, is_active, employee_number, shift_id, created_at, updated_at, last_login_at
    FROM users
    ORDER BY created_at ASC
  `).all() as User[]
}

export async function updateUser(
  id: string,
  updates: {
    username?: string
    display_name?: string
    role?: 'admin' | 'user'
    is_active?: boolean
    employee_number?: string | null
    shift_id?: string | null
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

  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters' }
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

  if (newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
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
    "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1"
  ).get() as { count: number }
  return result.count > 0
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
