/**
 * Seed Script - Fills database with random topics and records
 *
 * Usage: node scripts/seed-data.js [topicCount] [recordsPerTopic]
 * Example: node scripts/seed-data.js 10 20
 */

const Database = require('better-sqlite3')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const os = require('os')

// Database path
const dbPath = path.join(os.homedir(), 'project-archive', 'archive.db')

// Sample data for random generation
const topicPrefixes = [
  'Project', 'Report', 'Analysis', 'Review', 'Study', 'Research',
  'Investigation', 'Assessment', 'Evaluation', 'Survey', 'Audit',
  'Inspection', 'Documentation', 'Specification', 'Proposal', 'Plan'
]

const topicSubjects = [
  'Safety', 'Quality', 'Performance', 'Maintenance', 'Operations',
  'Training', 'Compliance', 'Environmental', 'Security', 'Emergency',
  'Equipment', 'Procedure', 'System', 'Process', 'Material', 'Personnel'
]

const topicSuffixes = [
  '2024', '2025', 'Q1', 'Q2', 'Q3', 'Q4', 'Phase 1', 'Phase 2',
  'Initial', 'Final', 'Draft', 'Revised', 'Updated', 'Annual', 'Monthly'
]

const recordTitles = [
  'Meeting Minutes', 'Technical Report', 'Incident Report', 'Progress Update',
  'Status Report', 'Analysis Document', 'Review Summary', 'Action Items',
  'Correspondence', 'Memo', 'Letter', 'Email Thread', 'Notes', 'Guidelines',
  'Checklist', 'Procedure Document', 'Work Order', 'Request Form',
  'Approval Document', 'Certificate', 'Permit', 'License', 'Agreement',
  'Contract', 'Invoice', 'Receipt', 'Specification', 'Drawing', 'Diagram'
]

const recordContents = [
  'This document contains important information regarding the ongoing activities.',
  'Summary of key findings and recommendations from the recent review.',
  'Detailed analysis of the current situation with proposed solutions.',
  'Follow-up actions required based on the previous discussion.',
  'Documentation of the inspection results and observations.',
  'Record of communications and decisions made during the meeting.',
  'Technical specifications and requirements for the project.',
  'Status update on the progress of ongoing tasks and milestones.',
  'Compliance verification and audit findings summary.',
  'Risk assessment and mitigation strategies document.'
]

const subcategoryNames = [
  'General', 'Technical', 'Administrative', 'Correspondence', 'Reports',
  'Meetings', 'Approvals', 'Reviews', 'Audits', 'Training'
]

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return date.toISOString()
}

function generateTopicTitle() {
  return `${randomItem(topicPrefixes)} ${randomItem(topicSubjects)} ${randomItem(topicSuffixes)}`
}

function generateRecordTitle() {
  const num = Math.floor(Math.random() * 1000) + 1
  return `${randomItem(recordTitles)} #${num}`
}

function generateRecordContent() {
  const paragraphs = Math.floor(Math.random() * 3) + 1
  let content = ''
  for (let i = 0; i < paragraphs; i++) {
    content += randomItem(recordContents) + '\n\n'
  }
  return content.trim()
}

async function seedDatabase(topicCount = 10, recordsPerTopic = 15) {
  console.log(`\nOpening database at: ${dbPath}`)

  const db = new Database(dbPath)

  // Get admin user ID (or first user)
  const user = db.prepare('SELECT id FROM users LIMIT 1').get()
  if (!user) {
    console.error('Error: No users found in database. Please create a user first.')
    db.close()
    return
  }
  const userId = user.id
  console.log(`Using user ID: ${userId}`)

  const now = new Date()
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

  console.log(`\nCreating ${topicCount} topics with ~${recordsPerTopic} records each...`)
  console.log('=' .repeat(50))

  let totalRecords = 0
  let totalSubcategories = 0

  const insertTopic = db.prepare(`
    INSERT INTO topics (id, title, description, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const insertSubcategory = db.prepare(`
    INSERT INTO subcategories (id, topic_id, title, description, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertRecord = db.prepare(`
    INSERT INTO records (id, topic_id, subcategory_id, title, content, reference_number, source, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (let t = 0; t < topicCount; t++) {
      const topicId = uuidv4()
      const topicTitle = generateTopicTitle()
      const topicDate = randomDate(oneYearAgo, now)

      insertTopic.run(
        topicId,
        topicTitle,
        `Description for ${topicTitle}. This topic contains related documents and records.`,
        userId,
        topicDate,
        topicDate
      )

      console.log(`\n[${t + 1}/${topicCount}] Created topic: ${topicTitle}`)

      // Create 2-4 subcategories for each topic
      const subcategoryCount = Math.floor(Math.random() * 3) + 2
      const subcategories = []

      for (let s = 0; s < subcategoryCount; s++) {
        const subcategoryId = uuidv4()
        const subcategoryTitle = subcategoryNames[s % subcategoryNames.length]
        const subcategoryDate = randomDate(new Date(topicDate), now)

        insertSubcategory.run(
          subcategoryId,
          topicId,
          subcategoryTitle,
          `${subcategoryTitle} documents for this topic`,
          userId,
          subcategoryDate,
          subcategoryDate
        )

        subcategories.push(subcategoryId)
        totalSubcategories++
      }

      console.log(`   Created ${subcategoryCount} subcategories`)

      // Create records for this topic
      const actualRecordCount = recordsPerTopic + Math.floor(Math.random() * 10) - 5

      for (let r = 0; r < actualRecordCount; r++) {
        const recordId = uuidv4()
        const recordTitle = generateRecordTitle()
        const recordDate = randomDate(new Date(topicDate), now)
        const refNum = `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

        // Randomly assign to a subcategory or no subcategory
        const subcategoryId = Math.random() > 0.3 ? randomItem(subcategories) : null

        insertRecord.run(
          recordId,
          topicId,
          subcategoryId,
          recordTitle,
          generateRecordContent(),
          refNum,
          randomItem(['Internal', 'External', 'Email', 'Meeting', 'Report']),
          userId,
          recordDate,
          recordDate
        )

        totalRecords++
      }

      console.log(`   Created ${actualRecordCount} records`)
    }
  })

  try {
    transaction()
    console.log('\n' + '=' .repeat(50))
    console.log('Seeding completed successfully!')
    console.log(`Total topics created: ${topicCount}`)
    console.log(`Total subcategories created: ${totalSubcategories}`)
    console.log(`Total records created: ${totalRecords}`)
  } catch (error) {
    console.error('Error seeding database:', error)
  } finally {
    db.close()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const topicCount = parseInt(args[0]) || 10
const recordsPerTopic = parseInt(args[1]) || 15

console.log('\n========================================')
console.log('   Database Seed Script')
console.log('========================================')
console.log(`Topics to create: ${topicCount}`)
console.log(`Records per topic: ~${recordsPerTopic}`)

seedDatabase(topicCount, recordsPerTopic)
