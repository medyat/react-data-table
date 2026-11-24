// Platforma göre kısayol gösterimi (08 §3): macOS `⌘ ⌥ ⇧`, diğerleri `Ctrl Alt Shift`.
export const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOVE_KBD = { left: mac ? '⌥⇧←' : 'Alt+Shift+←', right: mac ? '⌥⇧→' : 'Alt+Shift+→' }
export const SAVE_KBD = mac ? '⌘S' : 'Ctrl+S'
export const UNDO_KBD = mac ? '⌘Z' : 'Ctrl+Z'
export const REDO_KBD = mac ? '⌘⇧Z' : 'Ctrl+Y'
export const FIND_KBD = mac ? '⌘F' : 'Ctrl+F'
export const FILL_KBD = mac ? '⌘D' : 'Ctrl+D'
export const REMOVE_KBD = mac ? '⌘−' : 'Ctrl+−'
export const CUT_KBD = mac ? '⌘X' : 'Ctrl+X'
export const COPY_KBD = mac ? '⌘C' : 'Ctrl+C'
export const PASTE_KBD = mac ? '⌘V' : 'Ctrl+V'
export const ALL_KBD = mac ? '⌘A' : 'Ctrl+A'
export const CLEAR_KBD = mac ? '⌫' : 'Del'
export const ROW_KBD = mac ? '⇧Space' : 'Shift+Space'
export const COLUMN_KBD = mac ? '⌃Space' : 'Ctrl+Space'
