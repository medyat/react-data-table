// Manage columns dialog'u (05 §5, D45): solda konumsal sabitleme (ilk / son 0–2 sütun), sağda bul · liste (tutamaç · göster/gizle).
// Taslak üzerinde çalışır: Save tek seferde uygular, kapatmak ya da Cancel hiçbir şeyi değiştirmez. Sıralama @dnd-kit ile
// sürükle-bırak ve klavye (Space al · ↑↓ · Space bırak · Esc); ekran okuyucu duyuruları i18n'den (D22 revize).
// Tembel yüklenir (DisplayPopover): @dnd-kit çekirdek pakete girmez.
import { Dialog } from '@base-ui/react/dialog'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVerticalIcon, LockIcon, MagnifyingGlassIcon, PushPinIcon } from '@phosphor-icons/react'
import { useState, type RefObject } from 'react'
import type { ColumnsDraft, PanelColumn } from '../columns/use-column-layout'
import { useDataTableContext } from '../provider'
import { DtSwitch } from '../ui/switch'

const PIN_COUNTS = [0, 1, 2] as const
type Side = 'start' | 'end'

export default function ColumnsDialog<Row extends object>({
  open,
  onOpenChange,
  columns,
  onSave,
  finalFocus,
  phone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: Array<PanelColumn<Row>>
  onSave: (draft: ColumnsDraft) => void
  /** Açan popover kapandığı için odak buraya döner. */
  finalFocus: RefObject<HTMLElement | null>
  /** Telefon: sabitleme yok (yalnızca birincil sütun başta); kaydetmek mevcut sabitleme sayılarını korur. */
  phone?: boolean
}) {
  const { i18n } = useDataTableContext()
  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dt-scrim" />
        <Dialog.Popup
          className={phone ? 'dt-dialog dt-cols-dialog is-phone' : 'dt-dialog dt-cols-dialog'}
          finalFocus={finalFocus}
          aria-describedby={undefined}
          // Popup ok tuşlarının yayılmasını durdurur; klavyeyle sürüklerken dnd-kit tuşları window'da dinler.
          onKeyDown={(e) => {
            if ((e.target as HTMLElement).closest('[aria-pressed="true"]')) e.preventBaseUIHandler()
          }}
        >
          <Dialog.Title className="dt-sr-only">{i18n.t('display.columns')}</Dialog.Title>
          {/* Popup kapanınca söküldüğü için gövde her açılışta taslağı sütunlardan yeniden kurar. */}
          <Body columns={columns} onSave={onSave} close={() => onOpenChange(false)} phone={phone} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Body<Row extends object>({
  columns,
  onSave,
  close,
  phone,
}: {
  columns: Array<PanelColumn<Row>>
  onSave: (draft: ColumnsDraft) => void
  close: () => void
  phone?: boolean
}) {
  const { i18n } = useDataTableContext()
  const pinCount = (side: Side) => Math.min(2, columns.filter((c) => c.pinned === side && c.visible && !c.fixed).length)
  const [rows, setRows] = useState(() => columns.map((c) => ({ ...c })))
  const [pins, setPins] = useState({ start: pinCount('start'), end: pinCount('end') })
  const [find, setFind] = useState('')

  const fixedRows = rows.filter((c) => c.fixed)
  const needle = find.toLocaleLowerCase()
  const listed = rows.filter((c) => !c.fixed && (!find || c.def.header.toLocaleLowerCase().includes(needle)))
  /** Kaydedilince sabitlenecek sütunlar: listede raptiye ile gösterilir. */
  const free = rows.filter((c) => c.visible && !c.fixed).map((c) => c.id)
  const left = free.slice(0, pins.start)
  const willPin = new Set(phone ? [] : [...left, ...(pins.end ? free.slice(left.length).slice(-pins.end) : [])])
  const hideable = rows.filter((c) => c.canHide && !c.fixed)
  const allShown = hideable.every((c) => c.visible)

  const setVisible = (id: string, visible: boolean) =>
    setRows((all) => all.map((c) => (c.id === id ? { ...c, visible } : c)))
  const toggleAll = () => {
    const v = !allShown
    setRows((all) => all.map((c) => (c.canHide && !c.fixed ? { ...c, visible: v } : c)))
  }
  const save = () => {
    onSave({ order: rows.map((c) => c.id), visible: rows.filter((c) => c.visible).map((c) => c.id), ...pins })
    close()
  }

  // Arama yokken listed = sabit olmayan tüm satırlar; aramada sıralama kapalı.
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = listed.map((c) => c.id)
    const moved = arrayMove(listed, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    setRows([...fixedRows, ...moved])
  }
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const at = (id: UniqueIdentifier, position: UniqueIdentifier = id) => ({
    column: rows.find((c) => c.id === id)?.def.header ?? String(id),
    position: listed.findIndex((c) => c.id === position) + 1,
    total: listed.length,
  })
  const announcements: Announcements = {
    onDragStart: ({ active }) => i18n.t('columns.dragStart', at(active.id)),
    // Hedef kaynağın kendisiyse (yer değişmedi) duyurulmaz.
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id ? i18n.t('columns.dragOver', at(active.id, over.id)) : undefined,
    onDragEnd: ({ active, over }) => i18n.t('columns.dragEnd', at(active.id, over?.id)),
    onDragCancel: ({ active }) => i18n.t('columns.dragCancel', at(active.id)),
  }

  return (
    <>
      <div className="dt-cols-body">
        {!phone && (
          <div className="dt-cols-pins">
            {(['start', 'end'] as const).map((side) => (
              <section key={side} className="dt-cols-section">
                <h3 id={`dt-cols-${side}`} className="dt-cols-title">
                  {i18n.t(`columns.pin.${side}.title`)}
                </h3>
                <p className="dt-cols-desc">{i18n.t(`columns.pin.${side}.desc`)}</p>
                <RadioGroup
                  className="dt-radio-group"
                  aria-labelledby={`dt-cols-${side}`}
                  value={pins[side]}
                  onValueChange={(v) => setPins((p) => ({ ...p, [side]: Number(v) }))}
                >
                  {PIN_COUNTS.map((n) => (
                    <label key={n} className="dt-radio-row">
                      <Radio.Root
                        className="dt-radio"
                        value={n}
                        data-state={pins[side] === n ? 'checked' : 'unchecked'}
                      >
                        <Radio.Indicator className="dt-radio-dot" />
                      </Radio.Root>
                      {i18n.t(`columns.pin.${side}.${n}`)}
                    </label>
                  ))}
                </RadioGroup>
              </section>
            ))}
          </div>
        )}
        <section className="dt-cols-section dt-cols-main">
          <h3 className="dt-cols-title">
            {i18n.t('columns.title')}
            <span className="dt-pop-value">
              {i18n.t('columns.shownOf', { shown: rows.filter((c) => c.visible).length, total: rows.length })}
            </span>
          </h3>
          <p className="dt-cols-desc">{i18n.t('columns.desc')}</p>
          <label className="dt-input has-icon dt-cols-find">
            <span className="dt-input-icon">
              <MagnifyingGlassIcon size={14} aria-hidden="true" />
            </span>
            <input
              type="search"
              value={find}
              placeholder={i18n.t('columns.find')}
              aria-label={i18n.t('columns.find')}
              onChange={(e) => setFind(e.target.value)}
            />
          </label>
          {/* dnd-kit canlı bölgesini yerinde çizer: listenin dışında ama dialog'un içinde kalmalı (ul yalnızca li alır). */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: i18n.t('columns.dragInstructions') },
            }}
          >
            <ul className="dt-cols-list">
              {!find &&
                fixedRows.map((c) => (
                  <li key={c.id} className="dt-col-row is-fixed">
                    <Name column={c} />
                    <LockIcon size={14} className="dt-col-lock" aria-label={i18n.t('columns.alwaysShown')} />
                  </li>
                ))}
              <SortableContext items={listed.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {listed.map((c) => (
                  <SortableRow
                    key={c.id}
                    column={c}
                    disabled={!!find}
                    pinned={willPin.has(c.id)}
                    onVisible={(v) => setVisible(c.id, v)}
                  />
                ))}
              </SortableContext>
            </ul>
          </DndContext>
        </section>
      </div>
      <div className="dt-cols-foot">
        <button type="button" className="dt-btn" onClick={toggleAll}>
          {i18n.t(allShown ? 'columns.hideAll' : 'columns.showAll')}
        </button>
        <span className="dt-pop-end" />
        <Dialog.Close className="dt-btn">{i18n.t('common.cancel')}</Dialog.Close>
        <button type="button" className="dt-btn dt-btn-primary" onClick={save}>
          {i18n.t('common.save')}
        </button>
      </div>
    </>
  )
}

