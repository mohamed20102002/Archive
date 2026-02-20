import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

export interface VirtualScrollOptions {
  itemCount: number
  itemHeight: number | ((index: number) => number)
  overscan?: number
  containerHeight?: number
}

export interface VirtualScrollResult {
  virtualItems: VirtualItem[]
  totalHeight: number
  scrollContainerRef: React.RefObject<HTMLDivElement>
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void
  isScrolling: boolean
}

export interface VirtualItem {
  index: number
  start: number
  size: number
  end: number
}

export function useVirtualScroll({
  itemCount,
  itemHeight,
  overscan = 3,
  containerHeight: fixedContainerHeight
}: VirtualScrollOptions): VirtualScrollResult {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(fixedContainerHeight || 400)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Calculate item heights and positions
  const { itemOffsets, totalHeight } = useMemo(() => {
    const offsets: number[] = []
    let totalH = 0

    for (let i = 0; i < itemCount; i++) {
      offsets.push(totalH)
      const height = typeof itemHeight === 'function' ? itemHeight(i) : itemHeight
      totalH += height
    }

    return { itemOffsets: offsets, totalHeight: totalH }
  }, [itemCount, itemHeight])

  // Get item height for a specific index
  const getItemHeight = useCallback((index: number): number => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight
  }, [itemHeight])

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    if (itemCount === 0) return { startIndex: 0, endIndex: 0 }

    // Binary search to find start index
    let start = 0
    let end = itemCount - 1

    while (start <= end) {
      const mid = Math.floor((start + end) / 2)
      const offset = itemOffsets[mid]
      const height = getItemHeight(mid)

      if (offset + height < scrollTop) {
        start = mid + 1
      } else if (offset > scrollTop) {
        end = mid - 1
      } else {
        start = mid
        break
      }
    }

    const startIdx = Math.max(0, start - overscan)

    // Find end index
    let endIdx = startIdx
    let currentHeight = itemOffsets[endIdx] || 0

    while (endIdx < itemCount && currentHeight < scrollTop + containerHeight) {
      currentHeight += getItemHeight(endIdx)
      endIdx++
    }

    endIdx = Math.min(itemCount - 1, endIdx + overscan)

    return { startIndex: startIdx, endIndex: endIdx }
  }, [scrollTop, containerHeight, itemCount, itemOffsets, getItemHeight, overscan])

  // Generate virtual items
  const virtualItems: VirtualItem[] = useMemo(() => {
    const items: VirtualItem[] = []

    for (let i = startIndex; i <= endIndex; i++) {
      const size = getItemHeight(i)
      items.push({
        index: i,
        start: itemOffsets[i] || 0,
        size,
        end: (itemOffsets[i] || 0) + size
      })
    }

    return items
  }, [startIndex, endIndex, itemOffsets, getItemHeight])

  // Handle scroll events
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      setScrollTop(container.scrollTop)
      setIsScrolling(true)

      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current)
      }

      scrollingTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 150)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current)
      }
    }
  }, [])

  // Handle container resize
  useEffect(() => {
    if (fixedContainerHeight) {
      setContainerHeight(fixedContainerHeight)
      return
    }

    const container = scrollContainerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })

    resizeObserver.observe(container)
    setContainerHeight(container.clientHeight)

    return () => {
      resizeObserver.disconnect()
    }
  }, [fixedContainerHeight])

  // Scroll to index function
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    const container = scrollContainerRef.current
    if (!container || index < 0 || index >= itemCount) return

    const itemOffset = itemOffsets[index] || 0
    const itemSize = getItemHeight(index)

    let scrollTarget: number

    switch (align) {
      case 'center':
        scrollTarget = itemOffset - containerHeight / 2 + itemSize / 2
        break
      case 'end':
        scrollTarget = itemOffset - containerHeight + itemSize
        break
      case 'start':
      default:
        scrollTarget = itemOffset
    }

    container.scrollTop = Math.max(0, Math.min(scrollTarget, totalHeight - containerHeight))
  }, [itemCount, itemOffsets, getItemHeight, containerHeight, totalHeight])

  return {
    virtualItems,
    totalHeight,
    scrollContainerRef,
    scrollToIndex,
    isScrolling
  }
}
