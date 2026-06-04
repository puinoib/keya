import { describe, it, expect } from 'vitest'
import { loadManifest, getDocument } from '../manifest'

describe('manifest', () => {
  it('should load manifest', async () => {
    const manifest = await loadManifest()
    expect(manifest.documents).toBeDefined()
    expect(manifest.documents.length).toBeGreaterThan(0)
  })

  it('should get document by slug', async () => {
    const doc = await getDocument('index')
    expect(doc).toBeDefined()
    expect(doc?.title).toBe('Welcome to Keya')
  })

  it('should return null for non-existent document', async () => {
    const doc = await getDocument('non-existent')
    expect(doc).toBeNull()
  })
})
