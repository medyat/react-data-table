# @medyat/react-data-table

React 19 için liste tablosu (`DataTable`). Davranış ve tasarım `@medyat/vue-data-table` ile aynı sözleşmeye dayanır;
spesifikasyon Vue paketinin `docs/data-table/` klasöründedir, React'e özgü kararlar ve Vue'dan sapmalar
`docs/react-kararlar.md`'de. Toplu düzenleme (`DataSheet`) ve içe aktarma bu pakette yok (R1).

Paket veri çekmez ve kaydetmez (D18): istek nesnesini üretir, uygulama onu kendi sorgu katmanıyla (önerilen TanStack Query)
çalıştırır ve sonucu tabloya verir.

## Kurulum

```bash
pnpm add @medyat/react-data-table @base-ui/react @phosphor-icons/react write-excel-file
```

```tsx
import { createLocalStoragePreferences, createLocalStorageViews, DataTableProvider } from '@medyat/react-data-table'
import '@medyat/react-data-table/style.css'
import '@medyat/react-data-table/shadcn-bridge.css' // shadcn teması kullanılıyorsa, style.css'ten sonra (HSL tema: shadcn-bridge-hsl.css)

;<DataTableProvider
  locale="tr" // en · tr · ru; verilmezse navigator.language
  viewsAdapter={createLocalStorageViews({ scope: tenantId })} // kişisel görünümler; backend için kendi ViewsAdapter'ınız
  preferences={createLocalStoragePreferences({ scope: tenantId })} // yoğunluk, dikey çizgiler, sayfa boyutu, varsayılan görünüm
>
  <App />
</DataTableProvider>
```

Sağlayıcı isteğe bağlıdır; yoksa paket metinleri ve tarayıcı dili kullanılır, görünüm ve tercih kaydedilmez. `messages`
ile tek tek metin anahtarı ezilebilir.

Backend'e bağlamak (Laravel + Laraql: liste sorgusu, kişisel görünümler, kullanıcı tercihleri) için
[`docs/backend-integration.md`](docs/backend-integration.md).

## Kullanım

`useDataTable` durumu ve isteği tutar, `<DataTable>` çizer (R3). Sütun tanımları feature'ın kendi dosyasında yaşar.

```tsx
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DataTable, useDataTable, type ColumnDef } from '@medyat/react-data-table'

const columns: Array<ColumnDef<Order>> = [
  { id: 'number', header: 'Order no.', type: 'id', primary: true, href: (r) => `/orders/${r.id}` },
  { id: 'customer', header: 'Customer', type: 'string' },
  { id: 'status', header: 'Status', type: 'select', options: statusOptions, suggested: true },
  { id: 'dueAt', header: 'Due date', type: 'date', overdue: (r) => r.status !== 'done' },
  { id: 'value', header: 'Value', type: 'currency', currency: 'TRY' },
]

export function OrdersScreen() {
  const table = useDataTable({
    id: 'production-orders', // görünümler ve tercihler bu kimlikle saklanır
    columns,
    entityName: { one: 'order', other: 'orders' },
    views: systemViews, // kodda tanımlı system görünümleri; filtresiz "Tümü" hazır gelir (R19), kişisel olanlar viewsAdapter'dan
    count: (query, signal) => api.countOrders(query, signal), // footer'da "Count total"
  })
  const result = useQuery({
    queryKey: ['orders', table.request],
    queryFn: ({ signal }) => api.listOrders(table.request, signal), // → { rows, hasMore, total? }
    placeholderData: keepPreviousData, // yükleme geçişleri için önerilir
  })
  return <DataTable table={table} result={result} toolbarEnd={<NewOrderButton />} />
}
```

`table.request` (`TableQuery`): `search`, `filters` (`FilterCondition[]`), `sort` (`[{ column, dir }]`), `page`
(`{ number, size }`) ve `fields`. Sütun gizlemek, taşımak ya da genişletmek yeni istek üretmez. `result`, `useQuery`
sonucunun kendisidir; paket TanStack Query'ye bağımlı değildir, aynı alanları (`status`, `data`, `error`,
`isFetching`, `isPlaceholderData`, `dataUpdatedAt`, `refetch`) taşıyan herhangi bir nesneyi kabul eder. Hata
nesnesinin `message` ve `id` alanları hata ekranında gösterilir; `refetch` yoksa Refresh ve Retry görünmez.

