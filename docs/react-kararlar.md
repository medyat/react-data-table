# React kararları

**Durum:** Taslak, 2026-11-03.

Bu paket `@medyat/vue-data-table`'ın liste bileşeninin (`DataTable`) React karşılığıdır. Davranış,
tasarım ve ürün kararlarının kaynağı Vue paketinin spesifikasyonudur
(`../data-table/docs/data-table/`, karar günlüğü D1–D47; tasarımlar `../data-table/design/`,
teslim belgeleri `../data-table/docs/handoff/`). Bu belge yalnızca React'te **farklı** olan
kararları yazar. Burada geçmeyen her konuda Vue spesifikasyonu geçerlidir.

İlke: Vue paketinin iyi yanları aynen alınır; Vue'ya özgü ya da zayıf kalan yerler React'in yerleşik
kalıplarıyla yeniden kurulur. Bir karar burada değişiyorsa nedeni de yazılır.

## R1 · Kapsam

- Yalnızca liste: `DataTable`. `DataSheet` ve ona özgü her şey (hücre düzenleme, pano, doldurma,
  geri al, içe aktarma, `@save`/`applyResult`) bu sürümde yok. Mimari onu dışlamaz: çekirdek iki
  bileşen kuralıyla (01 · "iki kuralı") kurulur, sheet ileride ayrı giriş noktası olur.
- Sütun sözleşmesinden yalnızca sheet'e ait alanlar çıkar: `editable`, `editor`, `validate`,
  `warn`, `importAliases`, `hint`, `optionEnabled`. `core/editors` kalır: filtre çipleri kullanır.
- Dışa aktarma (D46) vardır; içe aktarma yoktur.

## R2 · Sözleşme önce

Public tipler (`types/`) koddan önce yazılır ve Vue'daki `api-draft.ts` / `src/types` ile aynı
adları taşır: `ColumnDef` (23 tip, ayrışan birleşim), `CellContext`, `FilterCondition` (operatöre
göre ayrışan değer), `TableQuery`, `ColumnLayout`, `View`, `RowAction`, `BulkAction`. Tipe bağlı
davranışın tek kaynağı `TYPE_SPECS`'tir (hizalama, genişlik, iskelet, sıralanabilir, filtrelenebilir,
aranabilir, sayısal); biçim, hücre, operatör ve ikon bu tablodan türer. Public API'de TanStack tipi
yoktur (D23).

## R3 · API biçimi: hook + bileşen

Vue: tek bileşen, prop + emit (`@request`, `@view-change`…) ve `createDataTable` plugin'i.
React: **`useDataTable(options)` + `<DataTable table result />`.**

```tsx
const table = useDataTable({ id: "products", columns, views, state, onStateChange })
const result = useQuery({
  queryKey: ["products", table.request],
  queryFn: ({ signal }) => fetchProducts(table.request, signal),
  placeholderData: keepPreviousData,
})
return <DataTable table={table} result={result} primary={<Button>New</Button>} />
```

Neden: React'te mantık hook'ta, görünüm bileşende yaşar; olay yayıp sonucu prop olarak geri almak
React'te iki kaynaklı durum demektir. Hook ekranın başka yerlerine de durum verir (başlıkta kayıt
sayısı, seçili satırlar), ayrıca `ref` ile imperative handle gerekmez. Ekrana özgü parçalar
(`primary`, araç çubuğu sonu, boş durum aksiyonları) prop olarak verilir; Vue'daki slot'ların
karşılığı `ReactNode` prop'larıdır.

## R4 · Veri akışı

Vue'da paket `@request { query, reason, signal }` yayar; bekleyen istek, snapshot ve abort paketin
`useRequest`'indedir. React'te bu işleri sorgu kütüphanesi (TanStack Query) zaten yapar; paket onları
yeniden yazmaz.

