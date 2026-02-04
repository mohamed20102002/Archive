import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import { getDatabase } from '../database/connection'

// Lazy-loaded node-llama-cpp modules
let llamaModule: typeof import('node-llama-cpp') | null = null
let llamaInstance: any = null
let loadedModel: any = null
let loadedContext: any = null
let loadedSequence: any = null

let modelStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
let modelName: string | null = null
let modelError: string | null = null

type AiSummaryMode = 'brief' | 'actions' | 'status' | 'full'

function getModelsDirectory(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(process.cwd(), 'models')
  }
  return path.join(path.dirname(app.getPath('exe')), 'models')
}

function findModelFile(): string | null {
  const modelsDir = getModelsDirectory()
  if (!fs.existsSync(modelsDir)) {
    return null
  }

  const files = fs.readdirSync(modelsDir)
  const ggufFile = files.find(f => f.toLowerCase().endsWith('.gguf'))
  return ggufFile ? path.join(modelsDir, ggufFile) : null
}

export function getModelStatus(): { available: boolean; modelLoaded: boolean; modelName: string | null; error?: string } {
  const modelFile = findModelFile()
  return {
    available: modelFile !== null,
    modelLoaded: modelStatus === 'ready',
    modelName: modelName,
    error: modelError || (modelFile === null ? 'No .gguf model file found in models/ directory' : undefined)
  }
}

