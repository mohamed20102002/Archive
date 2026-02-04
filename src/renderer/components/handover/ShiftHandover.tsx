import React, { useState, useEffect } from 'react'
import { HandoverDatePicker } from './HandoverDatePicker'
import { HandoverSummary } from './HandoverSummary'
import { HandoverRecordList } from './HandoverRecordList'
import { HandoverArchive } from './HandoverArchive'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { HandoverRecord, WeekInfo } from '../../types'

type ViewMode = 'card' | 'table'

export function ShiftHandover() {
  const { user } = useAuth()
  const { success, error } = useToast()

  const [weekOffset, setWeekOffset] = useState(0)
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null)
  const [records, setRecords] = useState<HandoverRecord[]>([])
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')

  // Summary data
  const [summary, setSummary] = useState<{
    recordCount: number
    editors: string[]
    topics: Array<{ id: string; title: string }>
  }>({ recordCount: 0, editors: [], topics: [] })

  const loadWeekData = async (offset: number) => {
    setIsLoading(true)
    try {
      // Get week info
      const info = await window.electronAPI.handover.getWeekInfo(offset) as WeekInfo
      setWeekInfo(info)

      // Get records for this week
      const weekRecords = await window.electronAPI.handover.getRecords(
        info.startDate,
        info.endDate
      ) as HandoverRecord[]
      setRecords(weekRecords)

      // Get summary
      const summaryData = await window.electronAPI.handover.getSummary(weekRecords) as typeof summary
      setSummary(summaryData)

      // Reset excluded IDs when changing weeks
      setExcludedIds(new Set())
    } catch (err) {
      console.error('Error loading week data:', err)
      error('Failed to load handover data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWeekData(weekOffset)
  }, [weekOffset])

  const handlePrevWeek = () => {
    setWeekOffset(prev => prev - 1)
  }

  const handleNextWeek = () => {
    if (weekOffset < 0) {
      setWeekOffset(prev => prev + 1)
    }
  }

  const handleToggleExclude = (recordId: string) => {
    setExcludedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(recordId)) {
        newSet.delete(recordId)
      } else {
        newSet.add(recordId)
      }
      return newSet
    })
  }

  const handleExport = async (replaceExisting: boolean = false) => {
    if (!user || !weekInfo) return

    const includedRecords = records.filter(r => !excludedIds.has(r.record_id))

    if (includedRecords.length === 0) {
      error('No records to export', 'Please include at least one record')
      return
    }

    setIsExporting(true)
    try {
      const result = await window.electronAPI.handover.export(
        includedRecords,
        weekInfo,
        user.id,
        replaceExisting
      )

      if (result.success) {
        success(
          'Handover exported',
          `Shift ${weekInfo.weekNumber} handover saved with ${includedRecords.length} records`
        )
      } else if (result.error === 'HANDOVER_EXISTS') {
        // Show confirmation dialog for existing handover
        const existing = result.existingHandover as any
        const confirmReplace = confirm(
          `A handover report for Shift ${weekInfo.weekNumber}, ${weekInfo.year} already exists.\n\n` +
          `Created: ${new Date(existing.created_at).toLocaleDateString()}\n` +
          `Records: ${existing.record_count}\n\n` +
          `Do you want to replace it with the new report?`
        )

        if (confirmReplace) {
          // Re-export with replace flag
          await handleExport(true)
        }
      } else {
        error('Export failed', result.error)
      }
    } catch (err: any) {
      error('Export failed', err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const includedCount = records.length - excludedIds.size

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-archive-light px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shift Handover</h1>
            <p className="text-sm text-gray-500 mt-1">
              Generate weekly handover reports for shift transitions
            </p>
          </div>
          <button
            onClick={() => setShowArchive(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            View Archives
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
      {isLoading || !weekInfo ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Date Picker */}
          <div className="card p-4">
            <HandoverDatePicker
              weekInfo={weekInfo}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              isCurrentWeek={weekOffset === 0}
            />
          </div>

          {/* Summary */}
          <HandoverSummary
            recordCount={summary.recordCount}
            editors={summary.editors}
            topics={summary.topics}
          />

          {/* Records Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Records
                  {excludedIds.size > 0 && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({includedCount} of {records.length} selected)
                    </span>
                  )}
                </h2>
                {/* View Toggle */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-2 ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    title="Card View"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    title="Table View"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                onClick={() => handleExport()}
                disabled={isExporting || includedCount === 0}
                className="btn-primary flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Export to Word</span>
                  </>
                )}
              </button>
            </div>

            <HandoverRecordList
              records={records}
              excludedIds={excludedIds}
              onToggleExclude={handleToggleExclude}
              viewMode={viewMode}
            />
          </div>
        </>
      )}
      </div>

      {/* Archive Modal */}
      {showArchive && (
        <HandoverArchive onClose={() => setShowArchive(false)} />
      )}
    </div>
  )
}
