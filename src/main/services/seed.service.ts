import { v4 as uuidv4 } from 'uuid'
import { getDatabase, getAuditDatabase, getEmailsPath, getDataPath, refreshDatabase } from '../database/connection'
import { getBasePath } from '../utils/fileSystem'
import { encryptPassword } from './secure-resources-crypto'
import * as fs from 'fs'
import * as path from 'path'

// Helper to generate random data
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}
const formatDate = (d: Date) => d.toISOString().split('T')[0]
const formatDateTime = (d: Date) => d.toISOString()

// Sample data arrays
const firstNames = ['Ahmed', 'Mohamed', 'Ali', 'Omar', 'Youssef', 'Hassan', 'Mahmoud', 'Ibrahim', 'Khaled', 'Tarek', 'Nour', 'Sara', 'Fatima', 'Layla', 'Amira']
const lastNames = ['Hassan', 'Ibrahim', 'Ahmed', 'Ali', 'Mohamed', 'Mahmoud', 'Youssef', 'Omar', 'Khaled', 'Tarek']
const departments = ['Engineering', 'Operations', 'Safety', 'Quality', 'Maintenance', 'IT', 'HR', 'Finance']
const topicTitles = [
  'Project Alpha Documentation', 'Safety Procedures Review', 'Equipment Maintenance Logs',
  'Training Records', 'Quality Assurance Reports', 'Incident Reports', 'Meeting Minutes Archive',
  'Vendor Communications', 'Regulatory Compliance', 'Budget Planning', 'Staff Scheduling',
  'Emergency Response Plans', 'Technical Specifications', 'Customer Feedback', 'Performance Reviews'
]
const recordTypes = ['note', 'document', 'event', 'decision']
const priorities = ['low', 'normal', 'high', 'urgent']
const letterTypes = ['incoming', 'outgoing', 'internal']
const letterStatuses = ['pending', 'in_progress', 'replied', 'closed']
const responseTypes = ['requires_reply', 'informational', 'for_action', 'for_review']
const authorityTypes = ['internal', 'external', 'government', 'private']
const credentialCategories = ['Software', 'Desktop', 'Server', 'Network', 'Other']
const referenceCategories = ['General', 'Policy', 'Procedure', 'Template', 'Guide', 'Other']
const issueImportances = ['low', 'medium', 'high', 'critical']
const momLocations = ['Conference Room A', 'Conference Room B', 'Board Room', 'Training Center', 'Virtual Meeting', 'Site Office', 'Main Building']

const organizationNames = [
  'Ministry of Energy', 'National Grid Company', 'Environmental Agency',
  'Safety Authority', 'Technical Standards Board', 'Regional Power Corp',
  'Industrial Solutions Ltd', 'Engineering Consultants Inc', 'Quality Systems Co',
  'Infrastructure Development Authority', 'Regulatory Commission', 'Research Institute'
]

const subjects = [
  'Monthly Status Report', 'Equipment Inspection Results', 'Safety Audit Findings',
  'Budget Approval Request', 'Training Completion Certificate', 'Maintenance Schedule Update',
  'Incident Investigation Report', 'Compliance Verification', 'Project Milestone Achievement',
  'Resource Allocation Request', 'Performance Evaluation Summary', 'Emergency Drill Results',
  'Vendor Contract Review', 'Quality Improvement Initiative', 'Risk Assessment Report'
]

const actionDescriptions = [
  'Review and approve the submitted documentation',
  'Coordinate with vendor for equipment delivery',
  'Schedule training session for new procedures',
  'Update safety protocols based on findings',
  'Prepare presentation for management review',
  'Collect feedback from stakeholders',
  'Verify compliance with regulatory requirements',
  'Complete risk assessment for new project',
  'Submit budget revision for approval',
  'Arrange site visit for inspection'
]

export interface SeedOptions {
  users?: number
  topics?: number
  recordsPerTopic?: number
  letters?: number
  moms?: number
  issues?: number
  attendanceMonths?: number
  reminders?: number
  credentials?: number
  references?: number
}

