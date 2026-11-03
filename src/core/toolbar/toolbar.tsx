// Toolbar (05 §3, §11; T1, T13): yalnızca yapılandırılmış yuvalar; daralma kartın genişliğiyle (`size`, DataTable ölçer).
// Sıra: görünüm · [arama · Filter] (tam ortada) · [Display · ⋯] │ birincil (köşeli parantez: birleşik düğme grubu, D43).
// Görünüm (3b), arama ve Filter (3a) yuvaları ilgili fazda dolar; telefon düzeni Faz 7.
import type { ReactNode } from 'react'

export type ToolbarSize = 'full' | 'narrow' | 'phone'

export function Toolbar({
  size,
  display,
  more,
  end,
}: {
  size: ToolbarSize
  display?: ReactNode
  more?: ReactNode
  /** Ekrana özgü birincil aksiyon (R3: Vue'daki `#toolbar-end` slot'u). */
  end?: ReactNode
}) {
  return (
    <div className={`dt-toolbar is-${size} is-zoned`} role="toolbar">
      <div className="dt-toolbar-side is-start" />
      <div className="dt-btn-group" />
      <span className="dt-toolbar-spacer" />
      <div className="dt-toolbar-side is-end">
        <div className="dt-btn-group">
          {display}
          {more}
        </div>
        {end && (
          <>
            <span className="dt-toolbar-sep" aria-hidden="true" />
            <span className="dt-toolbar-end">{end}</span>
          </>
        )}
      </div>
    </div>
  )
}
