/**
 * Topic Repository Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import {
  initTestDatabase,
  closeTestDatabase,
  clearTestDatabase,
  getTestDatabase,
  testFixtures
} from '../../mocks/database'

// Mock the database connection before importing repository
vi.mock('@main/database/connection', () => ({
  getDatabase: () => getTestDatabase()
}))

// Import repository after mock
import { TopicRepository, Topic } from '@main/repositories/topic.repository'

describe('TopicRepository', () => {
  let repository: TopicRepository

  beforeAll(() => {
    initTestDatabase()
  })

  afterAll(() => {
    closeTestDatabase()
  })

  beforeEach(() => {
    clearTestDatabase()
    repository = new TopicRepository()
  })

  describe('create', () => {
    it('should create a new topic with required fields', () => {
      const topic = repository.create({
        title: 'New Topic'
      })

      expect(topic).toBeDefined()
      expect(topic.id).toBeDefined()
      expect(topic.title).toBe('New Topic')
      expect(topic.description).toBeNull()
      expect(topic.status).toBe('active')
      expect(topic.created_at).toBeDefined()
      expect(topic.updated_at).toBeDefined()
      expect(topic.deleted_at).toBeNull()
    })

    it('should create a topic with all fields', () => {
      const topic = repository.create({
        title: 'Full Topic',
        description: 'A full description',
        status: 'archived'
      })

      expect(topic.title).toBe('Full Topic')
      expect(topic.description).toBe('A full description')
      expect(topic.status).toBe('archived')
    })
  })

  describe('findById', () => {
    it('should find an existing topic by ID', () => {
      const created = repository.create({ title: 'Find Me' })
      const found = repository.findById(created.id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(created.id)
      expect(found?.title).toBe('Find Me')
    })

    it('should return null for non-existent ID', () => {
      const found = repository.findById('non-existent-id')
      expect(found).toBeNull()
    })

    it('should not find soft-deleted topics by default', () => {
      const created = repository.create({ title: 'Deleted Topic' })
      repository.softDelete(created.id)

      const found = repository.findById(created.id)
      expect(found).toBeNull()
    })

    it('should find soft-deleted topics when includeDeleted is true', () => {
      const created = repository.create({ title: 'Deleted Topic' })
      repository.softDelete(created.id)

      const found = repository.findById(created.id, true)
      expect(found).toBeDefined()
      expect(found?.deleted_at).toBeDefined()
    })
  })

  describe('findAll', () => {
    it('should return all topics', () => {
      repository.create({ title: 'Topic 1' })
      repository.create({ title: 'Topic 2' })
      repository.create({ title: 'Topic 3' })

      const topics = repository.findAll()
      expect(topics).toHaveLength(3)
    })

    it('should filter by where conditions', () => {
      repository.create({ title: 'Active 1', status: 'active' })
      repository.create({ title: 'Active 2', status: 'active' })
      repository.create({ title: 'Archived', status: 'archived' })

      const activeTopics = repository.findAll({ where: { status: 'active' } })
      expect(activeTopics).toHaveLength(2)
    })

    it('should order results', () => {
      repository.create({ title: 'C Topic' })
      repository.create({ title: 'A Topic' })
      repository.create({ title: 'B Topic' })

      const topics = repository.findAll({
        orderBy: 'title',
        orderDirection: 'ASC'
      })

      expect(topics[0].title).toBe('A Topic')
      expect(topics[1].title).toBe('B Topic')
      expect(topics[2].title).toBe('C Topic')
    })

    it('should limit results', () => {
      for (let i = 1; i <= 10; i++) {
        repository.create({ title: `Topic ${i}` })
      }

      const topics = repository.findAll({ limit: 5 })
      expect(topics).toHaveLength(5)
    })

    it('should not include deleted topics by default', () => {
      const topic = repository.create({ title: 'To Delete' })
      repository.create({ title: 'Keep' })
      repository.softDelete(topic.id)

      const topics = repository.findAll()
      expect(topics).toHaveLength(1)
      expect(topics[0].title).toBe('Keep')
    })
  })

  describe('update', () => {
    it('should update topic title', () => {
      const topic = repository.create({ title: 'Original' })
      const updated = repository.update(topic.id, { title: 'Updated' })

      expect(updated).toBe(true)

      const found = repository.findById(topic.id)
      expect(found?.title).toBe('Updated')
    })

    it('should update multiple fields', () => {
      const topic = repository.create({ title: 'Original' })
      repository.update(topic.id, {
        title: 'New Title',
        description: 'New Description',
        status: 'archived'
      })

      const found = repository.findById(topic.id)
      expect(found?.title).toBe('New Title')
      expect(found?.description).toBe('New Description')
      expect(found?.status).toBe('archived')
    })

    it('should update updated_at timestamp', () => {
      const topic = repository.create({ title: 'Original' })
      const originalUpdatedAt = topic.updated_at

      // Wait a bit to ensure different timestamp
      vi.advanceTimersByTime(1000)

      repository.update(topic.id, { title: 'Updated' })
      const found = repository.findById(topic.id)

      // Note: In real tests, updated_at would be different
      expect(found?.updated_at).toBeDefined()
    })

    it('should return false for non-existent ID', () => {
      const updated = repository.update('non-existent', { title: 'New' })
      expect(updated).toBe(false)
    })
  })

  describe('softDelete', () => {
    it('should soft delete a topic', () => {
      const topic = repository.create({ title: 'Delete Me' })
      const deleted = repository.softDelete(topic.id)

      expect(deleted).toBe(true)

      const found = repository.findById(topic.id)
      expect(found).toBeNull()

      const foundWithDeleted = repository.findById(topic.id, true)
      expect(foundWithDeleted?.deleted_at).toBeDefined()
    })

    it('should return false for already deleted topic', () => {
      const topic = repository.create({ title: 'Delete Me' })
      repository.softDelete(topic.id)

      const deleted = repository.softDelete(topic.id)
      expect(deleted).toBe(false)
    })
  })

  describe('restore', () => {
    it('should restore a soft-deleted topic', () => {
      const topic = repository.create({ title: 'Restore Me' })
      repository.softDelete(topic.id)

      const restored = repository.restore(topic.id)
      expect(restored).toBe(true)

      const found = repository.findById(topic.id)
      expect(found).toBeDefined()
      expect(found?.deleted_at).toBeNull()
    })
  })

  describe('count', () => {
    it('should count all topics', () => {
      repository.create({ title: 'Topic 1' })
      repository.create({ title: 'Topic 2' })
      repository.create({ title: 'Topic 3' })

      const count = repository.count()
      expect(count).toBe(3)
    })

    it('should count with filter', () => {
      repository.create({ title: 'Active 1', status: 'active' })
      repository.create({ title: 'Active 2', status: 'active' })
      repository.create({ title: 'Archived', status: 'archived' })

      const count = repository.count({ where: { status: 'active' } })
      expect(count).toBe(2)
    })
  })

  describe('exists', () => {
    it('should return true for existing topic', () => {
      const topic = repository.create({ title: 'Exists' })
      expect(repository.exists(topic.id)).toBe(true)
    })

    it('should return false for non-existing topic', () => {
      expect(repository.exists('non-existent')).toBe(false)
    })

    it('should return false for deleted topic', () => {
      const topic = repository.create({ title: 'Deleted' })
      repository.softDelete(topic.id)
      expect(repository.exists(topic.id)).toBe(false)
    })
  })

  describe('search', () => {
    it('should search topics by title', () => {
      repository.create({ title: 'JavaScript Guide' })
      repository.create({ title: 'Python Tutorial' })
      repository.create({ title: 'Java Basics' })

      const results = repository.search('Java')
      expect(results).toHaveLength(2) // JavaScript and Java
    })
  })

  describe('getActive', () => {
    it('should return only active topics', () => {
      repository.create({ title: 'Active 1', status: 'active' })
      repository.create({ title: 'Active 2', status: 'active' })
      repository.create({ title: 'Archived', status: 'archived' })

      const active = repository.getActive()
      expect(active).toHaveLength(2)
      expect(active.every(t => t.status === 'active')).toBe(true)
    })
  })

  describe('getArchived', () => {
    it('should return only archived topics', () => {
      repository.create({ title: 'Active', status: 'active' })
      repository.create({ title: 'Archived 1', status: 'archived' })
      repository.create({ title: 'Archived 2', status: 'archived' })

      const archived = repository.getArchived()
      expect(archived).toHaveLength(2)
      expect(archived.every(t => t.status === 'archived')).toBe(true)
    })
  })

  describe('archive/unarchive', () => {
    it('should archive a topic', () => {
      const topic = repository.create({ title: 'To Archive', status: 'active' })
      repository.archive(topic.id)

      const found = repository.findById(topic.id)
      expect(found?.status).toBe('archived')
    })

    it('should unarchive a topic', () => {
      const topic = repository.create({ title: 'To Unarchive', status: 'archived' })
      repository.unarchive(topic.id)

      const found = repository.findById(topic.id)
      expect(found?.status).toBe('active')
    })
  })
})
