import { describe, expect, it } from 'vitest'
import { createDemoProject } from '../domain/model'
import { readDraft, writeDraft } from './persistence'

describe('draft persistence', () => {
  it('reads unknown stored content from the stable storage key', async () => {
    const stored = { arbitrary: true }
    let key = ''
    const result = await readDraft(async (nextKey) => {
      key = nextKey
      return stored
    })
    expect(key).toBe('gonggan-project-v1')
    expect(result).toBe(stored)
  })

  it('writes an independent serialized project snapshot', async () => {
    const project = createDemoProject()
    let written: unknown
    await writeDraft(project, async (_key, value) => { written = value })
    project.name = '호출 뒤 변경'
    expect(written).toEqual(expect.objectContaining({ name: '여백의 기록' }))
    expect(written).not.toBe(project)
  })
})
