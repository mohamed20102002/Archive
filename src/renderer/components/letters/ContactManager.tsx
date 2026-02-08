import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Contact, Authority } from '../../types'
import { Modal } from '../common/Modal'

export function ContactManager() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAuthority, setFilterAuthority] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    try {
      let result
      if (searchQuery) {
        result = await window.electronAPI.contacts.search(searchQuery)
      } else if (filterAuthority) {
        result = await window.electronAPI.contacts.getByAuthority(filterAuthority)
      } else {
        result = await window.electronAPI.contacts.getAll()
      }
      setContacts(result as Contact[])
    } catch (error) {
      console.error('Error loading contacts:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filterAuthority])

  const loadAuthorities = useCallback(async () => {
    try {
      // Load external authorities for the filter
      const result = await window.electronAPI.authorities.getExternal()
      setAuthorities(result as Authority[])
    } catch (error) {
      console.error('Error loading authorities:', error)
    }
  }, [])

  useEffect(() => {
    loadAuthorities()
  }, [loadAuthorities])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadContacts()
    }, 300)
    return () => clearTimeout(debounce)
  }, [loadContacts])

  const handleCreate = async (data: any) => {
    if (!user) return

    try {
      const result = await window.electronAPI.contacts.create(data, user.id)
      if (result.success) {
        setShowCreateModal(false)
        loadContacts()
      } else {
        alert(result.error || 'Failed to create contact')
      }
    } catch (error) {
      console.error('Error creating contact:', error)
    }
  }

  const handleUpdate = async (id: string, data: any) => {
    if (!user) return

    try {
      const result = await window.electronAPI.contacts.update(id, data, user.id)
      if (result.success) {
        setEditingContact(null)
        loadContacts()
      } else {
        alert(result.error || 'Failed to update contact')
      }
    } catch (error) {
      console.error('Error updating contact:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Are you sure you want to delete this contact?')) return

    try {
      const result = await window.electronAPI.contacts.delete(id, user.id)
      if (result.success) {
        loadContacts()
      } else {
        alert(result.error || 'Failed to delete contact')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
        <p className="text-sm text-gray-500">Manage contacts for external letter correspondence (Att field)</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full"
          />
        </div>
        <select
          value={filterAuthority}
          onChange={(e) => setFilterAuthority(e.target.value)}
          className="input w-64"
        >
          <option value="">All Organizations</option>
          {authorities.map((auth) => (
            <option key={auth.id} value={auth.id}>
              {auth.short_name || auth.name}
            </option>
          ))}
        </select>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          Add Contact
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
          <p className="text-gray-500 mb-4">Add contact persons for external correspondence</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Add Contact
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{contact.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{contact.title || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {contact.authority_short_name || contact.authority_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{contact.email || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingContact(contact)}
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Contact"
      >
        <ContactForm
          authorities={authorities}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingContact}
        onClose={() => setEditingContact(null)}
        title="Edit Contact"
      >
        {editingContact && (
          <ContactForm
            contact={editingContact}
            authorities={authorities}
            onSubmit={(data) => handleUpdate(editingContact.id, data)}
            onCancel={() => setEditingContact(null)}
          />
        )}
      </Modal>
    </div>
  )
}

// Contact Form Component
interface ContactFormProps {
  contact?: Contact
  authorities: Authority[]
  onSubmit: (data: any) => void
  onCancel: () => void
}

function ContactForm({ contact, authorities, onSubmit, onCancel }: ContactFormProps) {
  const [name, setName] = useState(contact?.name || '')
  const [title, setTitle] = useState(contact?.title || '')
  const [authorityId, setAuthorityId] = useState(contact?.authority_id || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [phone, setPhone] = useState(contact?.phone || '')
  const [notes, setNotes] = useState(contact?.notes || '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      name: name.trim(),
      title: title.trim() || undefined,
      authority_id: authorityId || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
            placeholder="Contact name"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title / Position
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full"
            placeholder="e.g., Project Manager"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Organization
        </label>
        <select
          value={authorityId}
          onChange={(e) => setAuthorityId(e.target.value)}
          className="input w-full"
        >
          <option value="">No organization</option>
          {authorities.map((auth) => (
            <option key={auth.id} value={auth.id}>
              {auth.name} {auth.short_name ? `(${auth.short_name})` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Only external organizations are shown
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            placeholder="contact@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input w-full"
            placeholder="+1 234 567 890"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Additional notes"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {contact ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
