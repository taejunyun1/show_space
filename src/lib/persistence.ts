import { get, set } from 'idb-keyval'
import type { Project } from '../domain/types'

export const DRAFT_KEY = 'gonggan-project-v1'

type Reader = (key: string) => Promise<unknown>
type Writer = (key: string, value: unknown) => Promise<unknown>

export function readDraft(reader: Reader = get): Promise<unknown> {
  return reader(DRAFT_KEY)
}

export async function writeDraft(project: Project, writer: Writer = set): Promise<void> {
  await writer(DRAFT_KEY, structuredClone(project))
}
