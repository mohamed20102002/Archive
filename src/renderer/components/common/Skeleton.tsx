import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rectangular' | 'circular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700'

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%]',
    none: ''
  }

  const variantClasses = {
    text: 'rounded h-4',
    rectangular: '',
    circular: 'rounded-full',
    rounded: 'rounded-lg'
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  )
}

// Card skeleton for list items
export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
      </div>
    </div>
  )
}

// Table row skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton variant="text" width={i === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  )
}

// List skeleton
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// Page skeleton for full page loading
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="text" width={300} height={16} />
        </div>
        <Skeleton variant="rounded" width={120} height={40} />
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Skeleton variant="rounded" width={200} height={40} />
        <Skeleton variant="rounded" width={150} height={40} />
        <Skeleton variant="rounded" width={150} height={40} />
      </div>

      {/* Content cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <Skeleton variant="text" width="40%" height={16} />
            <Skeleton variant="text" width="60%" height={32} className="mt-2" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <Skeleton variant="text" width="30%" height={20} />
          <Skeleton variant="rounded" height={200} className="mt-4" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <Skeleton variant="text" width="30%" height={20} />
          <Skeleton variant="rounded" height={200} className="mt-4" />
        </div>
      </div>
    </div>
  )
}

// Timeline skeleton for record timeline
export function TimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {/* Timeline indicator */}
          <div className="flex flex-col items-center">
            <Skeleton variant="circular" width={12} height={12} />
            {i < count - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-2" />
            )}
          </div>
          {/* Content card */}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
            <div className="flex items-center justify-between mb-3">
              <Skeleton variant="text" width="30%" height={14} />
              <Skeleton variant="text" width="15%" height={14} />
            </div>
            <Skeleton variant="text" width="80%" height={20} className="mb-2" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="60%" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Form skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton variant="text" width="20%" height={14} className="mb-1" />
          <Skeleton variant="rounded" width="100%" height={40} />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton variant="rounded" width={100} height={40} />
        <Skeleton variant="rounded" width={80} height={40} />
      </div>
    </div>
  )
}

// Detail page skeleton
export function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton variant="text" width={60} height={14} />
        <Skeleton variant="text" width={8} height={14} />
        <Skeleton variant="text" width={80} height={14} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={300} height={32} />
          <div className="flex items-center gap-3">
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="text" width={120} height={14} />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rounded" width={36} height={36} />
          <Skeleton variant="rounded" width={36} height={36} />
          <Skeleton variant="rounded" width={100} height={36} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        <Skeleton variant="text" width={80} height={20} />
        <Skeleton variant="text" width={80} height={20} />
        <Skeleton variant="text" width={80} height={20} />
      </div>

      {/* Content */}
      <TimelineSkeleton count={3} />
    </div>
  )
}

// Stats card skeleton
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Skeleton variant="text" width="50%" height={14} />
            <Skeleton variant="circular" width={32} height={32} />
          </div>
          <Skeleton variant="text" width="40%" height={28} className="mt-2" />
          <Skeleton variant="text" width="60%" height={12} className="mt-1" />
        </div>
      ))}
    </div>
  )
}

// Table skeleton with header
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} variant="text" width={`${100 / columns}%`} height={14} />
          ))}
        </div>
      </div>
      {/* Rows */}
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Suspense fallback component
export function SuspenseFallback({ type = 'page' }: { type?: 'page' | 'list' | 'dashboard' | 'detail' | 'form' | 'timeline' }) {
  switch (type) {
    case 'dashboard':
      return <DashboardSkeleton />
    case 'list':
      return (
        <div className="p-6">
          <ListSkeleton count={8} />
        </div>
      )
    case 'detail':
      return <DetailSkeleton />
    case 'form':
      return (
        <div className="p-6 max-w-2xl">
          <FormSkeleton fields={6} />
        </div>
      )
    case 'timeline':
      return (
        <div className="p-6">
          <TimelineSkeleton count={5} />
        </div>
      )
    case 'page':
    default:
      return <PageSkeleton />
  }
}

export default Skeleton
