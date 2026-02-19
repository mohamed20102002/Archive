import React, { useState, useEffect } from 'react'
import { Modal } from '../common/Modal'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { User, Shift } from '../../types'

interface UserManagementProps {
  isOpen: boolean
  onClose: () => void
}

interface UserFormData {
  username: string
  password: string
  confirmPassword: string
  displayName: string
  role: 'admin' | 'user'
  employeeNumber: string
}

interface EditUserData {
  username: string
  displayName: string
  arabicName: string
  role: 'admin' | 'user'
  employeeNumber: string
  shiftId: string
  sortOrder: string // stored as string to allow empty input while typing
}

const initialFormData: UserFormData = {
  username: '',
  password: '',
  confirmPassword: '',
  displayName: '',
  role: 'user',
  employeeNumber: ''
}

export function UserManagement({ isOpen, onClose }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showEditUser, setShowEditUser] = useState<User | null>(null)
  const [editUserData, setEditUserData] = useState<EditUserData>({ username: '', displayName: '', arabicName: '', role: 'user', employeeNumber: '', shiftId: '', sortOrder: '100' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<User | null>(null)

  const [showDeletedUsers, setShowDeletedUsers] = useState(false)

  const { success, error } = useToast()
  const { user: currentUser } = useAuth()

  // Separate active and deleted users
  const activeUsers = users.filter(u => !u.deleted_at)
  const deletedUsers = users.filter(u => !!u.deleted_at)

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const [data, allShifts] = await Promise.all([
        window.electronAPI.auth.getAllUsers(),
        window.electronAPI.attendance.getShifts()
      ])
      setUsers(data as User[])
      setShifts(allShifts as Shift[])
    } catch (err) {
      console.error('Error loading users:', err)
      error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const handleAddUser = async () => {
    if (!formData.username.trim()) {
      error('Validation Error', 'Username is required')
      return
    }
    if (!formData.displayName.trim()) {
      error('Validation Error', 'Display name is required')
      return
    }
    if (!formData.password) {
      error('Validation Error', 'Password is required')
      return
    }
    if (formData.password.length < 8) {
      error('Validation Error', 'Password must be at least 8 characters')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      error('Validation Error', 'Passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await window.electronAPI.auth.createUser(
        formData.username.trim(),
        formData.password,
        formData.displayName.trim(),
        formData.role
      )

      if (result.success) {
        success('User Created', `User "${formData.displayName}" has been created`)
        setShowAddModal(false)
        setFormData(initialFormData)
        loadUsers()
      } else {
        error('Failed to create user', result.error)
      }
    } catch (err: any) {
      error('Failed to create user', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    if (!currentUser) return

    try {
      const result = await window.electronAPI.auth.updateUser(userId, updates, currentUser.id)

      if (result.success) {
        success('User Updated')
        loadUsers()
        setEditingUser(null)
      } else {
        error('Failed to update user', result.error)
      }
    } catch (err: any) {
      error('Failed to update user', err.message)
    }
  }

  const handleOpenEditUser = (user: User) => {
    setEditUserData({
      username: user.username,
      displayName: user.display_name,
      arabicName: user.arabic_name || '',
      role: user.role,
      employeeNumber: user.employee_number || '',
      shiftId: user.shift_id || '',
      sortOrder: String(user.sort_order ?? 100)
    })
    setShowEditUser(user)
  }

  const handleSaveEditUser = async () => {
    if (!showEditUser || !currentUser) return

    if (!editUserData.username.trim()) {
      error('Validation Error', 'Username is required')
      return
    }

    if (!editUserData.displayName.trim()) {
      error('Validation Error', 'Display name is required')
      return
    }

    // Check if trying to remove own admin rights
    if (showEditUser.id === currentUser.id && editUserData.role !== 'admin') {
      error('Cannot change role', 'You cannot remove your own admin privileges')
      return
    }

    // Validate sort order
    const sortOrderNum = parseInt(editUserData.sortOrder)
    if (!editUserData.sortOrder || isNaN(sortOrderNum) || sortOrderNum < 1) {
      error('Validation Error', 'Sort order must be a positive number')
      return
    }

    // Check for duplicate sort order (excluding current user)
    const duplicateUser = users.find(u =>
      u.id !== showEditUser.id &&
      u.sort_order === sortOrderNum &&
      !u.deleted_at
    )
    if (duplicateUser) {
      error('Duplicate Sort Order', `Sort order ${sortOrderNum} is already used by "${duplicateUser.display_name}"`)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await window.electronAPI.auth.updateUser(
        showEditUser.id,
        {
          username: editUserData.username.trim(),
          display_name: editUserData.displayName.trim(),
          arabic_name: editUserData.arabicName.trim() || null,
          role: editUserData.role,
          employee_number: editUserData.employeeNumber.trim() || null,
          shift_id: editUserData.shiftId || null,
          sort_order: sortOrderNum
        },
        currentUser.id
      )

      if (result.success) {
        success('User Updated', `User "${editUserData.displayName}" has been updated`)
        setShowEditUser(null)
        loadUsers()
      } else {
        error('Failed to update user', result.error)
      }
    } catch (err: any) {
      error('Failed to update user', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    // Prevent deactivating yourself
    if (user.id === currentUser?.id) {
      error('Cannot deactivate', 'You cannot deactivate your own account')
      return
    }

    await handleUpdateUser(user.id, { is_active: !user.is_active })
  }

  const handleChangeRole = async (user: User, newRole: 'admin' | 'user') => {
    // Prevent removing your own admin rights
    if (user.id === currentUser?.id && newRole !== 'admin') {
      error('Cannot change role', 'You cannot remove your own admin privileges')
      return
    }

    await handleUpdateUser(user.id, { role: newRole })
  }

  const handleResetPassword = async () => {
    if (!showResetPassword || !currentUser) return

    if (!newPassword) {
      error('Validation Error', 'New password is required')
      return
    }
    if (newPassword.length < 8) {
      error('Validation Error', 'Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmNewPassword) {
      error('Validation Error', 'Passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await window.electronAPI.auth.resetPassword(
        showResetPassword.id,
        newPassword,
        currentUser.id
      )

      if (result.success) {
        success('Password Reset', `Password for "${showResetPassword.display_name}" has been reset`)
        setShowResetPassword(null)
        setNewPassword('')
        setConfirmNewPassword('')
      } else {
        error('Failed to reset password', result.error)
      }
    } catch (err: any) {
      error('Failed to reset password', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!showDeleteConfirm || !currentUser) return

    setIsSubmitting(true)
    try {
      const result = await window.electronAPI.auth.deleteUser(
        showDeleteConfirm.id,
        currentUser.id
      )

      if (result.success) {
        success('User Deleted', `User "${showDeleteConfirm.display_name}" has been deleted`)
        setShowDeleteConfirm(null)
        loadUsers()
      } else {
        error('Failed to delete user', result.error)
      }
    } catch (err: any) {
      error('Failed to delete user', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal title="Manage Users" onClose={onClose} size="xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Manage user accounts and permissions
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        {/* User List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : activeUsers.length === 0 && deletedUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No users found
          </div>
        ) : (
          <>
            {/* Active Users Table */}
            {activeUsers.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Emp #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {activeUsers.map((user) => (
                      <tr key={user.id} className={!user.is_active ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {user.sort_order ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                              {user.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {user.display_name}
                                {user.id === currentUser?.id && (
                                  <span className="ml-2 text-xs text-gray-400">(You)</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {user.employee_number || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={user.role}
                            onChange={(e) => handleChangeRole(user, e.target.value as 'admin' | 'user')}
                            disabled={user.id === currentUser?.id}
                            className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                            user.is_active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : 'Never'
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditUser(user)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                              title="Edit User"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setShowResetPassword(user)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Reset Password"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              disabled={user.id === currentUser?.id}
                              className={`p-1.5 rounded ${
                                user.id === currentUser?.id
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : user.is_active
                                    ? 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                                    : 'text-green-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'
                              }`}
                              title={user.is_active ? 'Deactivate User' : 'Activate User'}
                            >
                              {user.is_active ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(user)}
                              disabled={user.id === currentUser?.id}
                              className={`p-1.5 rounded ${
                                user.id === currentUser?.id
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                              }`}
                              title="Delete User"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Deleted Users Collapsible Section */}
            {deletedUsers.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowDeletedUsers(!showDeletedUsers)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showDeletedUsers ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Deleted Users ({deletedUsers.length})</span>
                </button>

                {showDeletedUsers && (
                  <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto bg-gray-50 dark:bg-gray-800/50">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-gray-100 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Emp #
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Deleted On
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {deletedUsers.map((user) => (
                          <tr key={user.id} className="opacity-60">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                                  {user.display_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-500 dark:text-gray-400 line-through text-sm">
                                    {user.display_name}
                                  </div>
                                  <div className="text-xs text-gray-400 dark:text-gray-500">@{user.username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {user.employee_number || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {user.role}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {new Date(user.deleted_at!).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <Modal
          title="Add New User"
          onClose={() => {
            setShowAddModal(false)
            setFormData(initialFormData)
            setShowPassword(false)
            setShowConfirmPassword(false)
          }}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="input"
                placeholder="Enter display name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee Number
              </label>
              <input
                type="text"
                value={formData.employeeNumber}
                onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                className="input"
                placeholder="Enter employee number (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                className="input"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input pr-10"
                  placeholder="Enter password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="input pr-10"
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setFormData(initialFormData)
                  setShowPassword(false)
                  setShowConfirmPassword(false)
                }}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <Modal
          title={`Reset Password for ${showResetPassword.display_name}`}
          onClose={() => {
            setShowResetPassword(null)
            setNewPassword('')
            setConfirmNewPassword('')
            setShowNewPassword(false)
            setShowConfirmNewPassword(false)
          }}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter a new password for this user. The old password cannot be retrieved as it is securely hashed.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter new password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmNewPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowResetPassword(null)
                  setNewPassword('')
                  setConfirmNewPassword('')
                  setShowNewPassword(false)
                  setShowConfirmNewPassword(false)
                }}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEditUser && (
        <Modal
          title={`Edit User: ${showEditUser.username}`}
          onClose={() => setShowEditUser(null)}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={editUserData.username}
                onChange={(e) => setEditUserData({ ...editUserData, username: e.target.value })}
                className="input"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editUserData.displayName}
                onChange={(e) => setEditUserData({ ...editUserData, displayName: e.target.value })}
                className="input"
                placeholder="Enter display name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arabic Name (for reports)
              </label>
              <input
                type="text"
                value={editUserData.arabicName}
                onChange={(e) => setEditUserData({ ...editUserData, arabicName: e.target.value })}
                className="input text-right"
                dir="rtl"
                placeholder="أدخل الاسم بالعربية"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={editUserData.role}
                onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value as 'admin' | 'user' })}
                className="input"
                disabled={showEditUser.id === currentUser?.id}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {showEditUser.id === currentUser?.id && (
                <p className="text-xs text-gray-500 mt-1">You cannot change your own role</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee Number
              </label>
              <input
                type="text"
                value={editUserData.employeeNumber}
                onChange={(e) => setEditUserData({ ...editUserData, employeeNumber: e.target.value })}
                className="input"
                placeholder="Enter employee number"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift
                </label>
                <select
                  value={editUserData.shiftId}
                  onChange={(e) => setEditUserData({ ...editUserData, shiftId: e.target.value })}
                  className="input"
                >
                  <option value="">No shift assigned</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={editUserData.sortOrder}
                  onChange={(e) => setEditUserData({ ...editUserData, sortOrder: e.target.value })}
                  className="input"
                  min="1"
                  placeholder="100"
                />
                <p className="text-xs text-gray-500 mt-1">Lower = higher in list (unique per user)</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium ${showEditUser.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  {showEditUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Created:</span>
                <span className="text-gray-900">
                  {new Date(showEditUser.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Last Login:</span>
                <span className="text-gray-900">
                  {showEditUser.last_login_at
                    ? new Date(showEditUser.last_login_at).toLocaleString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowEditUser(null)}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditUser}
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          title="Delete User"
          onClose={() => setShowDeleteConfirm(null)}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-800">
                  Are you sure you want to delete this user?
                </p>
                <p className="text-sm text-red-600 mt-1">
                  User: <strong>{showDeleteConfirm.display_name}</strong> (@{showDeleteConfirm.username})
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              This user will be marked as deleted and will no longer be able to log in.
              Their audit history will be preserved for record-keeping purposes.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
