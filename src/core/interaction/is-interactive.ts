// Tek guard (05 §7, 07 §5, brief §5.4): hücredeki etkileşimli öğeye tıklama yalnızca o öğeyi çalıştırır;
// satır tıklaması, seçim ve düzenleme başlatma tetiklenmez. Geliştirici stopPropagation yazmaz.

export const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="menuitem"], [role="checkbox"], [role="combobox"], [role="switch"], [contenteditable="true"]'

/** `target`, `within` içindeki etkileşimli bir öğenin içinde mi? */
export function isInteractive(target: EventTarget | null, within: Element): boolean {
  if (!(target instanceof Element)) return false
  const hit = target.closest(INTERACTIVE_SELECTOR)
  return hit !== null && hit !== within && within.contains(hit)
}

/** Odak alınca kendi ok tuşlarını kullanan öğeler: ızgara bunlara karışmaz. */
export const isTextInput = (el: Element | null): boolean =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  el?.getAttribute('role') === 'combobox' ||
  (el as HTMLElement | null)?.isContentEditable === true

/** Metin seçimiyle biten tıklama satır tıklaması sayılmaz. */
export const hasTextSelection = (): boolean => (globalThis.getSelection?.()?.toString().length ?? 0) > 0

/** Satır tıklaması sayılmayan durumlar: etkileşimli hedef, metin seçimi, sürükleme, değiştirici tuş, sol dışı düğme. */
export function isPlainRowClick(
  event: MouseEvent,
  rowEl: Element,
  downPoint: { x: number; y: number } | null,
): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (isInteractive(event.target, rowEl)) return false
  if (hasTextSelection()) return false
  if (downPoint && Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y) > 4) return false
  return true
}