async function ensureModelLoaded(): Promise<void> {
  if (modelStatus === 'ready' && loadedModel && loadedContext) {
    return
  }

  if (modelStatus === 'loading') {
    // Wait for ongoing load
    while (modelStatus === 'loading') {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    if (modelStatus === 'ready') return
    throw new Error(modelError || 'Model failed to load')
  }

  const modelPath = findModelFile()
  if (!modelPath) {
    const modelsDir = getModelsDirectory()
    throw new Error(
      `No .gguf model file found. Please place a GGUF model file (e.g., Phi-3-mini-4k-instruct-q4.gguf) in: ${modelsDir}`
    )
  }

  modelStatus = 'loading'
  modelError = null

  try {
    if (!llamaModule) {
      llamaModule = await import('node-llama-cpp')
    }

    const { getLlama } = llamaModule
    if (!llamaInstance) {
      llamaInstance = await getLlama()
    }

    loadedModel = await llamaInstance.loadModel({ modelPath })
    loadedContext = await loadedModel.createContext()
    loadedSequence = loadedContext.getSequence()
    modelName = path.basename(modelPath)
    modelStatus = 'ready'

    console.log(`AI model loaded: ${modelName}`)
  } catch (err: any) {
    modelStatus = 'error'
    modelError = err.message || 'Failed to load model'
    loadedSequence = null
    loadedModel = null
    loadedContext = null
    console.error('Failed to load AI model:', err)
    throw new Error(`Failed to load AI model: ${modelError}`)
  }
}

interface TopicData {
  title: string
  description: string | null
  records: { type: string; title: string; content: string | null; created_at: string; creator_name: string | null }[]
  issues: { title: string; description: string | null; importance: string; status: string; reminder_date?: string | null }[]
  letters?: { subject: string; letter_type: string; status: string; due_date: string | null }[]
}

function buildTopicPrompt(topicData: TopicData, mode: AiSummaryMode): string {
  const { title, description, records, issues, letters } = topicData

  switch (mode) {
    case 'brief': {
      let prompt = `Write a 2-3 sentence overview of this project topic. Be concise.\n\n`
      prompt += `Topic: ${title}\n`
      if (description) {
        prompt += `Description: ${description}\n`
      }
      if (records.length > 0) {
        prompt += `\nRecords (${records.length} total):\n`
        for (const rec of records.slice(0, 15)) {
          prompt += `- [${rec.type}] ${rec.title}\n`
        }
        if (records.length > 15) {
          prompt += `(${records.length - 15} more records omitted)\n`
        }
      }
      prompt += `\nBrief overview:\n`
      return prompt
    }

    case 'actions': {
      let prompt = `List the next action items for this project topic. Focus on pending tasks, deadlines, and what needs attention.\n\n`
      prompt += `Topic: ${title}\n`
      if (description) {
        prompt += `Description: ${description}\n`
      }
      if (issues.length > 0) {
        prompt += `\nOpen Issues:\n`
        for (const issue of issues.slice(0, 15)) {
          prompt += `- [${issue.importance}] ${issue.title}`
          if (issue.reminder_date) {
            prompt += ` (reminder: ${issue.reminder_date})`
          }
          prompt += `\n`
        }
      }
      if (letters && letters.length > 0) {
        prompt += `\nPending Letters:\n`
        for (const letter of letters.slice(0, 10)) {
          prompt += `- [${letter.letter_type}/${letter.status}] ${letter.subject}`
          if (letter.due_date) {
            prompt += ` (due: ${letter.due_date})`
          }
          prompt += `\n`
        }
      }
      prompt += `\nList the next action items as a bullet list. Include deadlines where known:\n`
      return prompt
    }

    case 'status': {
      let prompt = `Write a status report for this topic's issues. Report which are open, completed, and need attention.\n\n`
      prompt += `Topic: ${title}\n`
      if (issues.length > 0) {
        prompt += `\nIssues:\n`
        for (const issue of issues.slice(0, 20)) {
          prompt += `- [${issue.status}] [${issue.importance}] ${issue.title}`
          if (issue.reminder_date) {
            prompt += ` (reminder: ${issue.reminder_date})`
          }
          prompt += `\n`
        }
      } else {
        prompt += `\nNo issues tracked for this topic.\n`
      }
      prompt += `\nStatus report:\n`
      return prompt
    }

    case 'full':
    default: {
      let prompt = `Summarize this project topic briefly. Use short bullet points. Do not repeat words.\n\n`
      prompt += `Topic: ${title}\n`
      if (description) {
        prompt += `Description: ${description}\n`
      }
      if (records.length > 0) {
        prompt += `\nRecords (${records.length} total):\n`
        for (const rec of records.slice(0, 30)) {
          prompt += `- [${rec.type}] ${rec.title}`
          if (rec.content) {
            const preview = rec.content.substring(0, 100).replace(/\n/g, ' ')
            prompt += ` — ${preview}`
          }
          prompt += `\n`
        }
        if (records.length > 30) {
          prompt += `(${records.length - 30} more records omitted)\n`
        }
      }
      if (issues.length > 0) {
        prompt += `\nOpen Issues (${issues.length}):\n`
        for (const issue of issues.slice(0, 10)) {
          prompt += `- [${issue.importance}] ${issue.title}\n`
        }
      }
      prompt += `\nWrite a short summary with these sections. Keep each section to 1-3 bullet points:\n1. Overview\n2. Key Activities\n3. Open Issues\n4. Status\n\nSummary:\n`
      return prompt
    }
  }
}

function getMaxTokensForMode(mode: AiSummaryMode): number {
  switch (mode) {
    case 'brief': return 128
    case 'actions': return 200
    case 'status': return 200
    case 'full': return 256
  }
}

export async function summarizeTopic(topicId: string, mode: AiSummaryMode = 'full'): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    await ensureModelLoaded()

    const db = getDatabase()

    // Fetch topic
    const topic = db.prepare(`
      SELECT id, title, description FROM topics WHERE id = ? AND deleted_at IS NULL
    `).get(topicId) as { id: string; title: string; description: string | null } | undefined

    if (!topic) {
      return { success: false, error: 'Topic not found' }
    }

    // For brief mode, only fetch record titles (no content)
    // For other modes, fetch full records
    const records = (mode === 'brief')
      ? db.prepare(`
          SELECT r.type, r.title, NULL as content, r.created_at, u.display_name as creator_name
          FROM records r
          LEFT JOIN users u ON r.created_by = u.id
          WHERE r.topic_id = ? AND r.deleted_at IS NULL
          ORDER BY r.created_at DESC
        `).all(topicId) as TopicData['records']
      : db.prepare(`
          SELECT r.type, r.title, r.content, r.created_at, u.display_name as creator_name
          FROM records r
          LEFT JOIN users u ON r.created_by = u.id
          WHERE r.topic_id = ? AND r.deleted_at IS NULL
          ORDER BY r.created_at DESC
        `).all(topicId) as TopicData['records']

    // Fetch issues — include reminder_date for actions/status modes
    const issues = db.prepare(`
      SELECT title, description, importance, status, reminder_date
      FROM issues
      WHERE topic_id = ?
      ORDER BY created_at DESC
    `).all(topicId) as TopicData['issues']

    // For actions mode, also fetch pending letters
    let letters: TopicData['letters'] | undefined
    if (mode === 'actions') {
      letters = db.prepare(`
        SELECT subject, letter_type, status, due_date
        FROM letters
        WHERE topic_id = ? AND deleted_at IS NULL AND status IN ('pending', 'in_progress')
        ORDER BY due_date ASC
      `).all(topicId) as TopicData['letters']
    }

    const prompt = buildTopicPrompt(
      { title: topic.title, description: topic.description, records, issues, letters },
      mode
    )

    // Run inference — reuse the persistent sequence, clearing it between calls
    const { LlamaChatSession } = llamaModule!

    // Clear any prior state from the sequence so it can be reused
    loadedSequence!.eraseContextTokenRanges([{ start: 0, end: loadedSequence!.tokenCount }])

    const session = new LlamaChatSession({ contextSequence: loadedSequence! })

    const response = await session.prompt(prompt, {
      maxTokens: getMaxTokensForMode(mode),
      temperature: 0.5,
      repeatPenalty: {
        penalty: 1.3,
        frequencyPenalty: 0.4,
        presencePenalty: 0.4,
        lastTokens: 64
      }
    })

    return { success: true, summary: response.trim() }
  } catch (err: any) {
    console.error('AI summarization error:', err)
    return { success: false, error: err.message || 'Failed to generate summary' }
  }
}

export function disposeModel(): void {
  try {
    if (loadedSequence) {
      loadedSequence.dispose()
      loadedSequence = null
    }
    if (loadedContext) {
      loadedContext.dispose()
      loadedContext = null
    }
    if (loadedModel) {
      loadedModel.dispose()
      loadedModel = null
    }
    modelStatus = 'idle'
    modelName = null
    modelError = null
    console.log('AI model disposed')
  } catch (err: any) {
    console.error('Error disposing AI model:', err)
  }
}
