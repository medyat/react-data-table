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

- Hook isteği üretir: `table.request` (`TableQuery`: arama, filtreler, sıralama, sayfa, `fields`).
  Uygulama onu sorgu anahtarına koyar; bu yüzden istekte yalnızca sunucuyu ilgilendiren alanlar
  vardır. Vue'daki `columns` (görünür sütunlar, ekran sırasıyla) yoktur: anahtara girince her sütun
  taşıma yeni bir istek olurdu. `fields` görünür sütunlardan, koddaki sırayla kurulur ve yalnızca
  yeni görünen bir sütunun alanı listede yoksa ya da sorgu değişince yenilenir: gizlemek, taşımak ve
  genişlik istek üretmez. Vue'daki 400 ms birleştirme yoktur: Columns dialog'u tek kayıtta uygular.
- Paket veri çekmez (D18 korunur). Sonucu `result` olarak alır. `result`'ın tipi TanStack Query'nin
  `UseQueryResult`'ının yapısal alt kümesidir (`data`, `status`, `error`, `isFetching`,
  `isPlaceholderData`, `dataUpdatedAt`, `refetch`): TanStack Query sonucu dönüştürülmeden verilir,
  paket ise TanStack Query'ye bağımlı değildir. `data` = `{ rows, hasMore, total?, ignoredFields? }`.
- Yükleme geçişi (05 §10) isteğin kimliğinden türer (arama + filtre + sıralama + sayfa). Paket,
  ekrandaki verinin hangi kimliğe ait olduğunu bir snapshot'ta tutar; snapshot yalnızca yeni veriyle
  (`data` referansı ya da `dataUpdatedAt` değişince) ilerler, istek değişip sonuç henüz gelmediyse
  ilerlemez. Kimlik snapshot'tan farklıyken süren yükleme kimlik değiştirendir (soluk + `inert`,
  400 ms sonra iskelet, hata → Error); aynıyken (`refetch`, yalnızca `fields` genişlemesi) kimlik
  korur (satırlar etkileşimli, 150 ms sonra çubuk, hata → Stale). Hata türü TanStack Query'nin
  davranışından okunur: aynı anahtarın yenileme hatasında `data` kalır (Stale), yeni anahtarın
  hatasında yoktur (Error). Footer'ın sayfası ve "Updated …" zamanı snapshot'tandır.
- `placeholderData: keepPreviousData` önerilir; verilmezse her sorgu değişimi ilk yükleme gibi
  iskelete döner (hata değil, yalnızca geçiş kaybolur).
- Count total: `useDataTable({ count: (query, signal) => Promise<number> })`. Sonuç arama, filtre
  ve sıralama değişene kadar geçerlidir; değişince bekleyen sayım iptal edilir. Sunucu yanıtta
  `total` verirse o kullanılır.
- Sunucu yetkisiz alanı `ignoredFields` ile yol olarak bildirir (Faz 3b); sıra numarası eşleme yoktur.
- İstemci modu (D-mode `client`) kalır: `rows` verilirse paket TanStack row model'leriyle filtreler,
  sıralar, sayfalar; `request` üretilmez.

## R5 · Durum: controlled / uncontrolled

Vue'da durum paketin içindedir, adres senkronizasyonu yoktur (D25). React'te durum React'in yerleşik
kalıbıyla açılır: `state` + `onStateChange` verilirse controlled, verilmezse `initialState` ile
uncontrolled.

