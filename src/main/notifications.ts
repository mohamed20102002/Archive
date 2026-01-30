import { Notification, app } from 'electron'
import { getOverdueReminders, getUpcomingReminders } from './services/reminder.service'
import { getIssuesWithDueReminders, markReminderNotified } from './services/issue.service'

let notificationInterval: NodeJS.Timeout | null = null
let lastNotifiedReminders: Set<string> = new Set()

export function startReminderNotifications(): void {
  if (notificationInterval) {
    return
  }

  // Check reminders every 5 minutes
  notificationInterval = setInterval(checkReminders, 5 * 60 * 1000)

  // Also check immediately on startup
  setTimeout(checkReminders, 5000)

  console.log('Reminder notification service started')
}

export function stopReminderNotifications(): void {
  if (notificationInterval) {
    clearInterval(notificationInterval)
    notificationInterval = null
    console.log('Reminder notification service stopped')
  }
}

function checkReminders(): void {
  if (!Notification.isSupported()) {
    console.log('Notifications not supported on this platform')
    return
  }

  try {
    // Check for overdue reminders
    const overdueReminders = getOverdueReminders()

    for (const reminder of overdueReminders) {
      // Only notify once per reminder
      if (!lastNotifiedReminders.has(`overdue-${reminder.id}`)) {
        showOverdueNotification(reminder)
        lastNotifiedReminders.add(`overdue-${reminder.id}`)
      }
    }

    // Check for reminders due within the next hour
    const upcomingReminders = getUpcomingReminders(1) // 1 day
    const oneHourFromNow = new Date()
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1)

    for (const reminder of upcomingReminders) {
      const dueDate = new Date(reminder.due_date)

      // If due within the next hour and not yet notified
      if (dueDate <= oneHourFromNow && !lastNotifiedReminders.has(`upcoming-${reminder.id}`)) {
        showUpcomingNotification(reminder)
        lastNotifiedReminders.add(`upcoming-${reminder.id}`)
      }
    }

    // Check for issue reminders that are due
    try {
      const dueIssues = getIssuesWithDueReminders()
      for (const issue of dueIssues) {
        if (!lastNotifiedReminders.has(`issue-${issue.id}`)) {
          showIssueReminderNotification(issue)
          lastNotifiedReminders.add(`issue-${issue.id}`)
          // Mark as notified so it won't keep firing
          markReminderNotified(issue.id)
        }
      }
    } catch (issueError) {
      console.error('Error checking issue reminders:', issueError)
    }

    // Clean up old notification tracking (remove entries older than 24 hours)
    // This is a simple implementation; in production you might want to use timestamps
    if (lastNotifiedReminders.size > 1000) {
      lastNotifiedReminders.clear()
    }
  } catch (error) {
    console.error('Error checking reminders:', error)
  }
}

function showOverdueNotification(reminder: { id: string; title: string; due_date: string; topic_title?: string }): void {
  const notification = new Notification({
    title: 'Overdue Reminder',
    body: reminder.title + (reminder.topic_title ? ` (${reminder.topic_title})` : ''),
    urgency: 'critical',
    silent: false
  })

  notification.on('click', () => {
    // Focus the main window when notification is clicked
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].show()
      windows[0].focus()
    }
  })

  notification.show()
}

function showIssueReminderNotification(issue: { id: string; title: string; reminder_date: string | null; topic_title?: string }): void {
  const notification = new Notification({
    title: 'Issue Reminder',
    body: issue.title + (issue.topic_title ? ` (${issue.topic_title})` : ''),
    urgency: 'critical',
    silent: false
  })

  notification.on('click', () => {
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].show()
      windows[0].focus()
    }
  })

  notification.show()
}

function showUpcomingNotification(reminder: { id: string; title: string; due_date: string; topic_title?: string }): void {
  const dueDate = new Date(reminder.due_date)
  const now = new Date()
  const minutesUntilDue = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60))

  let timeText: string
  if (minutesUntilDue <= 0) {
    timeText = 'now'
  } else if (minutesUntilDue < 60) {
    timeText = `in ${minutesUntilDue} minute${minutesUntilDue === 1 ? '' : 's'}`
  } else {
    const hours = Math.round(minutesUntilDue / 60)
    timeText = `in ${hours} hour${hours === 1 ? '' : 's'}`
  }

  const notification = new Notification({
    title: `Reminder Due ${timeText}`,
    body: reminder.title + (reminder.topic_title ? ` (${reminder.topic_title})` : ''),
    urgency: 'normal',
    silent: false
  })

  notification.on('click', () => {
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].show()
      windows[0].focus()
    }
  })

  notification.show()
}

export function showTestNotification(): void {
  if (!Notification.isSupported()) {
    console.log('Notifications not supported')
    return
  }

  const notification = new Notification({
    title: 'Test Notification',
    body: 'Notifications are working correctly!'
  })

  notification.show()
}

// Export for use in main process
export function initializeNotifications(): void {
  app.whenReady().then(() => {
    startReminderNotifications()
  })

  app.on('before-quit', () => {
    stopReminderNotifications()
  })
}