export interface SeedResult {
  success: boolean
  message: string
  counts: {
    users: number
    shifts: number
    topics: number
    subcategories: number
    records: number
    authorities: number
    contacts: number
    letters: number
    letterReferences: number
    momLocations: number
    moms: number
    momActions: number
    momLetterLinks: number
    momRecordLinks: number
    issues: number
    attendanceConditions: number
    attendanceEntries: number
    reminders: number
    credentials: number
    secureReferences: number
  }
  error?: string
}

export async function seedDatabase(userId: string, options: SeedOptions = {}): Promise<SeedResult> {
  const db = getDatabase()

  const opts = {
    users: options.users ?? 8,
    topics: options.topics ?? 12,
    recordsPerTopic: options.recordsPerTopic ?? 15,
    letters: options.letters ?? 50,
    moms: options.moms ?? 20,
    issues: options.issues ?? 25,
    attendanceMonths: options.attendanceMonths ?? 3,
    reminders: options.reminders ?? 15,
    credentials: options.credentials ?? 10,
    references: options.references ?? 8
  }

  const counts = {
    users: 0,
    shifts: 0,
    topics: 0,
    subcategories: 0,
    records: 0,
    authorities: 0,
    contacts: 0,
    letters: 0,
    letterReferences: 0,
    momLocations: 0,
    moms: 0,
    momActions: 0,
    momLetterLinks: 0,
    momRecordLinks: 0,
    issues: 0,
    attendanceConditions: 0,
    attendanceEntries: 0,
    reminders: 0,
    credentials: 0,
    secureReferences: 0
  }

  try {
    // Start transaction
    db.exec('BEGIN TRANSACTION')

    // 1. Create Shifts
    const shifts: { id: string; name: string }[] = []
    const shiftNames = ['Morning Shift', 'Afternoon Shift', 'Night Shift']
    for (let i = 0; i < shiftNames.length; i++) {
      const existing = db.prepare('SELECT id FROM shifts WHERE name = ? AND deleted_at IS NULL').get(shiftNames[i]) as { id: string } | undefined
      if (existing) {
        shifts.push({ id: existing.id, name: shiftNames[i] })
      } else {
        const id = uuidv4()
        db.prepare(`
          INSERT INTO shifts (id, name, sort_order, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(id, shiftNames[i], i + 1, userId)
        shifts.push({ id, name: shiftNames[i] })
        counts.shifts++
      }
    }

    // 2. Create Users
    const users: { id: string; display_name: string }[] = []
    // Add the seeding user
    const seedingUser = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(userId) as { id: string; display_name: string }
    if (seedingUser) users.push(seedingUser)

    for (let i = 0; i < opts.users; i++) {
      const firstName = randomItem(firstNames)
      const lastName = randomItem(lastNames)
      const displayName = `${firstName} ${lastName}`
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}`
      const empNumber = `EMP${String(randomInt(1000, 9999))}`

      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
      if (!existing) {
        const id = uuidv4()
        db.prepare(`
          INSERT INTO users (id, username, password_hash, display_name, role, is_active, employee_number, shift_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))
        `).run(id, username, '$2b$10$dummy_hash_for_seeding', displayName, i === 0 ? 'admin' : 'user', empNumber, randomItem(shifts).id)
        users.push({ id, display_name: displayName })
        counts.users++
      }
    }

    // 3. Create Attendance Conditions
    const conditions: { id: string; name: string }[] = []
    const conditionData = [
      { name: 'Present', color: '#22c55e', display_number: 1 },
      { name: 'Absent', color: '#ef4444', display_number: 2 },
      { name: 'Late', color: '#f97316', display_number: 3 },
      { name: 'Sick Leave', color: '#8b5cf6', display_number: 4 },
      { name: 'Annual Leave', color: '#3b82f6', display_number: 5 },
      { name: 'Training', color: '#06b6d4', display_number: 6 },
      { name: 'Remote Work', color: '#84cc16', display_number: 7 },
      { name: 'Business Trip', color: '#ec4899', display_number: 8 }
    ]
    for (let i = 0; i < conditionData.length; i++) {
      const c = conditionData[i]
      const existing = db.prepare('SELECT id FROM attendance_conditions WHERE name = ? AND deleted_at IS NULL').get(c.name) as { id: string } | undefined
      if (existing) {
        conditions.push({ id: existing.id, name: c.name })
      } else {
        const id = uuidv4()
        db.prepare(`
          INSERT INTO attendance_conditions (id, name, color, sort_order, display_number, is_ignored, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
        `).run(id, c.name, c.color, i + 1, c.display_number, userId)
        conditions.push({ id, name: c.name })
        counts.attendanceConditions++
      }
    }

    // 4. Create Topics and Subcategories
    const topics: { id: string; title: string }[] = []
    const subcategories: { id: string; topic_id: string; title: string }[] = []

    for (let i = 0; i < opts.topics; i++) {
      const title = i < topicTitles.length ? topicTitles[i] : `Topic ${i + 1} - ${randomItem(departments)}`
      const id = uuidv4()
      const creator = randomItem(users)

      db.prepare(`
        INSERT INTO topics (id, title, description, status, priority, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?, datetime('now'), datetime('now'))
      `).run(id, title, `Description for ${title}`, randomItem(priorities), creator.id)
      topics.push({ id, title })
      counts.topics++

      // Create 2-4 subcategories per topic
      const numSubs = randomInt(2, 4)
      for (let j = 0; j < numSubs; j++) {
        const subId = uuidv4()
        const subTitle = `${title} - Category ${j + 1}`
        db.prepare(`
          INSERT INTO subcategories (id, topic_id, title, description, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(subId, id, subTitle, `Subcategory for ${title}`, creator.id)
        subcategories.push({ id: subId, topic_id: id, title: subTitle })
        counts.subcategories++
      }
    }

    // 5. Create Records
    const records: { id: string; topic_id: string; title: string }[] = []
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 6)
    const endDate = new Date()

    for (const topic of topics) {
      const topicSubs = subcategories.filter(s => s.topic_id === topic.id)
      for (let i = 0; i < opts.recordsPerTopic; i++) {
        const id = uuidv4()
        const type = randomItem(recordTypes)
        const title = `${type.charAt(0).toUpperCase() + type.slice(1)}: ${topic.title} - Entry ${i + 1}`
        const sub = topicSubs.length > 0 && Math.random() > 0.3 ? randomItem(topicSubs) : null
        const creator = randomItem(users)
        const createdAt = formatDateTime(randomDate(startDate, endDate))

        db.prepare(`
          INSERT INTO records (id, topic_id, subcategory_id, type, title, content, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, topic.id, sub?.id || null, type, title, `Content for ${title}`, creator.id, createdAt, createdAt)
        records.push({ id, topic_id: topic.id, title })
        counts.records++
      }
    }

    // 6. Create Authorities
    const authorities: { id: string; name: string }[] = []
    for (const name of organizationNames) {
      const id = uuidv4()
      const shortName = name.split(' ').map(w => w[0]).join('')
      const type = randomItem(authorityTypes)

      db.prepare(`
        INSERT INTO authorities (id, name, short_name, type, is_internal, contact_email, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, name, shortName, type, type === 'internal' ? 1 : 0, `contact@${shortName.toLowerCase()}.org`, userId)
      authorities.push({ id, name })
      counts.authorities++
    }

    // 7. Create Contacts
    const contacts: { id: string; name: string; authority_id: string }[] = []
    for (const auth of authorities) {
      const numContacts = randomInt(1, 3)
      for (let i = 0; i < numContacts; i++) {
        const id = uuidv4()
        const name = `${randomItem(firstNames)} ${randomItem(lastNames)}`
        const title = randomItem(['Manager', 'Director', 'Coordinator', 'Specialist', 'Engineer', 'Officer'])

        db.prepare(`
          INSERT INTO contacts (id, name, title, authority_id, email, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(id, name, title, auth.id, `${name.toLowerCase().replace(' ', '.')}@email.com`, userId)
        contacts.push({ id, name, authority_id: auth.id })
        counts.contacts++
      }
    }

    // 8. Create Letters
    const letters: { id: string; reference_number: string; subject: string }[] = []
    for (let i = 0; i < opts.letters; i++) {
      const id = uuidv4()
      const letterType = randomItem(letterTypes)
      const status = randomItem(letterStatuses)
      const priority = randomItem(priorities)
      const topic = randomItem(topics)
      const auth = randomItem(authorities)
      const authContacts = contacts.filter(c => c.authority_id === auth.id)
      const contact = authContacts.length > 0 ? randomItem(authContacts) : null
      const subject = randomItem(subjects)
      const creator = randomItem(users)
      const letterDate = randomDate(startDate, endDate)
      const refNum = `${letterType === 'incoming' ? 'I' : letterType === 'outgoing' ? 'O' : 'INT'}/${formatDate(letterDate).replace(/-/g, '')}/${randomInt(1000, 9999)}`

      db.prepare(`
        INSERT INTO letters (id, letter_type, response_type, status, priority, reference_number, subject, summary,
          authority_id, contact_id, topic_id, letter_date, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, letterType, randomItem(responseTypes), status, priority, refNum, subject,
        `Summary of ${subject}`, auth.id, contact?.id || null, topic.id, formatDate(letterDate), creator.id)
      letters.push({ id, reference_number: refNum, subject })
      counts.letters++
    }

    // 9. Create MOM Locations
    const locations: { id: string; name: string }[] = []
    for (let i = 0; i < momLocations.length; i++) {
      const existing = db.prepare('SELECT id FROM mom_locations WHERE name = ? AND deleted_at IS NULL').get(momLocations[i]) as { id: string } | undefined
      if (existing) {
        locations.push({ id: existing.id, name: momLocations[i] })
      } else {
        const id = uuidv4()
        db.prepare(`
          INSERT INTO mom_locations (id, name, sort_order, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(id, momLocations[i], i + 1, userId)
        locations.push({ id, name: momLocations[i] })
        counts.momLocations++
      }
    }

    // 10. Create MOMs with Actions
    const moms: { id: string; mom_id: string; title: string }[] = []
    for (let i = 0; i < opts.moms; i++) {
      const id = uuidv4()
      const momId = `MOM-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`
      const title = `Meeting: ${randomItem(subjects)}`
      const location = randomItem(locations)
      const meetingDate = randomDate(startDate, endDate)
      const creator = randomItem(users)
      const status = Math.random() > 0.3 ? 'open' : 'closed'

      db.prepare(`
        INSERT INTO moms (id, mom_id, title, subject, meeting_date, location_id, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, momId, title, `Discussion on ${randomItem(subjects)}`, formatDate(meetingDate), location.id, status, creator.id)
      moms.push({ id, mom_id: momId, title })
      counts.moms++

      // Create 2-5 actions per MOM
      const numActions = randomInt(2, 5)
      for (let j = 0; j < numActions; j++) {
        const actionId = uuidv4()
        const deadline = new Date(meetingDate)
        deadline.setDate(deadline.getDate() + randomInt(7, 30))
        const actionStatus = Math.random() > 0.4 ? 'open' : 'resolved'
        const responsible = randomItem(users)

        db.prepare(`
          INSERT INTO mom_actions (id, mom_internal_id, description, responsible_party, deadline, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(actionId, id, randomItem(actionDescriptions), responsible.display_name, formatDate(deadline), actionStatus, creator.id)
        counts.momActions++
      }

      // Link MOM to random topics
      const linkedTopics = new Set<string>()
      const numLinks = randomInt(1, 3)
      for (let j = 0; j < numLinks; j++) {
        const topic = randomItem(topics)
        if (!linkedTopics.has(topic.id)) {
          linkedTopics.add(topic.id)
          db.prepare(`
            INSERT INTO mom_topic_links (id, mom_internal_id, topic_id, created_by, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).run(uuidv4(), id, topic.id, creator.id)
        }
      }
    }

    // 10b. Create Letter References (letter-to-letter links)
    const referenceTypes = ['reply_to', 'related', 'supersedes', 'amends']
    const linkedLetterPairs = new Set<string>()
    const numLetterRefs = Math.min(Math.floor(letters.length * 0.4), 25) // ~40% of letters get references, max 25
    for (let i = 0; i < numLetterRefs; i++) {
      const sourceLetter = randomItem(letters)
      const targetLetter = randomItem(letters)
      const pairKey = `${sourceLetter.id}-${targetLetter.id}`

      if (sourceLetter.id !== targetLetter.id && !linkedLetterPairs.has(pairKey)) {
        linkedLetterPairs.add(pairKey)
        const refType = randomItem(referenceTypes)
        const creator = randomItem(users)

        db.prepare(`
          INSERT INTO letter_references (id, source_letter_id, target_letter_id, reference_type, notes, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(uuidv4(), sourceLetter.id, targetLetter.id, refType, `Reference: ${sourceLetter.subject} -> ${targetLetter.subject}`, creator.id)
        counts.letterReferences++
      }
    }

    // 10c. Create MOM-Letter Links
    const linkedMomLetters = new Set<string>()
    for (const mom of moms) {
      const numLetterLinks = randomInt(0, 3) // 0-3 letters per MOM
      for (let j = 0; j < numLetterLinks; j++) {
        const letter = randomItem(letters)
        const linkKey = `${mom.id}-${letter.id}`

        if (!linkedMomLetters.has(linkKey)) {
          linkedMomLetters.add(linkKey)
          const creator = randomItem(users)

          db.prepare(`
            INSERT INTO mom_letter_links (id, mom_internal_id, letter_id, created_by, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).run(uuidv4(), mom.id, letter.id, creator.id)
          counts.momLetterLinks++
        }
      }
    }

    // 10d. Create MOM-Record Links
    const linkedMomRecords = new Set<string>()
    for (const mom of moms) {
      const numRecordLinks = randomInt(0, 4) // 0-4 records per MOM
      for (let j = 0; j < numRecordLinks; j++) {
        const record = randomItem(records)
        const linkKey = `${mom.id}-${record.id}`

        if (!linkedMomRecords.has(linkKey)) {
          linkedMomRecords.add(linkKey)
          const creator = randomItem(users)

          db.prepare(`
            INSERT INTO mom_record_links (id, mom_internal_id, record_id, created_by, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).run(uuidv4(), mom.id, record.id, creator.id)
          counts.momRecordLinks++
        }
      }
    }

    // 11. Create Issues
    for (let i = 0; i < opts.issues; i++) {
      const id = uuidv4()
      const topic = Math.random() > 0.3 ? randomItem(topics) : null
      const topicSubs = topic ? subcategories.filter(s => s.topic_id === topic.id) : []
      const sub = topicSubs.length > 0 && Math.random() > 0.5 ? randomItem(topicSubs) : null
      const creator = randomItem(users)
      const importance = randomItem(issueImportances)
      const status = Math.random() > 0.3 ? 'open' : 'completed'
      const createdAt = randomDate(startDate, endDate)

      db.prepare(`
        INSERT INTO issues (id, title, description, topic_id, subcategory_id, importance, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, `Issue: ${randomItem(subjects)}`, `Description of the issue requiring attention`, topic?.id || null, sub?.id || null, importance, status, creator.id, formatDateTime(createdAt), formatDateTime(createdAt))
      counts.issues++
    }

    // 12. Create Attendance Entries
    const today = new Date()
    for (let monthOffset = 0; monthOffset < opts.attendanceMonths; monthOffset++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth() + 1
      const daysInMonth = new Date(year, month, 0).getDate()

      for (const user of users) {
        for (let day = 1; day <= daysInMonth; day++) {
          const entryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayOfWeek = new Date(year, month - 1, day).getDay()

          // Skip weekends (Friday=5, Saturday=6)
          if (dayOfWeek === 5 || dayOfWeek === 6) continue

          // Check if entry exists
          const existing = db.prepare('SELECT id FROM attendance_entries WHERE user_id = ? AND entry_date = ?').get(user.id, entryDate)
          if (existing) continue

          const id = uuidv4()
          const shift = randomItem(shifts)
          const condition = Math.random() > 0.15 ? conditions[0] : randomItem(conditions) // 85% present

          db.prepare(`
            INSERT INTO attendance_entries (id, user_id, entry_date, year, month, day, shift_id, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).run(id, user.id, entryDate, year, month, day, shift.id, userId)

          // Link condition
          db.prepare(`
            INSERT INTO attendance_entry_conditions (entry_id, condition_id)
            VALUES (?, ?)
          `).run(id, condition.id)

          counts.attendanceEntries++
        }
      }
    }

    // 13. Create Reminders
    for (let i = 0; i < opts.reminders; i++) {
      const id = uuidv4()
      const topic = Math.random() > 0.3 ? randomItem(topics) : null
      const record = topic && Math.random() > 0.5 ? randomItem(records.filter(r => r.topic_id === topic.id)) : null
      const creator = randomItem(users)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + randomInt(-7, 30))
      const isCompleted = Math.random() > 0.6

      db.prepare(`
        INSERT INTO reminders (id, topic_id, record_id, title, description, due_date, priority, is_completed, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, topic?.id || null, record?.id || null, `Reminder: ${randomItem(subjects)}`, 'Follow up required', formatDate(dueDate), randomItem(priorities), isCompleted ? 1 : 0, creator.id)
      counts.reminders++
    }

    // 14. Create Credentials (with properly encrypted values)
    const systems = ['Email Server', 'Database Server', 'Web Application', 'VPN Gateway', 'File Server', 'Backup System', 'Monitoring Tool', 'CRM System', 'ERP System', 'Project Management']
    for (let i = 0; i < opts.credentials; i++) {
      const id = uuidv4()
      const system = systems[i % systems.length]
      const category = randomItem(credentialCategories)

      // Generate a sample password and encrypt it properly
      const samplePassword = `SamplePass${i + 1}!@#`
      const { encrypted, iv, tag } = encryptPassword(samplePassword)

      db.prepare(`
        INSERT INTO credentials (id, system_name, username, encrypted_password, password_iv, password_tag, category, description, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, system, `admin_${i + 1}`, encrypted, iv, tag, category, `Credentials for ${system}`, userId)
      counts.credentials++
    }

    // 15. Create Secure References
    const refNames = ['Security Policy', 'IT Guidelines', 'Emergency Procedures', 'HR Manual', 'Safety Standards', 'Quality Manual', 'Training Curriculum', 'Compliance Checklist']
    for (let i = 0; i < opts.references; i++) {
      const id = uuidv4()
      const name = refNames[i % refNames.length]
      const category = randomItem(referenceCategories)

      db.prepare(`
        INSERT INTO secure_references (id, name, description, category, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, `${name} v${i + 1}`, `Reference document for ${name}`, category, userId)
      counts.secureReferences++
    }

    // Commit transaction
    db.exec('COMMIT')

    return {
      success: true,
      message: 'Database seeded successfully',
      counts
    }

  } catch (error: any) {
    // Rollback on error
    db.exec('ROLLBACK')
    return {
      success: false,
      message: 'Failed to seed database',
      counts,
      error: error.message
    }
  }
}

export async function clearAllData(userId: string): Promise<{ success: boolean; message: string; error?: string }> {
  const db = getDatabase()

  try {
    // Disable foreign key checks temporarily
    db.exec('PRAGMA foreign_keys = OFF')
    db.exec('BEGIN TRANSACTION')

    // Clear all data tables (order matters due to foreign keys)
    // First clear link/junction tables
    db.exec("DELETE FROM attendance_entry_conditions")
    db.exec("DELETE FROM record_linked_moms")
    db.exec("DELETE FROM record_linked_letters")
    db.exec("DELETE FROM mom_record_links")
    db.exec("DELETE FROM mom_topic_links")
    db.exec("DELETE FROM mom_letter_links")
    db.exec("DELETE FROM topic_tags")
    db.exec("DELETE FROM letter_references")
    db.exec("DELETE FROM letter_attachments")
    db.exec("DELETE FROM record_attachments")
    db.exec("DELETE FROM comment_edits")
    db.exec("DELETE FROM issue_history_records")

    // Then clear main data tables
    db.exec("DELETE FROM attendance_entries")
    db.exec("DELETE FROM reminders")
    db.exec("DELETE FROM email_schedule_instances")
    db.exec("DELETE FROM email_schedules")
    db.exec("DELETE FROM emails")
    db.exec("DELETE FROM mom_actions")
    db.exec("DELETE FROM mom_drafts")
    db.exec("DELETE FROM mom_history")
    db.exec("DELETE FROM moms")
    db.exec("DELETE FROM issue_history")
    db.exec("DELETE FROM issues")
    db.exec("DELETE FROM letter_drafts")
    db.exec("DELETE FROM letters")
    db.exec("DELETE FROM contacts")
    db.exec("DELETE FROM authorities")
    db.exec("DELETE FROM tags")
    db.exec("DELETE FROM records")
    db.exec("DELETE FROM subcategories")
    db.exec("DELETE FROM topics")
    db.exec("DELETE FROM secure_reference_files")
    db.exec("DELETE FROM secure_references")
    db.exec("DELETE FROM credentials")
    db.exec("DELETE FROM handovers")
    // Keep only active admin users (remove deleted admins and all non-admins)
    db.exec(`DELETE FROM users WHERE role != 'admin' OR deleted_at IS NOT NULL`)
    // Clear shift_id for remaining users before deleting shifts (to avoid FK issues)
    db.exec(`UPDATE users SET shift_id = NULL`)
    // Now safe to delete shifts and other config tables
    db.exec("DELETE FROM shifts")
    db.exec("DELETE FROM attendance_conditions")
    db.exec("DELETE FROM mom_locations")

    db.exec('COMMIT')
    // Re-enable foreign key checks
    db.exec('PRAGMA foreign_keys = ON')

    // Clear audit history
    const auditDb = getAuditDatabase()
    auditDb.exec('DELETE FROM audit_log')

    // Delete the audit checksum file to reset the chain
    const auditChecksumFile = path.join(getDataPath(), 'audit.checksum')
    if (fs.existsSync(auditChecksumFile)) {
      fs.unlinkSync(auditChecksumFile)
    }

    // Clear file storage directories
    const basePath = getBasePath()
    const dataPath = path.join(basePath, 'data')
    const emailsPath = getEmailsPath()

    let filesDeleted = 0

    // Clean all subdirectories in data/ folder (but keep .db files)
    if (fs.existsSync(dataPath)) {
      const entries = fs.readdirSync(dataPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dataPath, entry.name)
        // Skip database files
        if (entry.name.endsWith('.db') || entry.name.endsWith('.db-wal') || entry.name.endsWith('.db-shm')) {
          continue
        }
        // Delete directories and other files
        try {
          if (entry.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true })
            filesDeleted++
          } else {
            fs.unlinkSync(fullPath)
            filesDeleted++
          }
        } catch (err) {
          console.error(`Failed to delete ${fullPath}:`, err)
        }
      }
    }

    // Clean emails directory
    if (fs.existsSync(emailsPath)) {
      try {
        fs.rmSync(emailsPath, { recursive: true, force: true })
        fs.mkdirSync(emailsPath, { recursive: true })
        filesDeleted++
      } catch (err) {
        console.error(`Failed to clear emails directory:`, err)
      }
    }

    // Refresh database connection
    refreshDatabase()

    return {
      success: true,
      message: `All data cleared successfully. ${filesDeleted} storage items removed. Database refreshed.`
    }
  } catch (error: any) {
    db.exec('ROLLBACK')
    db.exec('PRAGMA foreign_keys = ON')
    return {
      success: false,
      message: 'Failed to clear seed data',
      error: error.message
    }
  }
}
