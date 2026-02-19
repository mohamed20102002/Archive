import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from './StatCard'
import { ActivityChart } from './ActivityChart'
import { RecentActivity } from './RecentActivity'

interface DashboardStats {
  topics: { total: number; active: number; archived: number }
  issues: { open: number; overdue: number; closedThisMonth: number }
  reminders: { pending: number; overdue: number; upcoming: number }
  letters: { total: number; pending: number; overdue: number }
  moms: { total: number; open: number; closed: number }
  records: { total: number; thisWeek: number; thisMonth: number }
  secureResources: { credentials: number; references: number }
  attendance: { presentToday: number; totalUsers: number }
}

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const result = await window.electronAPI.dashboard.getStats()
      setStats(result as DashboardStats)
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        Failed to load dashboard data
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Overview of your project data archive</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Topics"
          value={stats.topics.total}
          subtitle={`${stats.topics.active} active, ${stats.topics.archived} archived`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          color="blue"
          onClick={() => navigate('/topics')}
        />

        <StatCard
          title="Open Issues"
          value={stats.issues.open}
          subtitle={`${stats.issues.closedThisMonth} closed this month`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          }
          color="red"
          onClick={() => navigate('/issues')}
          badge={stats.issues.overdue > 0 ? { value: stats.issues.overdue, label: 'overdue', type: 'danger' } : undefined}
        />

        <StatCard
          title="Pending Reminders"
          value={stats.reminders.pending}
          subtitle={`${stats.reminders.upcoming} due this week`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="yellow"
          onClick={() => navigate('/reminders')}
          badge={stats.reminders.overdue > 0 ? { value: stats.reminders.overdue, label: 'overdue', type: 'danger' } : undefined}
        />

        <StatCard
          title="Letters"
          value={stats.letters.total}
          subtitle={`${stats.letters.pending} pending`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          color="green"
          onClick={() => navigate('/letters')}
          badge={stats.letters.overdue > 0 ? { value: stats.letters.overdue, label: 'overdue', type: 'warning' } : undefined}
        />

        <StatCard
          title="MOMs"
          value={stats.moms.total}
          subtitle={`${stats.moms.open} open, ${stats.moms.closed} closed`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          color="purple"
          onClick={() => navigate('/mom')}
        />

        <StatCard
          title="Records"
          value={stats.records.total}
          subtitle={`${stats.records.thisWeek} this week, ${stats.records.thisMonth} this month`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          color="blue"
        />

        <StatCard
          title="Secure Resources"
          value={stats.secureResources.credentials + stats.secureResources.references}
          subtitle={`${stats.secureResources.credentials} credentials, ${stats.secureResources.references} references`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
          color="gray"
          onClick={() => navigate('/secure-resources')}
        />

        <StatCard
          title="Attendance Today"
          value={`${stats.attendance.presentToday}/${stats.attendance.totalUsers}`}
          subtitle="Users checked in"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          color="green"
          onClick={() => navigate('/attendance')}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityChart />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