`TableState = { view, search, filters, sort, page, pageSize, layout }`; alanlar fazlarla eklenir (Faz 2:
`sort`, `page`, `pageSize`; Faz 3a: `search`, `filters`; Faz 3b: `view`). `filters` yalnızca tam koşulları taşır: değeri
seçilmemiş çip ekranda kalır, duruma ve adrese girmez. Her alan ayrı ayrı controlled olabilir: `state`'te verilen alan dışarıdan
okunur, diğerleri içeride kalır (TanStack Table'ın `state` kalıbı). Uncontrolled sayfa boyutu
tercihten (`preferences`) gelir; sayfa boyutu değişimi controlled olsa da tercihe yazılır.

Paket adres okumaz, yazmaz (D25 paket için geçerli); ama uygulama durumu tek satırda adrese bağlayabilir. Swors, filtre/sıralama/
sayfa/görünümü adreste, sütun düzenini bellekte tutar.

## R6 · Görünümler

Menü, diyaloglar, "düzenlendi" hesabı, varsayılan görünüm ve görünüm başına kaydedilmemiş taslak
paketin içindedir (04, D4, D5, D27, D30). Kalıcılık `ViewsAdapter` ile: `list / create / update /
remove`, hepsi `Promise`. Hazır `createLocalStorageViews({ scope })` gelir; backend gelince uygulama
kendi adaptörünü yazar. Eşitlik karşılaştırması sıradan bağımsızdır (filtre ve `in` değerleri),
sıralama anahtarlarında sıralıdır.

- Aktif görünüm `state.view`'dadır (R5): adrese bağlanabilir. "Edited" saklanmaz; her çizimde ekrandaki durum
  görünümün kayıtlı durumuyla (`layout.resolve` ile tamamlanmış) karşılaştırılır. Adresten gelen görünüm + filtre
  uygulanmaz, olduğu gibi okunur; farklıysa "Edited" görünür.
- `state.view` verilmezse açılış görünümü pakette seçilir (kullanıcı varsayılanı → system default → ilk system);
  filtresi, sıralaması ve sütunları başlangıç durumu olur ve `onStateChange` ile bir kez bildirilir. Kişisel varsayılan
  ya da Promise dönen tercih, liste ve tercih ilk geldiğinde bir kez uygulanır; sonra "Set as default" görünümü değiştirmez.
- Görünüm kimliği `request`'e girmez: sorgu anahtarını yalnızca filtre / sıralama / sayfa değiştirir.
- Görünüm menüsü Base UI Popover + kendi combobox'ı, liste grid popup (Faz 7c'de listbox'tan çevrildi): odak aramada, ↑↓
  vurgu (`aria-activedescendant`), Enter seçer, Tab ⋯ düğmelerine ve New view'a gider. Base UI Combobox liste içindeki
  düğmeleri Tab sırasından çıkardığı için kullanılmadı.
- Sütun genişliği değişimi hook'u yeniden çizmez (05 · Resize); "edited" için `useSyncExternalStore` sürükleme bitince
  bir kez çizer.

## R7 · Provider

`createDataTable` plugin'i yerine `<DataTableProvider locale messages viewsAdapter preferences>`.
Paket React context dışında global durum tutmaz; aynı sayfada iki tablo birbirini etkilemez.

## R8 · i18n

Paket kendi metinlerini taşır (`en`, `tr`, `ru`), i18next'e bağımlı değildir. Çoğul `Intl.PluralRules`
ile. Uygulama `locale` verir ve gerekirse `messages` ile anahtar ezer.

`en` ve `tr` Vue'daki 09-i18n.md'den üretilir (`pnpm gen:docs`); sheet ve içe aktarma bölümleri atlanır.
React'in bilinçli metin sapmaları `scripts/docs.ts` içindeki `REACT_MESSAGES`'tadır (Vue'ya taşınmaz); üretici ve
doküman testi ikisini birlikte okur.
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
| Takvim | `react-day-picker` | Base UI'da takvim yok. Yalnızca tarih çipi açılınca tembel yüklenir; başlık ve gün düğmesi reka sınıf/nitelikleriyle çizilir, `filters.css` aynen geçer |
| İkonlar | `@phosphor-icons/react` (peer) | |
| Excel | `write-excel-file` (peer, `import()`) | D46 |

`react` ve `react-dom` 19 peer'dır.

## R11 · React Compiler

Paket kaynak kodu derleyiciye uygun yazılır ve kütüphane derlemesinde React Compiler'dan geçer;
tüketicinin derleyicisi `node_modules`'ü işlemez. TanStack Table ve Virtualizer örneğini değiştirerek
çalışan dosyalar `"use no memo"` ile dışarıda kalır (Swors'ta derleyicinin bu nesneleri önbelleğe
alması ekranı donduruyordu). Derleme çıktısında bu dosyalar önbelleksiz, geri kalanı önbellekli
çıkar; Rolldown'un "directive may not be preserved" uyarısı bu yüzden zararsızdır (yönerge bundling'den
önce, dosya başına işlenir).

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
| 1 | Izgara, hücre tipleri, `cell` / `actions`, etkileşim guard'ı, sanal gövde — **tamam** (60 fps / resize süresi ölçümü ve Playwright e2e Vue'daki gibi sonraya) |
| 2 | Veri akışı (R4), durumlar, sıralama, sayfalama, araç çubuğu, sütun yönetimi — **tamam** (aşağıdaki notlar) |
| 3a | Filtreler ve arama — **tamam** (aşağıdaki notlar) |
| 3b | Görünümler (R6) ve tercihler — **tamam** |
| 4 | Seçim, bulk bar, satır etkileşimleri, satır hatası (D35) — **tamam** (aşağıdaki notlar) |
| 7 | Telefon, erişilebilirlik turu, README — **tamam** (aşağıdaki notlar) |

Faz 2 notları:

