import { cn } from '@/utils/cn'

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'conditional')).toBe('base conditional')
    expect(cn('base', false && 'conditional')).toBe('base')
  })

  it('should handle undefined and null values', () => {
    expect(cn('base', undefined, null, 'valid')).toBe('base valid')
  })

  it('should handle empty strings', () => {
    expect(cn('base', '', 'valid')).toBe('base valid')
  })

  it('should work with tailwind-merge functionality', () => {
    // Test that conflicting classes are resolved correctly
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})