İstemci modu: `useDataTable({ rows })` verilirse paket kendisi süzer, sıralar ve sayfalar; `result` verilmez.

### Durumu adrese bağlamak

Durum varsayılan olarak tablonun içindedir. `state` + `onStateChange` ile dışarı açılır (R5); paket adrese kendisi
dokunmaz. `state` verilince eksik alan varsayılandır (varsayılan görünüm ve onun filtre/sıralaması, sayfa 1). İkinci argüman
`changed` yalnızca varsayılandan farklı alanları taşır: adrese onu yazın, varsayılan liste temiz adres olur. TanStack Router ile:

```tsx
const search = Route.useSearch() // { view?, search?, filters?, sort?, page?, pageSize? }
const navigate = Route.useNavigate()
const table = useDataTable({
  id: 'production-orders',
  columns,
  state: search,
  onStateChange: (_state, changed) => navigate({ search: changed, replace: true }),
})
```

Yalnızca tam filtre koşulları duruma girer; değeri seçilmemiş çip ekranda kalır. Sütun düzeni durumda değildir, görünüme
ve tercihe gider.

### Satırı açmak

Birincil hücre gerçek bir `<a href>`'tir (D6): ⌘/orta tık tarayıcıya kalır, düz tık `onRowOpen`'ı çağırır. Dinleyici
`preventDefault` yapmazsa tarayıcı bağlantıya gider.

```tsx
<DataTable
  table={table}
  result={result}
  rowClick="open" // satırın boş yerine tık da açar; "expand" detayı açar; varsayılan "none"
  onRowOpen={({ href, event }) => {
    event.preventDefault()
    navigate({ to: href })
  }}
/>
```

### Seçim, aksiyonlar, detay

```tsx
<DataTable
  table={table}
  result={result}
  selectable // seçim sayfa kapsamlı (D19); durum table.selection, temizlemek için table.clearSelection()
  bulkActions={[
    { id: 'release', label: 'Release', icon: PlayIcon, inBar: true, run: (rows) => release(rows) },
    {
      id: 'cancel',
      label: 'Cancel orders…',
      destructive: true,
      disabled: (rows) => (rows.every(isDone) ? 'All already done' : false), // metin döndürülürse gerekçe olarak gösterilir
      run: (rows) => confirmCancel(rows),
    },
  ]}
  rowActions={[
    { id: 'edit', label: 'Edit', icon: PencilSimpleIcon, inline: true, run: (row) => edit(row) },
    { id: 'archive', label: 'Archive', when: (row) => row.status === 'done', run: (row) => archive(row) }, // yoksa görünmez
  ]}
  renderExpanded={({ row }) => <OrderOperations order={row} />} // detay verisini bileşen kendisi çeker
  rowError={(row) => failures.get(row.id)} // satır hatası (D35): zemin, uyarı ikonu, tooltip
/>
```

`run` beklenmez (D20): uzun işlemin onayı, ilerlemesi ve sonucu uygulamanındır. Seçim çubuğu varsayılan olarak kartın
altında yüzer; `bulkActions` ve `selectionActions` yoksa hiç çizilmez (seçim Export'ta ve header checkbox'ında kalır); `selectionBar="toolbar"` onu araç çubuğunun yerine koyar, `selectionActions` içeriğini tümüyle uygulamaya
bırakır. Seçili satırlar `onSelectionChange` ile de okunabilir.

### Diğer

- `toolbar`: `'auto'` (varsayılan; görünümler, arama, Filter, Display, ⋯), `'minimal'` (yalnızca arama ve
  `toolbarEnd`) ya da `false`.
- `autoRefresh={30}`: ⋯ menüsünde Auto-refresh anahtarı; açıkken footer "Live". `onPrint` verilirse ⋯ menüsünde Print.
- `empty`: hiç kayıt yokken (filtre ve arama da yokken) gövdede gösterilecek içerik.
- `notice`: araç çubuğu ile sütun başlıkları arasında uygulamanın şeridi (R16), ör. "Yalnızca arşivlenmiş
  kayıtlar listeleniyor". İçerik, rengi ve rolü uygulamanın; paket yer, yatay hiza ve alt çizgiyi verir.