- Dışa aktarma (D46) ⋯ menüsünde yok; Excel bağımlılığıyla birlikte ayrı bir adımda gelir.
- İçe aktarma yok (R1). Telefon araç çubuğu Faz 7'de.
- Vue'daki kaydırma konumu hapı taşınmadı.
- Sütun gösterme isteği debounce edilmez: Columns dialog'u değişiklikleri Save'de tek seferde uygular.
- Vue'dan bilinçli sapmalar: çoklu sıralamada `aria-sort` yalnızca birincil sütunda (Vue'nun kendi
  kriteri, Vue kodu tüm sıralı sütunlara koyuyor); footer'daki "Updated …" 30 sn'de bir yaşlanır
  (Vue'da "just now"da kalıyor).
- Base UI Dialog ok tuşlarının yayılmasını durdurur; Columns dialog'u klavyeyle sürükleme sürerken
  `preventBaseUIHandler` ile bunu atlar, yoksa dnd-kit tuşları duymaz.

Faz 3a notları:

- Tarih editöründe seçim `mode` + kontrollü `selected` ile verilir, tıklamayı `onDayClick` yönetir (`onSelect`
  boş): böylece Tab takvime seçili güne girer, aralığın ilk/ikinci uç mantığı Vue'daki gibi kalır.
- Hazır tarih aralıkları göreli kalmaz (Vue'dan sapma, ürün kararı): seçildiği günün tarihleriyle `{ from, to }`
  yazılır, çipte "Nov 1 – 7" görünür; kaydedilen görünüm de bu sabit tarihleri taşır. Overdue `before <bugün>`
  olur. Hazır aralık, değer bugünkü tarihleriyle aynıysa işaretli görünür. Custom range düğmesi yok: takvim her
  zaman aralık seçer (anahtarı i18n'de duruyor). Tek gün operatörlerinde (`eq`, `before`, `after`) hazırlar bugün, dün,
  evvelsi gün, yarın, öbür gün; adları `Intl.RelativeTimeFormat`'tan, yeni çeviri anahtarı yok. Popover'daki
  "Presets stay relative" notu kalktı (anahtar Vue belgesinden üretildiği için i18n'de duruyor). Model dışarıdan
  gelen `{ preset }` değerini (eski adres, sunucu) okumayı sürdürür.
- Tarih editörü sapmaları: takvim gezinme düğmelerinin etiketleri çeviriden gelir (Vue'da İngilizce sabit
  "Previous page"); ızgaranın ay adıyla etiketi var; klavyeyle görünen ayın dışındaki bir güne gidilince
  görünüm o güne kayar (Vue'da kalır). Ok/Page/Home/End davranışı Vue ile aynı.
- Takvim görünümü Vue'dan ayrılır (ürün kararı): başlık solda, oklar sağda; gün adları kısa (`Sun`, `Paz`); ayın
  günleri dolgulu kutu, taşan günler kutusuz; hep 6 hafta (ay değişince popover boyu oynamaz); seçili aralık
  hücrelere `::before` ile çizilen kesintisiz bant, uçlar dolu, bugün çerçeveli. Popover 572×432.
- Takvim başlığı düğmedir: tıklanınca gün → ay → yıl (12'li) ızgarası açılır, seçim bir alt görünüme döner, Esc
  popover'ı kapatmadan bir üst görünüme çıkar. Izgara gizlenen gün takviminin üstüne oturur, popover boyu oynamaz.
  Başlık ve oklar editörün; react-day-picker'ın gösterdiği ay kontrollüdür (`month`).
- Clear'dan sonra düğme devre dışı kalır; Vue'da odak `body`'ye düşer. React'te Faz 7c'de düzeltildi (aşağıda).
- Column picker Base UI Combobox'tır; açılışta ilk öğe vurgulanmaz (Vue'da vurgulu). Yazınca ilk eşleşme
  vurgulanır, yani "yaz + Enter" aynı; yalnızca hiç yazmadan Enter önce ↓ ister. `autoHighlight="always"`
  Combobox'ın genel API'sinde yok.
- Combobox tetikleyicinin arkasına gizli yardımcılar koyar; `.dt-btn-group` köşe kuralı bunları sayamaz
  (`ui.css`, R9 sapması).
- Vue'dan bilinçli sapmalar: metin editörü yazarken duraklayınca sondaki boşluğu silmez (Vue'da "Atlas K"
  yazılamıyor, tarayıcıda doğrulandı); arama kutusu adresten geç dönen kendi değeriyle taslağı ezmez.

Faz 4 notları:

- Seçim tablonun durumundadır (`table.selection`, `setSelection`, `clearSelection`): bulk aksiyonu ya da ekranın başka
  yeri seçimi `ref` olmadan temizler (Vue'da `defineExpose({ clearSelection })`). Seçili satırların kendisi
  `<DataTable onSelectionChange>`'te; satırlar yalnızca bileşende bilinir (sunucu modu). `TableState`'e girmez: adrese
  bağlanacak durum değil.
- Seçim ve açık detaylar düz `Record<anahtar, true>`; TanStack `rowSelectionFeature` / `rowExpandingFeature`
  kullanılmadı: kural (sorgu değişince temizle, refresh'te yeni veride olmayan anahtarı düşür) sayfa kapsamlı ve
  satır modelinden bağımsız. Sıfırlama, isteğin kimliği değişince render sırasında yapılır; aynı sayfaya dönmek
  eski seçimi geri getirmez.
- Vue'daki `expand` prop'u + `#expanded` slot'u yerine `renderExpanded({ row, close })` ve `canExpand(row)`;
  `#selection-actions` yerine `selectionActions({ rows, clear })`. `onRowOpen({ row, href, event })` Vue'daki
  `row-open` ile aynı: paket gezinmeyi durdurmaz, dinleyici `event.preventDefault()` çağırır.
- Menüdeki Open / Open in new tab Base UI `Menu.LinkItem`'dır (`closeOnClick`). Açık ⋯ ve bulk ⋯ düğmesi
  `data-popup-open` ile işaretlenir (R9 notu, `grid.css` / `list.css`).
- Açılan detayın duyurusu (`sr.expanded`) detay çizildikten sonraki karede DOM'dan sayılır (Vue: `nextTick`).
- Menüdeki Open bağlantılarının altı çizili; Vue'da da aynı (ortak eksik, `ui.css`).

Faz 7 notları (telefon):

- Kart < 640 px: kökte `is-phone`, `layout.setPhone` (yalnızca birincil sütun başa sabit, sona sabit yok), header'da
  `headerShort`. Popover'ların telefon karşılığı `BottomSheet` (Base UI Dialog); Vue'daki `Layer`'ın sheet hâli.
- Filters sayfası ve ⋯ › Sort tek istekle uygular: tabloya `setQuery({ filters?, sort? })` eklendi (sayfa 1).
  Sayfa her açılışta yeni `key` ile kurulur, taslak o anki çiplerden başlar; ilk açılışta tembel yüklenir.
- Telefon ⋯ sayfasında Export (D46) ve Import (R1) yok; Vue playground'unda bu yüzden 2 satır fazla.
- Metin ve sayı editörü açılınca kendi kutusuna odaklanır (Vue: `onMounted` focus); sheet'te başka odak kaynağı yok.
- Vue'dan farkı olmayan ama React'e özgü tuzak: metin editöründe Enter aynı olayda önce değeri yazar sonra Done
  der; sayfanın taslağı updater ile güncellenir, yoksa Done eski taslağı görüp çipi boş sayar.

Faz 7c notları (erişilebilirlik):

- `pnpm test:e2e` (Playwright, port 5179): `e2e/a11y.spec.ts` axe ile WCAG 2.1 A/AA'da kritik/ciddi ihlal arar; masaüstü
  (açık/koyu), telefon alt sayfaları, hareket azaltma ve yüksek kontrast. Vue'nun sheet ekranları React'te yok.
- Görünüm menüsü Vue'dan ayrılır: reka Listbox yerine ARIA combobox + grid popup. listbox yalnızca option alabildiği için
  satırdaki ⋯ düğmesi yapıyı bozuyordu (Vue'da da aynı, düzeltilmedi). Satır = görünüm hücresi + ⋯ hücresi; grup başlığı
  `rowgroup` adı. Klavye ve görünüm aynı (piksel farkı yok).
- Base UI Combobox tetikleyicisi `role="combobox"` taşır, ad içerikten gelmez. Filter düğmesinin adı görünen
  parçalarından `aria-labelledby` ile kurulur ("Filter 2"; ikon kipinde etiket `dt-sr-only`), Add filter'da `aria-label`.
  Dar kartta (640–1023) Filter etiketli kalır; React'te ikona dönüyordu, Vue'da ikon yalnızca telefonda.
- Ad görünen metni içermeli (WCAG 2.5.3): bitişik `span`'lar arasına boşluk konur (çip, görünüm tetikleyicisi, Filter).
  Flex içinde görünmez, piksel farkı yok.
- Clear (çip popover'ı ve telefon Filters editörü) değeri silmeden önce odağı editörün ilk alanına taşır: düğme devre
  dışı kalınca odak `body`'ye düşmez, sıradaki adım yeni değer (Vue'da düşer).
- Telefon çipi operatörü gösterir ("Status is Draft"; Vue'da "Status Draft"): "is" ile "is not" ayırt edilir, ad
  görünen metinle uyuşur.
- dnd-kit canlı bölgesini `DndContext`'in yerinde çizer: Columns listesinin (`ul`) dışında, dialog'un içinde.
- Eksik çipin adı görünen metinle başlar (WCAG 2.5.3): "Status is Select…. Choose a value" (`filter.chooseValueAria`,
  `REACT_MESSAGES`; Vue'da "Status: choose a value").

Swors'un ürün ekranı 3b'den sonra pakete geçer. O zamana kadar Swors'taki `DataTable`'a özellik
eklenmez.
