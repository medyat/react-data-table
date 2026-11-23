// Izgara tuşları → niyet (form-grid.md §8, Vue 08 sheet klavyesi). DOM'suz: ızgara olayı buraya verir, dönen niyeti
// depoya uygular. Tek ana tuş Mac ⌘ / Windows Ctrl; ⌥ ile kısayol yok, tek istisna ⌥↵ (hücre aksiyon menüsü).
// ⌘ + yön en sona gider, ⌘⇧ + yön oraya kadar seçer (Excel); olay işlendiği için tarayıcıya geçmez.
import type { Direction, SheetStore } from './store'

export interface KeyInput {
  key: string
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  isComposing?: boolean
}

export type Intent =
  | { type: 'move'; dir: Direction; extend: boolean }
  | { type: 'jump'; dir: Direction; extend: boolean }
  | { type: 'tab'; back: boolean }
  | { type: 'edge'; end: boolean; rows: boolean; extend: boolean }
  | { type: 'page'; dir: 1 | -1; extend: boolean }
  | { type: 'edit' }
  | { type: 'type'; text: string }
  | { type: 'commit'; then: 'down' | 'up' | 'tab' | 'back' }
  | { type: 'cancel' }
  | { type: 'collapse' }
  | { type: 'toggle' }
  | { type: 'clear' }
  | { type: 'selectAll' }
  | { type: 'selectRow' }
  | { type: 'selectColumn' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'error'; dir: 1 | -1 }
  | { type: 'menu' }

const DIR: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

/**
 * `editing`: hücrede editör açık. `multiline`: açık editör `text` (⇧↵ ve ⌥↵ hücrede satır atlatır).
 * null: ızgara tuşu değil, olay tarayıcıya ya da editöre kalır.
 */
export function keyIntent(e: KeyInput, ctx: { editing: boolean; multiline: boolean; mac: boolean }): Intent | null {
  if (e.isComposing) return null
  const mod = ctx.mac ? e.metaKey : e.ctrlKey
  if (ctx.editing) {
    if (e.key === 'Tab') return { type: 'commit', then: e.shiftKey ? 'back' : 'tab' }
    if (e.key === 'Escape') return { type: 'cancel' }
    if (e.key === 'Enter') {
      if (ctx.multiline && (e.shiftKey || e.altKey)) return null
      return { type: 'commit', then: e.shiftKey ? 'up' : 'down' }
    }
    return null
  }
  const dir = DIR[e.key]
  if (dir) {
    if (e.altKey || (e.ctrlKey && e.metaKey)) return null
    return mod
      ? { type: 'jump', dir, extend: e.shiftKey }
      : e.ctrlKey || e.metaKey
        ? null
        : { type: 'move', dir, extend: e.shiftKey }
  }
  switch (e.key) {
    case 'Tab':
      return { type: 'tab', back: e.shiftKey }
    case 'Enter':
      if (e.altKey) return { type: 'menu' }
      return { type: 'move', dir: e.shiftKey ? 'up' : 'down', extend: false }
    case 'F2':
      return { type: 'edit' }
    case 'Escape':
      return { type: 'collapse' }
    case ' ':
      if (e.ctrlKey) return { type: 'selectColumn' }
      if (e.shiftKey) return { type: 'selectRow' }
      return { type: 'toggle' }
    case 'Delete':
    case 'Backspace':
      return { type: 'clear' }
    case 'Home':
    case 'End':
      return { type: 'edge', end: e.key === 'End', rows: mod, extend: e.shiftKey }
    case 'PageDown':
    case 'PageUp':
      return { type: 'page', dir: e.key === 'PageDown' ? 1 : -1, extend: e.shiftKey }
    case 'F8':
      return { type: 'error', dir: e.shiftKey ? -1 : 1 }
  }
  if (mod) {
    const k = e.key.toLowerCase()
    if (k === 'a' && !e.shiftKey) return { type: 'selectAll' }
    if (k === 'z') return { type: e.shiftKey ? 'redo' : 'undo' }
    if (k === 'y' && !ctx.mac) return { type: 'redo' }
    return null
  }
  // Yazmaya başlamak düzenler, içerik yazılanla değişir.
  if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) return { type: 'type', text: e.key }
  return null
}

/**
 * Niyeti depoya uygular; ızgaranın bilmesi gerekenleri (`page` için görünen satır sayısı) alır. `menu` ve `error`
 * ızgaranındır (DOM ve hata listesi): false döner, ızgara kendisi yapar. İşlendiyse true (olay engellenir).
 */
export function applyIntent<Row extends object>(
  store: SheetStore<Row>,
  intent: Intent,
  env: { pageSize: number },
): boolean {
  switch (intent.type) {
    case 'move':
      store.move(intent.dir, intent.extend)
      return true
    case 'jump':
      store.jump(intent.dir, intent.extend)
      return true
    case 'tab':
      store.tab(intent.back)
      return true
    case 'edge':
      store.edge(intent.end, intent.rows, intent.extend)
      return true
    case 'page':
      store.page(intent.dir, env.pageSize, intent.extend)
      return true
    case 'edit':
      store.startEdit()
      return true
    case 'type':
      return store.startEdit(intent.text)
    case 'commit':
      store.commit()
      if (intent.then === 'tab' || intent.then === 'back') store.tab(intent.then === 'back')
      else store.move(intent.then)
      return true
    case 'cancel':
      store.cancel()
      return true
    case 'collapse':
      store.collapse()
      return true
    case 'toggle':
      store.toggle()
      return true
    case 'clear':
      store.clear()
      return true
    case 'selectAll':
      store.selectAll()
      return true
    case 'selectRow':
      store.selectRow()
      return true
    case 'selectColumn':
      store.selectColumn()
      return true
    case 'undo':
      store.undo()
      return true
    case 'redo':
      store.redo()
      return true
    case 'error':
    case 'menu':
      return false
  }
}