function Name<Row extends object>({ column, pinned }: { column: PanelColumn<Row>; pinned?: boolean }) {
  const { i18n } = useDataTableContext()
  return (
    <span className="dt-col-name">
      <span>
        {column.def.header}
        {pinned && <PushPinIcon size={12} className="dt-col-pin" aria-label={i18n.t('columns.pinned')} />}
      </span>
      {column.def.description && <span className="dt-col-desc">{column.def.description}</span>}
    </span>
  )
}

/** Sıralanabilir satır: sürükleme yalnızca tutamaçtan (fare, dokunma, klavye). */
function SortableRow<Row extends object>({
  column,
  disabled,
  pinned,
  onVisible,
}: {
  column: PanelColumn<Row>
  /** Arama süzerken kapalı: süzülmüş listede taşımak gizli satırların yerini belirsizleştirir. */
  disabled: boolean
  pinned: boolean
  onVisible: (visible: boolean) => void
}) {
  const { i18n } = useDataTableContext()
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled,
  })
  const cls = ['dt-col-row', !column.visible && 'is-hidden', isDragging && 'is-dragging']
  return (
    <li
      ref={setNodeRef}
      className={cls.filter(Boolean).join(' ')}
      data-col={column.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="dt-icon-btn-xs dt-col-handle"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={i18n.t('columns.reorder', { column: column.def.header })}
      >
        <DotsSixVerticalIcon size={16} weight="bold" aria-hidden="true" />
      </button>
      <Name column={column} pinned={pinned} />
      <DtSwitch
        className="dt-col-switch"
        checked={column.visible}
        disabled={!column.canHide}
        label={column.def.header}
        onChange={onVisible}
      />
    </li>
  )
}