- Dışa aktarma (D46): ⋯ › **Export 100 rows** › CSV / Excel (.xlsx). Ekranda görünen sütunlar ve satırlar yazılır: seçim
  varsa seçili satırlar, yoksa sayfadaki satırlar (sunucu modunda yüklü sayfa; "tüm eşleşenler" yok). .xlsx için
  `write-excel-file` peer'ı gerekir (`pnpm add write-excel-file`); ilk dışa aktarmada yüklenir. `exportable={false}`
  gizler; `onExport` verilirse paket dosya yazmaz, `{ format, query, selection, rows, visibleColumns }` ile uygulama
  üretir.

## Telefon

Kartın kendi genişliği 640 px'in altındaysa (ekranın değil) telefon düzeni açılır: yalnızca birincil sütun sabit, 48 px
satırlar; filtreler, görünümler, ⋯ ve toplu aksiyonlar alt sayfada. Filters sayfası değişiklikleri taslakta biriktirir,
**Show results** filtreyi ve sıralamayı tek istekte uygular.

## Erişilebilirlik ve klavye

- Kısayollar: `/` arama, `F` filtre, `V` görünümler, `R` yenile, `⌘S` görünümü kaydet, `Alt ←/→` sayfa, `Esc` seçimi
  temizler. Odak bir metin alanındayken tek harfli kısayollar çalışmaz; `shortcuts={false}` onları kapatır.
- Duyurular `aria-live` bölgelerinden; `forced-colors` ve `prefers-reduced-motion` desteklenir.
- Playwright'ta axe-core taraması (`e2e/a11y.spec.ts`): WCAG 2.1 A/AA'da kritik ya da ciddi ihlal kabul edilmez.

Ayrıntılar Vue spesifikasyonunun `08-accessibility-keyboard.md`'sinde; React'teki farklar `docs/react-kararlar.md`'de.

## Stil

Tüm CSS `@layer medyat-dt` içindedir. Tailwind v4'te katmanı `utilities`'den önce bildirin; uygulamanın sınıfları
paketi ezsin:

```css
@layer theme, base, medyat-dt, components, utilities;
```

Tema `.dark` sınıfı ya da `data-theme="dark"` ile değişir. Yoğunluk kullanıcının Display › Density seçiminden gelir;
`useDataTable({ density })` onu sabitler ve seçiciyi gizler.

## Geliştirme

Node 22+ ve pnpm (corepack ile): `corepack enable` bir kez, sonra `pnpm install`. Vue paketi kardeş klasörde
(`../data-table`) bulunmalıdır: token ve metinler oradaki belgelerden üretilir, karşılaştırma testleri oradan okur
(yoksa atlanır; başka yerdeyse `DT_SPEC`).

| Komut                          | Ne yapar                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Playground (`playground/`, http://localhost:5175); sahte API `/api/orders`                  |
| `pnpm test`                    | Vitest: bileşenler, token ↔ 02, kontrast, i18n ↔ 09                                         |
| `pnpm test:e2e`                | Playwright, kendi playground'una karşı (port 5179); axe taraması                            |
| `pnpm typecheck` · `pnpm lint` | tsc, ESLint                                                                                 |
| `pnpm format`                  | Prettier                                                                                    |
| `pnpm build`                   | `dist/`: `index.js`, `style.css`, köprü CSS'leri, `.d.ts`                                   |
| `pnpm gen:docs`                | 02 → `src/styles/tokens.css`, 09 → `src/core/i18n/{en,tr}.ts` (üretilmiş, elle düzenlenmez) |
| `pnpm check`                   | typecheck + lint + format kontrolü + test + build                                           |

Token ve metin değişikliği Vue belgesinde yapılır, sonra `pnpm gen:docs`. React'e özgü metin sapmaları
`scripts/docs.ts` içindeki `REACT_MESSAGES`'tadır; `ru` elle yazılır.

## Lisans

MIT · © 2026 Medyat
