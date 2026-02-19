import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'

// Types

export interface ResourceCategory {
  id: string
  name: string
  type: 'credential' | 'reference'
  display_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateCategoryData {
  name: string
  type: 'credential' | 'reference'
  display_order?: number
}

export interface UpdateCategoryData {
  name?: string
  display_order?: number
}

// Get categories by type
export function getCategories(type: 'credential' | 'reference'): ResourceCategory[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT id, name, type, display_order, created_by, created_at, updated_at
    FROM resource_categories
    WHERE type = ?
    ORDER BY display_order ASC, name ASC
  `).all(type) as ResourceCategory[]
}

// Get all categories
export function getAllCategories(): ResourceCategory[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT id, name, type, display_order, created_by, created_at, updated_at
    FROM resource_categories
    ORDER BY type ASC, display_order ASC, name ASC
  `).all() as ResourceCategory[]
}

// Get category by ID
export function getCategoryById(id: string): ResourceCategory | null {
  const db = getDatabase()

  const category = db.prepare(`
    SELECT id, name, type, display_order, created_by, created_at, updated_at
    FROM resource_categories
    WHERE id = ?
  `).get(id) as ResourceCategory | undefined

  return category || null
}

// Create category
export function createCategory(
  data: CreateCategoryData,
  userId: string
): { success: boolean; category?: ResourceCategory; error?: string } {
  const db = getDatabase()

  if (!data.name?.trim()) {
    return { success: false, error: 'Category name is required' }
  }

  if (!data.type || !['credential', 'reference'].includes(data.type)) {
    return { success: false, error: 'Invalid category type' }
  }

  // Check for duplicate name in same type
  const existing = db.prepare(
    'SELECT id FROM resource_categories WHERE name = ? AND type = ?'
  ).get(data.name.trim(), data.type)

  if (existing) {
    return { success: false, error: 'A category with this name already exists' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  // Get max display_order for this type
  let displayOrder = data.display_order
  if (displayOrder === undefined) {
    const maxOrder = db.prepare(
      'SELECT MAX(display_order) as max_order FROM resource_categories WHERE type = ?'
    ).get(data.type) as { max_order: number | null }
    displayOrder = (maxOrder.max_order || 0) + 1
  }

  try {
    db.prepare(`
      INSERT INTO resource_categories (id, name, type, display_order, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name.trim(), data.type, displayOrder, userId, now, now)

    logAudit(
      'RESOURCE_CATEGORY_CREATE' as any,
      userId,
      getUsername(userId),
      'resource_category',
      id,
      { name: data.name.trim(), type: data.type }
    )

    const category = getCategoryById(id)
    return { success: true, category: category || undefined }
  } catch (error) {
    console.error('Error creating category:', error)
    return { success: false, error: 'Failed to create category' }
  }
}

// Update category
export function updateCategory(
  id: string,
  data: UpdateCategoryData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getCategoryById(id)
  if (!existing) {
    return { success: false, error: 'Category not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    if (!data.name.trim()) {
      return { success: false, error: 'Category name cannot be empty' }
    }
    // Check for duplicate name in same type
    const duplicate = db.prepare(
      'SELECT id FROM resource_categories WHERE name = ? AND type = ? AND id != ?'
    ).get(data.name.trim(), existing.type, id)

    if (duplicate) {
      return { success: false, error: 'A category with this name already exists' }
    }

    fields.push('name = ?')
    values.push(data.name.trim())
  }

  if (data.display_order !== undefined) {
    fields.push('display_order = ?')
    values.push(data.display_order)
  }

  if (fields.length === 0) {
    return { success: true }
  }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE resource_categories SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'RESOURCE_CATEGORY_UPDATE' as any,
      userId,
      getUsername(userId),
      'resource_category',
      id,
      { name: existing.name, type: existing.type }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating category:', error)
    return { success: false, error: 'Failed to update category' }
  }
}

// Delete category (with reassignment)
export function deleteCategory(
  id: string,
  reassignTo: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getCategoryById(id)
  if (!existing) {
    return { success: false, error: 'Category not found' }
  }

  const targetCategory = getCategoryById(reassignTo)
  if (!targetCategory) {
    return { success: false, error: 'Target category not found' }
  }

  if (targetCategory.type !== existing.type) {
    return { success: false, error: 'Target category must be of the same type' }
  }

  if (id === reassignTo) {
    return { success: false, error: 'Cannot reassign to the same category' }
  }

  try {
    db.transaction(() => {
      // Reassign resources to target category
      if (existing.type === 'credential') {
        db.prepare('UPDATE credentials SET category = ? WHERE category = ?')
          .run(targetCategory.name, existing.name)
      } else {
        db.prepare('UPDATE secure_references SET category = ? WHERE category = ?')
          .run(targetCategory.name, existing.name)
      }

      // Delete the category
      db.prepare('DELETE FROM resource_categories WHERE id = ?').run(id)
    })()

    logAudit(
      'RESOURCE_CATEGORY_DELETE' as any,
      userId,
      getUsername(userId),
      'resource_category',
      id,
      { name: existing.name, type: existing.type, reassigned_to: targetCategory.name }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting category:', error)
    return { success: false, error: 'Failed to delete category' }
  }
}

// Reorder categories
export function reorderCategories(
  ids: string[],
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  if (!ids.length) {
    return { success: true }
  }

  try {
    const updateOrder = db.prepare(
      'UPDATE resource_categories SET display_order = ?, updated_at = ? WHERE id = ?'
    )

    const now = new Date().toISOString()

    db.transaction(() => {
      for (let i = 0; i < ids.length; i++) {
        updateOrder.run(i + 1, now, ids[i])
      }
    })()

    logAudit(
      'RESOURCE_CATEGORY_REORDER' as any,
      userId,
      getUsername(userId),
      'resource_category',
      null,
      { category_ids: ids }
    )

    return { success: true }
  } catch (error) {
    console.error('Error reordering categories:', error)
    return { success: false, error: 'Failed to reorder categories' }
  }
}

// Get category count by type
export function getCategoryCount(type: 'credential' | 'reference'): number {
  const db = getDatabase()
  const result = db.prepare(
    'SELECT COUNT(*) as count FROM resource_categories WHERE type = ?'
  ).get(type) as { count: number }
  return result.count
}
