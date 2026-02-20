/**
 * Highlighted Text Component
 *
 * Renders text with highlighted search term matches.
 * Supports both client-side and server-side highlighting.
 */

import React, { useMemo } from 'react'

interface HighlightSegment {
  text: string
  highlighted: boolean
}

interface HighlightedTextProps {
  text: string
  searchTerms?: string[]
  segments?: HighlightSegment[]
  maxLength?: number
  highlightClassName?: string
  className?: string
}

/**
 * Client-side highlight matching
 */
function highlightMatchesClient(
  text: string,
  searchTerms: string[],
  maxLength: number = 200
): HighlightSegment[] {
  if (!text || !searchTerms || searchTerms.length === 0) {
    return [{ text: text?.substring(0, maxLength) || '', highlighted: false }]
  }

  // Normalize terms
  const normalizedTerms = searchTerms
    .map(t => t.toLowerCase().replace(/['"]/g, '').trim())
    .filter(t => t.length > 0)

  if (normalizedTerms.length === 0) {
    return [{ text: text.substring(0, maxLength), highlighted: false }]
  }

  // Find the first match position for context
  const lowerText = text.toLowerCase()
  let firstMatchPos = -1

  for (const term of normalizedTerms) {
    const pos = lowerText.indexOf(term)
    if (pos !== -1 && (firstMatchPos === -1 || pos < firstMatchPos)) {
      firstMatchPos = pos
    }
  }

  // Extract context around first match
  let startPos = 0
  let extractedText = text

  if (firstMatchPos > 50) {
    startPos = firstMatchPos - 40
    extractedText = '...' + text.substring(startPos)
  }

  if (extractedText.length > maxLength) {
    extractedText = extractedText.substring(0, maxLength) + '...'
  }

  // Build highlighted segments
  const segments: HighlightSegment[] = []
  const lowerExtracted = extractedText.toLowerCase()
  let currentPos = 0

  // Create a map of all match positions
  const matches: { start: number; end: number }[] = []

  for (const term of normalizedTerms) {
    let searchPos = 0
    while (searchPos < lowerExtracted.length) {
      const pos = lowerExtracted.indexOf(term, searchPos)
      if (pos === -1) break

      matches.push({ start: pos, end: pos + term.length })
      searchPos = pos + 1
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start)

  // Merge overlapping matches
  const mergedMatches: { start: number; end: number }[] = []
  for (const match of matches) {
    if (mergedMatches.length === 0) {
      mergedMatches.push({ start: match.start, end: match.end })
    } else {
      const last = mergedMatches[mergedMatches.length - 1]
      if (match.start <= last.end) {
        last.end = Math.max(last.end, match.end)
      } else {
        mergedMatches.push({ start: match.start, end: match.end })
      }
    }
  }

  // Build segments
  for (const match of mergedMatches) {
    if (match.start > currentPos) {
      segments.push({
        text: extractedText.substring(currentPos, match.start),
        highlighted: false
      })
    }
    segments.push({
      text: extractedText.substring(match.start, match.end),
      highlighted: true
    })
    currentPos = match.end
  }

  if (currentPos < extractedText.length) {
    segments.push({
      text: extractedText.substring(currentPos),
      highlighted: false
    })
  }

  return segments.length > 0 ? segments : [{ text: extractedText, highlighted: false }]
}

/**
 * HighlightedText Component
 *
 * Renders text with matching search terms highlighted.
 *
 * Can receive either:
 * - `segments` prop: Pre-computed segments from the server
 * - `searchTerms` prop: Terms to highlight client-side
 */
export function HighlightedText({
  text,
  searchTerms,
  segments,
  maxLength = 200,
  highlightClassName = 'bg-yellow-200 dark:bg-yellow-900/50 text-gray-900 dark:text-yellow-200 px-0.5 rounded',
  className = ''
}: HighlightedTextProps) {
  // Compute segments (prefer pre-computed segments)
  const computedSegments = useMemo(() => {
    if (segments && segments.length > 0) {
      return segments
    }
    if (searchTerms && searchTerms.length > 0) {
      return highlightMatchesClient(text, searchTerms, maxLength)
    }
    return [{ text: text?.substring(0, maxLength) || '', highlighted: false }]
  }, [text, searchTerms, segments, maxLength])

  return (
    <span className={className}>
      {computedSegments.map((segment, index) =>
        segment.highlighted ? (
          <mark key={index} className={highlightClassName}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </span>
  )
}

/**
 * Hook for getting highlighted segments
 */
export function useHighlightedText(
  text: string,
  searchTerms: string[],
  maxLength: number = 200
): HighlightSegment[] {
  return useMemo(() => {
    return highlightMatchesClient(text, searchTerms, maxLength)
  }, [text, searchTerms, maxLength])
}

export default HighlightedText