- Hook isteği üretir: `table.request` (`TableQuery`: arama, filtreler, sıralama, sayfa, görünür
  sütunlar, `fields`). `fields` yalnızca görünür sütunlardan ve koddaki sırayla kurulur: sütun
  taşımak istek üretmez, gizli sütunu açmak üretir.
- Paket veri çekmez (D18 korunur). Sonucu `result` olarak alır. `result`'ın tipi TanStack Query'nin
  `UseQueryResult`'ının yapısal alt kümesidir (`data`, `status`, `error`, `isFetching`,
  `isPlaceholderData`, `dataUpdatedAt`, `refetch`): TanStack Query sonucu dönüştürülmeden verilir,
  paket ise TanStack Query'ye bağımlı değildir. `data` = `{ rows, hasMore, total?, ignoredFields? }`.
- Yükleme geçişi (05 §10) isteğin nedeninden türer. Paket önceki ve yeni isteği karşılaştırır:
  sorgu veya sayfa değiştiyse kimlik değiştiren (soluk + `inert`, 400 ms sonra iskelet, hata →
  Error), yalnızca `fields` genişlediyse ya da `refetch` ise kimlik koruyan (satırlar etkileşimli,
  150 ms sonra çubuk, hata → Stale). Sunucu yetkisiz alanı `ignoredFields` ile yol olarak bildirir;
  sıra numarası eşleme yoktur.
- İstemci modu (D-mode `client`) kalır: `rows` verilirse paket TanStack row model'leriyle filtreler,
  sıralar, sayfalar; `request` üretilmez.

## R5 · Durum: controlled / uncontrolled

Vue'da durum paketin içindedir, adres senkronizasyonu yoktur (D25). React'te durum React'in yerleşik
kalıbıyla açılır: `state` + `onStateChange` verilirse controlled, verilmezse `initialState` ile
uncontrolled.

`TableState = { view, search, filters, sort, page, pageSize, layout }`. Paket adres okumaz, yazmaz
(D25 paket için geçerli); ama uygulama durumu tek satırda adrese bağlayabilir. Swors, filtre/sıralama/
sayfa/görünümü adreste, sütun düzenini bellekte tutar.

## R6 · Görünümler

Menü, diyaloglar, "düzenlendi" hesabı, varsayılan görünüm ve görünüm başına kaydedilmemiş taslak
paketin içindedir (04, D4, D5, D27, D30). Kalıcılık `ViewsAdapter` ile: `list / create / update /
remove`, hepsi `Promise`. Hazır `createLocalStorageViews({ scope })` gelir; backend gelince uygulama
kendi adaptörünü yazar. Eşitlik karşılaştırması sıradan bağımsızdır (filtre ve `in` değerleri),
sıralama anahtarlarında sıralıdır.

## R7 · Provider

`createDataTable` plugin'i yerine `<DataTableProvider locale messages viewsAdapter preferences>`.
Paket React context dışında global durum tutmaz; aynı sayfada iki tablo birbirini etkilemez.

## R8 · i18n

Paket kendi metinlerini taşır (`en`, `tr`, `ru`), i18next'e bağımlı değildir. Çoğul `Intl.PluralRules`
ile. Uygulama `locale` verir ve gerekirse `messages` ile anahtar ezer.

`en` ve `tr` Vue'daki 09-i18n.md'den üretilir (`pnpm gen:docs`); sheet ve içe aktarma bölümleri atlanır.
`ru` elle yazılır. Rusçada few/many ikisi de `.other`'a düştüğü için sayılı metinler sayıdan bağımsız
kalıpla yazılır ("Выбрано: {count}"). Sağlayıcı `locale` değişince metinler sayfa yenilenmeden değişir.

## R9 · Stil

Vue'daki gibi derlenmiş CSS + `--dt-*` token'ları; Tailwind sınıfı kullanılmaz (paket tüketicinin
Tailwind sürümüne ve `@source` ayarına bağlanmasın). CSS `@layer medyat-dt` içindedir, uygulama
katman sırasıyla ezer. Durumlar `data-*` öznitelikleriyle (`data-state`, `data-density`,
`data-pinned`) çizilir. `shadcn-bridge.css` Tailwind v4 shadcn temasına bağlar.

