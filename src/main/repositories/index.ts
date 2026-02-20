/**
 * Repository Pattern Implementation
 *
 * This module provides a clean data access layer for the application.
 * Each repository encapsulates CRUD operations for a specific entity type.
 *
 * Features:
 * - Soft delete support (deleted_at field)
 * - Transaction support via withTransaction()
 * - Pagination support
 * - Type-safe operations
 * - FTS5 full-text search integration
 *
 * Usage:
 *
 * ```typescript
 * import { topicRepository, withTransaction } from './repositories'
 *
 * // Simple CRUD
 * const topic = topicRepository.create({ title: 'My Topic' })
 * const found = topicRepository.findById(topic.id)
 * topicRepository.update(topic.id, { title: 'Updated' })
 * topicRepository.softDelete(topic.id)
 *
 * // Within a transaction
 * withTransaction((context) => {
 *   const topic = topicRepository.create({ title: 'Topic' })
 *   const record = recordRepository.create({ topic_id: topic.id, title: 'Record' })
 *   return { topic, record }
 * })
 * ```
 */

// Base repository exports
export {
  BaseRepository,
  BaseEntity,
  QueryOptions,
  PaginatedResult,
  TransactionCallback,
  RepositoryContext,
  withTransaction,
  batchTransaction
} from './base.repository'

// Entity repositories
export { TopicRepository, topicRepository, Topic, TopicWithCount, CreateTopicData, UpdateTopicData } from './topic.repository'
export { RecordRepository, recordRepository, Record, RecordWithTopic, CreateRecordData, UpdateRecordData } from './record.repository'
export { LetterRepository, letterRepository, Letter, LetterWithAuthority, LetterFilters, CreateLetterData, UpdateLetterData } from './letter.repository'
