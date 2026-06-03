import { describe, it, expect } from 'vitest'
import { maskKey } from '../../lib/mask'

describe('maskKey', () => {
  it('masks a normal key: first 3 chars + … + last 4', () => {
    expect(maskKey('sk-abc123def456')).toBe('sk-…f456')
  })

  it('masks a long key string', () => {
    expect(maskKey('sk-pro-very-long-key-that-goes-on-and-on-xyz9'))
      .toBe('sk-…xyz9')
  })

  it('returns ••• for very short keys (≤8 chars)', () => {
    expect(maskKey('abc')).toBe('•••')
    expect(maskKey('12345678')).toBe('•••')
  })

  it('returns ••• for empty string', () => {
    expect(maskKey('')).toBe('•••')
  })

  it('handles exactly 9 chars', () => {
    expect(maskKey('123456789')).toBe('123…6789')
  })

  it('handles keys with special characters', () => {
    expect(maskKey('sk-!@#$%^&*abc123')).toBe('sk-…c123')
  })

  it('handles keys with hyphens and underscores', () => {
    expect(maskKey('prod_key_v2_abcdef')).toBe('pro…cdef')
  })
})
