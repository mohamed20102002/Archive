import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface MonthlyData {
  month: number
  records: number
  issues: number
  letters: number
  moms: number
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function ActivityChart() {
  const [data, setData] = useState<MonthlyData[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [year])

  async function loadData() {
    setLoading(true)
    try {
      const result = await window.electronAPI.dashboard.getActivityByMonth(year)
      setData(result as MonthlyData[])
    } catch (error) {
      console.error('Error loading activity data:', error)
    } finally {
      setLoading(false)
    }
  }

  const chartData = data.map(d => ({
    ...d,
    name: monthNames[d.month - 1]
  }))

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Activity Overview</h3>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="input py-1 px-2 text-sm"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="name"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg, white)',
                  border: '1px solid var(--tooltip-border, #e5e7eb)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="records"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Records"
              />
              <Line
                type="monotone"
                dataKey="issues"
                stroke="#EF4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Issues"
              />
              <Line
                type="monotone"
                dataKey="letters"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Letters"
              />
              <Line
                type="monotone"
                dataKey="moms"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="MOMs"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
