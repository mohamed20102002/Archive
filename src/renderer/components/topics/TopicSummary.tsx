import React, { useState } from 'react'
import type { AiSummaryResult, AiSummaryMode } from '../../types'

const MODE_OPTIONS: { value: AiSummaryMode; label: string; description: string; loadingText: string }[] = [
  { value: 'brief', label: 'Brief Overview', description: 'Short 2-3 sentence overview', loadingText: 'Generating brief overview...' },
  { value: 'actions', label: 'Next Actions', description: 'Pending tasks & deadlines', loadingText: 'Finding action items...' },
  { value: 'status', label: 'Issue Status', description: 'Open/closed issue report', loadingText: 'Checking issue status...' },
  { value: 'full', label: 'Full Summary', description: 'Complete topic summary', loadingText: 'Generating full summary...' },
]

interface TopicSummaryProps {
  topicId: string
}

export function TopicSummary({ topicId }: TopicSummaryProps) {
  const [selectedMode, setSelectedMode] = useState<AiSummaryMode>('brief')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<AiSummaryResult | null>(null)
  const [resultMode, setResultMode] = useState<AiSummaryMode>('brief')
  const [isCollapsed, setIsCollapsed] = useState(false)

  const currentModeOption = MODE_OPTIONS.find(m => m.value === selectedMode)!
  const resultModeOption = MODE_OPTIONS.find(m => m.value === resultMode)!

  const handleGenerate = async (mode?: AiSummaryMode) => {
    const modeToUse = mode || selectedMode
    setIsGenerating(true)
    setResult(null)
    setIsCollapsed(false)

    try {
      const status = await window.electronAPI.ai.getStatus()
      if (!status.available) {
        setResult({
          success: false,
          error: status.error || 'AI model not available. Place a .gguf model file in the models/ directory.'
        })
        setResultMode(modeToUse)
        return
      }

      const response = await window.electronAPI.ai.summarize(topicId, modeToUse)
      setResult(response)
      setResultMode(modeToUse)
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || 'Failed to generate summary'
      })
      setResultMode(modeToUse)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div>
      {/* Idle State: mode dropdown + generate button */}
      {!result && !isGenerating && (
        <div className="flex items-center gap-2">
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as AiSummaryMode)}
            className="px-2 py-2 text-sm border border-purple-200 rounded-lg bg-white text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            {MODE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => handleGenerate()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
            title={currentModeOption.description}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Summary
          </button>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
          {currentModeOption.loadingText}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="mt-3">
          {result.success && result.summary ? (
            <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-purple-100 border-b border-purple-200">
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="flex items-center gap-2 text-sm font-medium text-purple-800"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  AI Summary: {resultModeOption.label}
                </button>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value as AiSummaryMode)}
                    className="px-1.5 py-1 text-xs border border-purple-200 rounded bg-white text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-300"
                  >
                    {MODE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleGenerate()}
                    className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-200 rounded"
                    title="Regenerate"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setResult(null)}
                    className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-200 rounded"
                    title="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {!isCollapsed && (
                <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {result.summary}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-red-800">Summary generation failed</p>
                  <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  {result.error?.includes('models/') && (
                    <p className="text-xs text-red-500 mt-2">
                      Download a GGUF model (e.g., Phi-3-mini-4k-instruct-q4.gguf) and place it in the <code className="bg-red-100 px-1 rounded">models/</code> directory next to the application.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="p-1 text-red-400 hover:text-red-600 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => handleGenerate()}
                className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
