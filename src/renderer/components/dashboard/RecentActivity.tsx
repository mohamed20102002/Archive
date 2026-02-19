import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'

interface Activity {
  id: string
  type: 'record' | 'issue' | 'letter' | 'mom' | 'reminder'
  title: string
  action: string
  created_at: string
  creator_name?: string
  topic_id?: string
  entity_id?: string
}

const typeIcons: Record<string, React.ReactNode> = {
  record: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  issue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  letter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  mom: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  reminder: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const typeColors: Record<string, string> = {
  record: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  issue: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  letter: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  mom: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  reminder: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
}

export function RecentActivity() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
  }, [])

  async function loadActivities() {
    try {
      const result = await window.electronAPI.dashboard.getRecentActivity(15)
      setActivities(result as Activity[])
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleActivityClick = (activity: Activity) => {
    // Build highlight state to pass to destination
    const highlightState = {
      highlightType: activity.type,
      highlightId: activity.entity_id || activity.id,
      highlightParentId: activity.topic_id
    }

    switch (activity.type) {
      case 'record':
        if (activity.topic_id) {
          navigate(`/topics/${activity.topic_id}`, { state: highlightState })
        }
        break
      case 'issue':
        navigate('/issues', { state: highlightState })
        break
      case 'letter':
        navigate('/letters', { state: highlightState })
        break
      case 'mom':
        navigate('/mom', { state: highlightState })
        break
      case 'reminder':
        navigate('/reminders', { state: highlightState })
        break
    }
  }

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : activities.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No recent activity
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {activities.map((activity) => (
            <li
              key={`${activity.type}-${activity.id}`}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => handleActivityClick(activity)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${typeColors[activity.type]}`}>
                  {typeIcons[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {activity.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activity.action}
                    {activity.creator_name && ` by ${activity.creator_name}`}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
