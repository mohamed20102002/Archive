import React, { useCallback, CSSProperties } from 'react'
import { useVirtualScroll, VirtualItem } from '../../hooks/useVirtualScroll'

export interface VirtualListProps<T> {
  items: T[]
  itemHeight: number | ((index: number) => number)
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode
  className?: string
  containerClassName?: string
  overscan?: number
  getItemKey?: (item: T, index: number) => string | number
  onScrollEnd?: () => void
  scrollEndThreshold?: number
  emptyMessage?: string
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  className = '',
  containerClassName = '',
  overscan = 5,
  getItemKey,
  onScrollEnd,
  scrollEndThreshold = 200,
  emptyMessage = 'No items to display'
}: VirtualListProps<T>) {
  const {
    virtualItems,
    totalHeight,
    scrollContainerRef,
    isScrolling
  } = useVirtualScroll({
    itemCount: items.length,
    itemHeight,
    overscan
  })

  // Handle scroll end detection
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!onScrollEnd) return

    const target = e.currentTarget
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight

    if (scrollBottom < scrollEndThreshold) {
      onScrollEnd()
    }
  }, [onScrollEnd, scrollEndThreshold])

  // Get item key
  const getKey = useCallback((item: T, index: number): string | number => {
    if (getItemKey) return getItemKey(item, index)
    // Try common key patterns
    const anyItem = item as any
    return anyItem.id || anyItem.key || index
  }, [getItemKey])

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 text-gray-500 ${className}`}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`overflow-auto ${containerClassName}`}
      onScroll={handleScroll}
      style={{ contain: 'strict' }}
    >
      <div
        className={`relative ${className}`}
        style={{ height: totalHeight, width: '100%' }}
      >
        {virtualItems.map((virtualItem: VirtualItem) => {
          const item = items[virtualItem.index]
          const style: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start}px)`,
            willChange: isScrolling ? 'transform' : undefined
          }

          return (
            <div key={getKey(item, virtualItem.index)} style={style}>
              {renderItem(item, virtualItem.index, {})}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Simplified grid version for card layouts
export interface VirtualGridProps<T> {
  items: T[]
  itemHeight: number
  columns: number
  gap?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  containerClassName?: string
  overscan?: number
  getItemKey?: (item: T, index: number) => string | number
  emptyMessage?: string
}

export function VirtualGrid<T>({
  items,
  itemHeight,
  columns,
  gap = 16,
  renderItem,
  className = '',
  containerClassName = '',
  overscan = 3,
  getItemKey,
  emptyMessage = 'No items to display'
}: VirtualGridProps<T>) {
  const rowCount = Math.ceil(items.length / columns)
  const rowHeight = itemHeight + gap

  const {
    virtualItems,
    totalHeight,
    scrollContainerRef,
    isScrolling
  } = useVirtualScroll({
    itemCount: rowCount,
    itemHeight: rowHeight,
    overscan
  })

  // Get item key
  const getKey = useCallback((item: T, index: number): string | number => {
    if (getItemKey) return getItemKey(item, index)
    const anyItem = item as any
    return anyItem.id || anyItem.key || index
  }, [getItemKey])

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 text-gray-500 ${className}`}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`overflow-auto ${containerClassName}`}
      style={{ contain: 'strict' }}
    >
      <div
        className={`relative ${className}`}
        style={{ height: totalHeight, width: '100%' }}
      >
        {virtualItems.map((virtualRow) => {
          const rowIndex = virtualRow.index
          const startItemIndex = rowIndex * columns
          const rowItems = items.slice(startItemIndex, startItemIndex + columns)

          const style: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: itemHeight,
            transform: `translateY(${virtualRow.start}px)`,
            willChange: isScrolling ? 'transform' : undefined,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: gap
          }

          return (
            <div key={`row-${rowIndex}`} style={style}>
              {rowItems.map((item, colIndex) => {
                const itemIndex = startItemIndex + colIndex
                return (
                  <div key={getKey(item, itemIndex)}>
                    {renderItem(item, itemIndex)}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VirtualList
