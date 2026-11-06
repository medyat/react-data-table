// Satır sıralama (R21): @dnd-kit bağlamı ve satır başına sortable. Tembel yüklenir (Grid): `reorder` açık değilse @dnd-kit
// çekirdek pakete girmez. Klavye (tutamakta Space al · ↑↓ · Space bırak · Esc) ve duyurular Columns dialog'uyla aynı (D22 revize).
// Satırlar sanal: kenarda liste kayar, yeni çizilenler hedef olur (Grid sürüklerken konumu `top` ile verir); yalnızca dikey kayma.
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ReactNode } from 'react'
import { useDataTableContext } from '../provider'

/** Tutamağa bağlanan ref ve dnd-kit öznitelik / dinleyicileri. */
export interface HandleBind {
  ref: (el: HTMLElement | null) => void
  props: Record<string, unknown>
}

export interface SortableState {
  setNodeRef: (el: HTMLElement | null) => void
  /** Sürükleme sırasındaki dikey kayma (px). */
  y: number
  transition?: string
  dragging: boolean
  handle: HandleBind
}

// Tıklama sürükleme sayılmaz: tutamağa basıp bırakmak hiçbir şey yapmaz.
const ACTIVATION = { distance: 4 }

export default function SortableRows<Item>({
  ids,
  labelOf,
  disabled,
  onMove,
  onActive,
  items,
  keyOf,
  render,
}: {
  /** Gösterilen bütün satırların sırası (çizili olmayanlar dahil). */
  ids: string[]
  labelOf: (id: string) => string
  /** Önceki taşıma sürerken. */
  disabled: boolean
  onMove: (from: number, to: number) => void
  /** Sürüklenen satırın indeksi; bitince −1 (sanal listede DOM'dan çıkmasın). */
  onActive: (index: number) => void
  items: Item[]
  keyOf: (item: Item) => string
  render: (item: Item, state: SortableState) => ReactNode
}) {
  const { i18n } = useDataTableContext()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const at = (id: UniqueIdentifier, position: UniqueIdentifier = id) => ({
    row: labelOf(String(id)),
    position: ids.indexOf(String(position)) + 1,
    total: ids.length,
  })
  const announcements: Announcements = {
    onDragStart: ({ active }) => i18n.t('reorder.dragStart', at(active.id)),
    // Hedef kaynağın kendisiyse (yer değişmedi) duyurulmaz.
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id ? i18n.t('reorder.dragOver', at(active.id, over.id)) : undefined,
    onDragEnd: ({ active, over }) => i18n.t('reorder.dragEnd', at(active.id, over?.id)),
    onDragCancel: ({ active }) => i18n.t('reorder.dragCancel', at(active.id)),
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    onActive(-1)
    if (!over || active.id === over.id) return
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => onActive(ids.indexOf(String(active.id)))}
      onDragEnd={onDragEnd}
      onDragCancel={() => onActive(-1)}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: i18n.t('reorder.instructions') },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={keyOf(item)} id={keyOf(item)} disabled={disabled} render={(s) => render(item, s)} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  disabled,
  render,
}: {
  id: string
  disabled: boolean
  render: (state: SortableState) => ReactNode
}) {
  const s = useSortable({ id, disabled })
  return render({
    setNodeRef: s.setNodeRef,
    y: s.transform?.y ?? 0,
    transition: s.transition,
    dragging: s.isDragging,
    handle: { ref: s.setActivatorNodeRef, props: { ...s.attributes, ...s.listeners } },
  })
}