Kontrol yüksekliği ve yarıçap ölçeği Vue'da zaten token'dır (`--dt-control-h` ve türevleri, `--dt-radius-*`;
D41); değerler aynen alınır. Uygulama farklı boyut isterse token'ı ezer.

Vue'dan farkı: köprü dahil tüm CSS `@layer medyat-dt` içindedir. Tailwind v4 kullanan uygulama katmanı
`utilities`'den önce bildirir (`@layer theme, base, medyat-dt, components, utilities;`); böylece
uygulamanın sınıfları paketi ezer, paket uygulamanın temel stillerini ezer.

## R10 · Bağımlılıklar

| Konu | Seçim | Not |
|---|---|---|
| Primitifler | `@base-ui/react` (peer) | reka-ui'nin karşılığı; Swors aynı kütüphaneyi kullanır |
| Tablo mantığı | `@tanstack/react-table` 9.x | D23 sınırı aynen |
| Sanal satırlar | `@tanstack/react-virtual` | |
| Sürükle-bırak | `@dnd-kit/core` + `@dnd-kit/sortable` | Yalnızca Columns dialog'unda, tembel yüklenir |
| İkonlar | `@phosphor-icons/react` (peer) | |
| Excel | `write-excel-file` (peer, `import()`) | D46 |

`react` ve `react-dom` 19 peer'dır.

## R11 · React Compiler

Paket kaynak kodu derleyiciye uygun yazılır ve kütüphane derlemesinde React Compiler'dan geçer;
tüketicinin derleyicisi `node_modules`'ü işlemez. TanStack Table ve Virtualizer örneğini değiştirerek
çalışan dosyalar `"use no memo"` ile dışarıda kalır (Swors'ta derleyicinin bu nesneleri önbelleğe
alması ekranı donduruyordu). Faz 1'de ölçülerek doğrulanır.

## R12 · Laraql

Paket Laraql'ı bilmez. `TableQuery`'nin operatörleri Laraql'ınkilerle aynıdır; uygulama isteği tek bir
fonksiyonla Laraql gövdesine çevirir ve `ignored` yollarını `ignoredFields`'a koyar.

## R13 · Depo ve araçlar

pnpm, TypeScript `strict`, Vite library mode (ESM + `.d.ts`, tek giriş), ESLint import sınırları
(`core/*` yalnızca `core/*`; `list/` yalnızca `core/`; TanStack yalnızca D23'teki dosyalarda),
Vitest + Testing Library, Playwright. `playground/`: her tasarım board'u için bir rota, tema /
yoğunluk / dil anahtarı, Vue paketindeki sahte Laravel API'sinin uyarlaması.

Swors geliştirme sırasında paketi yerel bağımlılık ve Vite alias'ıyla kaynaktan okur; npm'e sözleşme
oturunca çıkar.

## Yol haritası

Vue 10-roadmap'in liste fazları, aynı kabul kriterleriyle:

| Faz | Kapsam |
|---|---|
| 0 | Kurulum, token'lar, i18n, provider, playground — **tamam** |
| 1 | Izgara, hücre tipleri, `cell` / `actions`, etkileşim guard'ı, sanal gövde |
| 2 | Veri akışı (R4), durumlar, sıralama, sayfalama, araç çubuğu, sütun yönetimi |
| 3a | Filtreler ve arama |
| 3b | Görünümler (R6) ve tercihler |
| 4 | Seçim, bulk bar, satır etkileşimleri |
| 7 | Telefon, erişilebilirlik turu, belgeler |

Swors'un ürün ekranı 3b'den sonra pakete geçer. O zamana kadar Swors'taki `DataTable`'a özellik
eklenmez.
