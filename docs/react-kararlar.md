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
- Sonradan: `FormGrid` (R34) ve `DataSheet` (R44, içe aktarma dahil) eklendi; bu madde ilk sürümün kapsamıdır.

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
seçilmemiş çip ekranda kalır, duruma ve adrese girmez. `state` verilince tablonun durumu yalnızca odur ve **eksik alan
varsayılandır**: görünüm → varsayılan görünüm (kullanıcı varsayılanı → system default → ilk system), filtre ve sıralama → etkin
görünümün kayıtlısı, arama boş, sayfa 1, sayfa boyutu tercih (`preferences`). Sayfa boyutu değişimi controlled olsa da tercihe
yazılır.

`onStateChange(state, changed)`: tam durum ve yalnızca varsayılandan farklı alanlar. Uygulama adrese `changed`'i yazar; varsayılan
liste temiz adrestir, menüden aynı sayfaya dönmek (adresin boşalması) listeyi varsayılana döndürür. Açılışta çağrılmaz. Temiz
adresteyken varsayılan görünüm değişirse (Set as default / Remove default) ekrandaki görünüm `changed.view` ile adreste açıkça
kalır, ekran değişmez.

Önceki sürümde alanlar ayrı ayrı controlled'dı (verilmeyen içeride kalırdı) ve açılış görünümü adrese bir kez bildirilirdi.
Adres boşalınca tablo son filtreyi korur, adres ile ekran ayrışırdı; varsayılan liste de `?view=all&filters=&sort=` yazardı.

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
  Sütun düzeni adreste olmadığı için görünümden alınır: system görünümünde açılışta, kişisel görünümde liste
  gelince.
- Vue'dan sapma: varsayılan görünümün satır menüsünde "Set as default" yerine "Remove default" çıkar ve tercihi
  `null` yapar; açılış system default'a döner. Vue'da varsayılan yalnızca başka bir görünüm seçilerek değişir; system
  görünümü olmayan ekranda kişisel varsayılandan dönülemiyordu. Öğe yıkıcı (kırmızı) çizilir. Metin `scripts/docs.ts`
  `REACT_ONLY_MESSAGES`'tadır. Sistem görünümü notu buna göre "yeniden adlandırılamaz ve silinemez" der (`REACT_MESSAGES`)
  ve menüyü genişletmez: menü öğeleri kadar geniştir, not o genişlikte kırılır.
- "Edited" Türkçede "Kaydedilmedi", Rusçada "Не сохранено"dir (`REACT_MESSAGES`): "Değişti" kullanıcılarca sistemin
  kendiliğinden güncellemesi diye okundu. Karşılaştırma nesne anahtarlarının sırasına bakmaz (jsonb sırayı korumaz).
- `state.view` yoksa etkin görünüm varsayılandır ve her çizimde türetilir: kişisel varsayılan ya da Promise dönen tercih
  gelince ekran ona geçer. Görünüm seçim dışında değişirse (adres, geri tuşu, geç gelen liste ya da tercih) sütun düzeni o
  görünümün kayıtlısına döner; sütunsuz görünüm tablonun varsayılan düzenidir.
- Görünüm kimliği `request`'e girmez: sorgu anahtarını yalnızca filtre / sıralama / sayfa değiştirir.
- Görünüm menüsü Base UI Popover + kendi combobox'ı, liste grid popup (Faz 7c'de listbox'tan çevrildi): odak aramada, ↑↓
  vurgu (`aria-activedescendant`), Enter seçer, Tab ⋯ düğmelerine ve New view'a gider. Base UI Combobox liste içindeki
  düğmeleri Tab sırasından çıkardığı için kullanılmadı.
- Sütun genişliği değişimi hook'u yeniden çizmez (05 · Resize); "edited" için `useSyncExternalStore` sürükleme bitince
  bir kez çizer.
- Resize tutamacına çift tık o sütunun sürüklenmiş genişliğini siler (`layout.resetWidth`): sütun tanımdaki ya da tipin
  varsayılan genişliğine döner, görünümde de genişlik kaydı kalkar. Liste tablosunda ve FormGrid'de aynı.

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

Portal'la `body`'ye çizilen her katman (menü, popover, tooltip, diyalog, alt sheet) `z-index: 50`'dedir:
shadcn'in Sheet ve Dialog'uyla aynı katman. Eşitlikte sonra açılan üstte kalır; tablo modal bir Sheet
içinde olsa da menüsü Sheet'in önünde açılır.

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

## R14 · Filtre varsayılanları

- `id` türünde varsayılan operatör `contains`'tir (Vue 04 §2'de `in`). Kodlar çoğu zaman bir
  parçasıyla aranır (`STK00` ile başlayanlar, içinde `400` geçenler); `in` ile tek değer tam eşleşme
  ister. Liste yapıştırmak için "şunlardan biri" operatörü seçilir. Sütun kendi varsayılanını
  `filter.defaultOperator` ile verir.
- Sayı filtresi sütunun gösterdiği ondalık kadar giriş alır: `decimalPlaces` 0 ise (`int`,
  `percentage`'ın varsayılanı) yazılan ondalık atılır. Hücrede `%18` görünen sütunda `18,5` ile
  filtrelemek görünmeyen bir değer arar; tam sayı kolonda sunucu ondalığı reddeder. Ondalık
  isteyen yüzde `decimalPlaces: 1` verir.
- `decimalPlaces` en çok hanedir; `minDecimalPlaces` verilirse sondaki sıfırlar ancak o kadar haneye
  kadar yazılır. Miktar (`4` / `0`) 10 gösterir, 10,0000 değil; birim fiyat (`8` / `2`) en az 2 hane,
  doluysa 8'e kadar. Verilmezse ikisi eşittir: noktalar sütunda hizalanır. Excel biçimi aynı kuralı
  `0` ve `#` ile taşır.

## R15 · Görünüm menüsü

- Vue 04 §7'de kaydetme bölümü menünün üstündeydi, iki satırlı öğelerle. React'te altta tek bir satır: durum
  cümlesi ("Bu görünümde kaydedilmemiş değişiklik var."), solda Geri al, sağda kaydetme düğmeleri. Personal görünümde
  Farklı kaydet… ve Kaydet ⌘S, system'de Görünüm olarak kaydet…. Düzenlenmemiş görünümde aynı yerde Yeni görünüm var.
  Aktif görünümün durumu bu satırda olduğu için listede tekrar "Kaydedilmedi" yazılmaz.
- Find a view… yalnızca 8 ve üzeri görünümde var. Azsa odak listenin kendisindedir (grid, `aria-activedescendant`);
  klavye aynı: ↑↓, Home/End, Enter. Swors'taki Picker'ın arama eşiğiyle aynı sayı.
- Aktif görünümde solda işaret var, bütün adlar aynı hizada. Bölüm başlıklarında ipucu yok ("Hazır", "Yalnızca siz").

## R16 · Uygulamanın şeridi (`notice`)

- Vue spesifikasyonunda araç çubuğu ile sütun başlıkları arasında yalnızca paketin şeridi var (Stale, 05 §states).
  Liste bağlamını anlatan bir uyarı ("Yalnızca arşivlenmiş kayıtlar") uygulamanındır ama listenin içinde, araç
  çubuğunun hemen altında okunmalıdır: kartın dışında araç çubuğunun üstünde kalırsa filtre ile karışır.
- `notice?: ReactNode`. Sıra: araç çubuğu, `notice`, Stale şeridi, filtre çipleri, grid. Çipler grid'e bağlı durumdur,
  grid'e en yakın kalır; `notice` bütün liste için bağlamdır.
- Paket yalnızca yeri verir: kenardan kenara, iç boşluksuz, altta `--dt-line`. Zemin rengi şeridin tamamını
  kaplasın diye boşluk içeriğindir; içerik, rengi, boşluğu ve ARIA rolü uygulamanın; paket rol eklemez. Araç çubuğu kapalıyken (`toolbar={false}`) de çizilir.

## R17 · Toplu çubukta tehlikeli aksiyonun ikonu

- Vue'da `.dt-bulk-btn > svg` ikonu her zaman `--dt-bulk-fg-2` yapıyor, `is-destructive` yalnızca metni boyuyordu:
  ikon gri, metin kırmızı kalıyordu. Satır menüsünde ikon metinle aynı renkte; toplu çubuk da öyle olur.
- `is-destructive` düğmede ikon da `--dt-bulk-danger` alır.

## R18 · Satır menüsünde yerleşik "Copy" yok

- Vue spesifikasyonu (05 §143) satır menüsüne birincil sütunu panoya yazan yerleşik bir "Copy {sütun}" öğesi ve
  "Copied" toast'u koyuyordu. Swors'ta hiçbir listede istenmedi; metin seçilip kopyalanabildiği için (D6) yerine
  bir şey gerekmiyor. Kapatılabilir bir seçenek yerine öğe, toast ve çevirileri (`row.copyId`, `cell.copied`) silindi.
- Satır menüsü: Open, Open in new tab (birincil sütunun `href`'i varsa), ─, uygulamanın `rowActions`'ı.

## R19 · Hazır "Tümü" görünümü

- Her uygulama her listeye filtresiz bir "Tümü" system görünümü ekliyordu. Paket onu kendisi koyar: kimliği `all`,
  adı `views.all` ("All" / "Tümü" / "Все"), durumu boş (tablonun varsayılanı), system görünümlerinin ilk sırasında.
- `default` işareti yoktur: uygulama başka bir system görünümünü `default: true` verirse açılış onundur; vermezse ilk
  system olarak "Tümü" açılır (04 §7 sırası değişmez).
- Uygulama `all` kimliğiyle bir görünüm verirse (başka ad, sütun düzeni) hazır olan eklenmez, onunki kullanılır.
- Adapter yoksa ve uygulama görünüm vermediyse eklenmez: kaydetme olmayan, tek seçenekli menü çizilmez (eski davranış).
- Vue'dan sapma: 04 §7'deki "hiç görünüm yoksa tablonun varsayılan durumu" adapter'lı tabloda artık oluşmaz.

## R20 · Bağlantı hücresinin görünümü

- `.dt-link` (birincil hücre, `id`, `url`) her zaman altı çizili; çizgi `--dt-text-3`, hover'da accent. Vue yalnızca
  hover'da çiziyor: kullanıcı hücrenin tıklanabildiğini üzerine gelmeden anlamıyordu.
- Bağlantının odağı halka (02) değil, accent renk ve 2 px alt çizgi. Halka hücrenin taşma sınırında kesiliyor;
  Sheet kapanınca odak bağlantıya döndüğü için Esc'ten sonra yarım halka görünüyordu.

## R21 · Satır sıralama (D22'yi genişletir)

- D22 sürükle-bırakı Columns dialog'uyla sınırlıyordu; gerekçesi bakımsız bağımlılıktı ve D22 revizesiyle `@dnd-kit` zaten
  pakette. Kullanıcı isteği: kayıtların sırasını (formdaki alan sırası gibi) listenin kendisinde değiştirmek.
- Varsayılan kapalı. `DataTable`'a `reorder` verilince satırın başında, seçim sütunundan önce sol sabit bir tutamak sütunu
  çıkar; yalnızca tutamak sürüklenir, satır tıklaması, seçim ve metin seçimi aynen kalır.
- **Paket numara üretmez, taşıma bilgisi verir:** `onMove({ row, after, before })`; `after` yeni yerde üstte kalan satır,
  `before` altta kalan (liste başı / sonu → `null`). Sıra kolonunun yönünü ve aralığını yalnızca sunucu bilir; ekranda
  sayfanın ya da arama sonucunun bir kısmı olsa da "şunun hemen arkası" bilgisi doğrudur.
- **Ne zaman açık olduğuna uygulama karar verir:** `reorder.disabled` true ya da gerekçe metni ise tutamak pasif, gerekçe
  tooltip'te ("Sıralamak için bir kapsam seçin"). Paket sıralama durumunu yorumlamaz: hangi sıralamanın ve hangi
  filtrenin sırayı anlamlı kıldığı veriye bağlıdır.
- **İyimser gösterim:** bırakınca yeni sıra hemen çizilir. `onMove` Promise dönerse sonuçlanana kadar tutamaklar pasif;
  reddedilirse eski sıraya döner, hata mesajı uygulamanındır (D20). Gösterilen sıra, gelen satırların sırası değişene
  (yenilenen sonuç) kadar paketin elinde kalır.
- Klavye ve duyurular Columns dialog'uyla aynı: tutamakta `Space` al · `↑↓` · `Space` bırak · `Esc` iptal; metinler
  `reorder.*` anahtarlarından. Sürükleme kodu yalnızca `reorder` açıkken tembel yüklenir.
- Sürüklenen satır sanal listede DOM'dan çıkmaz (odaktaki satır gibi tutulur). Kenara yaklaşınca liste kayar, yeni çizilen
  satırlar hedef olur: 300 satırda ekranda olmayan bir yere taşıma e2e ile doğrulandı. Sürükleme sırasında satır konumu
  `transform` değil `top`: @dnd-kit ölçerken `transform`'u yok sayar, sanal satırların hepsini en üstte sanırdı.
- Vue'dan sapma: Vue paketinde satır sıralama yok; Vue `CLAUDE.md`'deki reddedilenler listesi React için bu maddeyle
  daralır.


## R22 · Tooltip kesmez

- Kesilen hücrenin tooltip'i metnin tamamını gösterir: tek satır ve `…` yerine en çok 480 px genişlikte satırlara
  bölünür (`white-space: pre-line`, `overflow-wrap: anywhere`). Vue tooltip'i 320 px'te `…` ile kesiyordu; uzun formül ya
  da açıklama tooltip'te de okunamıyordu. Tek satırlık tooltip 26 px kalır (02).
- Metin hücrenin sayfadaki düzeninden okunur (`innerText`): alt alta duran parçalar (ad ve altındaki özet) tooltip'te de
  ayrı satırdır, aralarında 6 px; satır kaydırmasında boşluk yoktur. Uzun içerik ekranı kaplamasın diye en çok 10 satır
  gösterilir (`line-clamp`), fazlası `…` ile kesilir; hücrenin kendisi zaten açılabilir (`onRowOpen`, satır penceresi).
- Genişliği metinden gelir (`width: max-content`), konumu pencereye sığacak şekilde hesaplanır: öğenin ortasına
  hizalanır, taşacaksa kenardan 8 px içeride durur. `left` + `translateX(-50%)` ile sağ kenardaki dar öğenin
  (satır hatası) tooltip'i kenara kalan boşluk kadar daralıyor, metin harf harf bölünüyordu.

## R23 · Inline satır düğmesi: etiket ve görünüm (D36'yı genişletir)

- `RowAction.inline` artık `icon` istemez: ikon varsa 28 px ikon düğmesi (D36), yoksa aksiyon etiketiyle çizilir
  ("Seç"). Etiketli düğmede `aria-label` yoktur (ad metinden gelir), tooltip yalnızca gerekçe ya da açıklamadır.
- `RowAction.variant`: `default` | `outline` | `field` | `secondary` | `ghost` | `destructive` | `link`. Adlar
  uygulamanın (Swors, shadcn) düğme türleriyle birebir aynıdır: `default` dolu birincil düğmedir, "verilmezse" demek
  değildir. Verilmezse `ghost` çizilir; variant'sız ikon ⋯ ile aynı düğmedir, piksel farkı yok.
- Variant yalnızca inline düğmeyi etkiler; menü öğesi aynı kalır (menüde kırmızı için `destructive: true`).
  Görünümler paketin düğme sınıflarıdır (`.dt-btn-sm`); `secondary` (kenarlıksız `--dt-surface-3` dolgu), `field`
  (giriş kutusu gibi) ve `link` (hücre bağlantısının alt çizgisi) yenidir.
- ⋯ sütunu en geniş satır kadardır. Etiketli düğmenin genişliği metne bağlıdır: header'daki görünmez ölçü yuvasından
  okunur, `ResizeObserver` ile yoğunluk, dil ve geç yüklenen fontta yenilenir.
- Sayfada menüsü olan satır yoksa (adres yok, bütün aksiyonlar inline) ⋯ için yer ayrılmaz; varsa menüsü boş satır
  yeri hizalama için tutar (D36). Önceden yer her zaman ayrılıyor, tek düğmeli sütun bir düğme kadar boş kalıyordu.
- Neden: kullanıcı ihtiyacı (Swors ürün seçme listesi): satırdaki tek eylem ikonla anlaşılmıyor, "Seç" yazan
  birincil düğme isteniyor. Vue spesifikasyonu yalnızca ikon düğmesi tanımlar. (2026-11-13)

## R24 · Çoklu kişi hücresi adlarını popover'da gösterir

- `user` + `multiple` hücresinde yığın (en çok 3 avatar + `+N`) bir düğmedir: üzerine gelince (300 ms) ya da tıklanınca
  popover herkesi avatar ve adıyla, sütundaki sırayla listeler. Düğmenin `aria-label`'ı adların listesidir; avatarlar
  `aria-hidden` kalır. `+N`'nin ayrı tooltip'i kalktı, popover herkesi zaten gösterir. Tek kişi değişmedi: avatar + ad.
- Düğme etkileşimli öğedir: tıklaması satırı açmaz (`isPlainRowClick`).
- Neden: Vue spesifikasyonunda görünen üç avatarın adı hiçbir yerde yok; baş harfler aynı olunca (Mehmet A. / Murat A.)
  yığın kimin kim olduğunu söylemiyordu. Adların hücrede yan yana yazılması istenmedi (Swors cari grubu temsilcileri,
  2026-11-16).

## R25 · Araç çubuğu: sola yaslı arama, tanımlı eylemler (D43'ü değiştirir)

- Arama + Filter grubu görünüm seçicinin yanındadır, ortada değil; araç çubuğu düz flex satırıdır:
  `görünüm · [arama · Filter] · boşluk · [Display · ⋯] │ ikinciller · birincil`. D43'ün üç sütunlu ızgarası iki yana
  eşit pay veriyordu; uygulamanın sağdaki düğmeleri payına sığmayınca sola taşıp Display ve ⋯'nın üstüne biniyordu.
  Flex satırında öğeler üst üste binemez, yalnızca boşluk daralır.
- Display her genişlikte yazısız ikondur, adı tooltip'tedir (D43'teki "masaüstünde etiketli" kalkar).
- Eylemler tanımdır: `primaryAction` (tek; `label`, `icon`, `run`) ve `actions` (`ToolbarAction[]`: `checked` aç/kapa,
  `menu` hep ⋯ içinde, `iconOnly` yazısız ikon düğmesi: ad erişilebilir ad, `description` ya da ad tooltip'te). Paket ne olduklarını bildiği için genişliğe göre daraltır: ikinciller listedeki sırayla
  önceliklidir, sığmayan sondan başlayarak ⋯ menüsünün üstüne iner; hiçbiri kalmayınca birincil yalnızca ikondur.
  Genişlikler görünmez ölçü alanından okunur (`fitActions`, R23'teki yöntem). Telefonda ikinciller ⋯ sayfasındadır.
- `toolbarEnd` serbest içerik olarak kalır (R3) ama paket onu daraltamaz; eylem için kullanılmaz.
- Görünüm seçici en çok ~240 px'tir; uzun ad `…` ile kesilir, kesilince tam ad tooltip'te.
- Neden: kullanıcı ihtiyacı (Swors liste ekranları): Arşiv, "Resmi tatilleri al" ve "Yeni" düğmeleri dar kartta
  Display ile ⋯'nın üstüne biniyordu; uygulamanın düğme grubunu paket küçültemiyordu. (2026-11-16)

## R26 · Seçeneğin dolu hapı

- `OptionDef.tone` üçüncü biçimi alır: `{ fill: '#rrggbb' }`. Hap zemini rengin kendisidir, yazı rengi okunurluğa göre
  `--dt-fill-text-dark` ya da `--dt-fill-text-light`, iki temada aynı; nokta gösterilmez (zeminle aynı renk olurdu).
  Hücrede ve filtre seçeneklerinde aynı hap çizilir.
- Okunur yazı tek fonksiyondan (`fillStyle`) gelir; `color` + `display: 'fill'` hücresi de onu kullanır. Hesap WCAG göreli
  parlaklığıdır (siyahla mı beyazla mı kontrast yüksek); eski hesap (doğrusal ağırlık, eşik 0,55) orta tonlarda (#16A34A)
  beyaz seçip okunmayan yazı veriyordu.
- Neden: `{ light, dark }` tonu yazıyı rengin kendisiyle, zemini onun %12'siyle çizer; kullanıcının seçtiği açık renkler
  (sarı, açık mavi) beyaz zeminde okunmuyordu ve uygulamanın başka yerde dolu çizdiği durum filtrede soluk görünüyordu
  (Swors sipariş durumları, 2026-11-17).

## R27 · İkinci satır Standard yoğunlukta da çizilir (02 · Yoğunluk'u genişletir)

- `secondary` Comfortable ve Standard'da görünür, yalnızca Compact'ta çizilmez. Standard satırı (48 px) iki satırı
  kesmeden taşır; Compact (36 px) taşımaz (yükseklikler R28).
- Kendi iki satırını çizen özel `cell` aynı kurala `CellContext.density` ile uyar: Compact'ta ikinci satırı bırakır.
- Neden: varsayılan yoğunluk Standard olduğu için ikinci satır neredeyse hiç görünmüyordu; Swors sipariş listesi cari
  adının altında ilçe/il ve sevk durumunun altında teslim tarihini gösterir (2026-11-17).

## R28 · Satır yükseklikleri: 64 / 48 / 36 (02 · Yoğunluk'tan ayrılır)

- `--dt-row-h` Comfortable 64 px, Standard 48 px, Compact 36 px (spesifikasyon 56 / 44 / 32). Başlık, yazı, rozet ve
  avatar ölçüleri spesifikasyondaki gibi kalır; yalnızca satırın dikey boşluğu artar. Telefon satırı 48 px'ti, Standard'la
  eşitlendi.
- Değerler `scripts/tokens-from-docs.ts`'te ezilir: `tokens.css` üretilmiş dosyadır, `pnpm gen:docs` farkı korur.
- Neden: R27 ile Standard'da da iki satır çiziliyor; 44 px'te iki satırın üstünde ve altında 4–5 px kalıyor, sıkışık
  duruyordu (Swors sipariş listesi, 2026-11-17).

## R29 · `UserName` dışa açılır

- Tek kişinin avatar + ad görünümü (`user` hücresinin çizdiği) `UserName` bileşeni olarak dışa açıktır:
  `<UserName user={{ value: id, label: ad }} />`. Avatar rengi kimlikten, baş harfler addan gelir.
- Neden: kişi kimliğini ada çeviren bir kaynak her zaman yoktur; Swors'ta siparişi oluşturan personel de müşteri de
  olabilir ve ikisini birden çözen bir kaynak yok. Ad satırda hazır gelir; metin kolonu özel `cell`'de bu bileşenle
  `user` hücresiyle aynı görünür, filtresi metin araması kalır (2026-11-17).

## R30 · Toplu aksiyonun seçenekleri (05 §6'yı genişletir)

- `BulkAction.options` (`{ id, label, color? }[]`) verilirse aksiyon bir seçenek ister: bar düğmesi seçeneklerin menüsünü
  açar, ⋯ menüsünde aksiyon alt menü olur, telefonun alt sayfasında aksiyon adı başlık, seçenekler satır olur. `run(rows,
  option)` seçilenle çağrılır; seçeneksiz aksiyonun çağrısı değişmez. `color` etiketin solunda nokta çizer.
- Paket seçenekleri süzmez, onay sormaz: hangi seçeneğin hangi satıra uyduğu ve onay uygulamanındır (D20).
- Neden: Swors sipariş listesinde "Durumu değiştir" hedef durumu sorar; düğmeden pencere açıp orada seçtirmek bir adım
  fazlaydı. Başka listelerde de (atama, etiket) aynı biçim gerekir (2026-11-17).

## R31 · Telefonda kart çerçevesi kalır (05 §11'den ayrılır)

- Telefon düzeni (`is-phone`) kartın kenarlığını, yarıçapını ve gölgesini kaldırmaz; yalnızca iç düzen değişir.
- Neden: çerçevesiz kart ekranın kenarına dayanırsa doğru durur, ama uygulamalar listeyi iç boşluklu sayfa ya da yan
  panel içine koyar (Swors: sayfada 16, Sheet'te 18 px). Çerçeve kalkınca tablo boşlukta asılı kalıyor, başlık satırının
  zemini belirsiz yerde bitiyordu; yanındaki çerçeveli öğelerle de uyumsuzdu. Kenara taşırmak paketin bilemeyeceği
  boşluğu ve 640 px eşiğinde gidip gelen bir ölçüyü gerektirirdi (2026-11-22).

## R32 · Durumdaki koşul kullanılabilir sütunla sınırlıdır (04 §7'yi genişletir)

- Adresten ya da görünümden gelen süzgeç ve sıralama, tablonun tanıyıp kullanılamaz bildiği sütunda atlanır: `when: false`
  (R33), `filterable: false` (süzgeç), `sortable: false` (sıralama). Ayıklama durumun iki girişinde yapılır (görünümün
  `resolve`'u, adresin `query`'si): istek, çipler, istemci modu ve "edited" aynı listeyi görür.
- Tanınmayan alan olduğu gibi gider. Uygulama sütunu olmayan bir alanda da süzebilir (Swors: çek listesinin "Bizim
  çeklerimiz" görünümü `is_ours`); tablonun dışında eklenen sabit koşullar zaten paketten geçmez.
- Atlanan koşul geliştirmede bir kez konsola yazılır; adres değiştirilmez, sonraki değişiklikle yeniden yazılır.
- Neden: 04 §7 kayıtlı görünümdeki olmayan sütunu sütun düzeninde atlıyordu, süzgeç ve sıralamada değil. Arayüzün izin
  vermediği koşul linkle gelince isteğe gidiyordu: Swors'ta fiyat görmeyen kullanıcıya tutar süzgeci içeren link sunucudan
  422 aldı, liste satır yerine hata gösterdi (2026-11-22).

## R33 · Sütunun `when`'i (D34'ü sütuna genişletir)

- `ColumnDef.when?: boolean`; false → sütun bu kullanıcı için yoktur: grid, Columns dialog'u, Filter, istek, dışa aktarma.
  Durumdaki koşulu R32 ile atlanır. `hidden`'dan farkı: gizli sütun açılabilir, `when: false` sütun hiç sunulmaz.
- Neden: yetkiye bağlı sütun (Swors'ta fiyat görmeyene tutarlar) ekranda elle listeden çıkarılıyordu; yeni tutar sütunu
  eklenince liste unutuldu, sütun seçicide boş sütun olarak kaldı. Kural tanımın yanında durunca unutulmaz; sütun her zaman
  tanımlı olduğu için R32 onun koşulunu da tanır (2026-11-22).

## R34 · Üçüncü bileşen: `FormGrid` (R1'i genişletir)

- Paket üç bileşen olur: `DataTable` (liste), `DataSheet` (toplu kayıt, Vue 07) ve `FormGrid` (bir formun alanı
  olan satır dizisi: belge satırları, POS oranları). Ayrı sözleşmeler (D17); `variant` yok.
- `FormGrid` kontrollüdür (`rows` / `onRowsChange`), kaydetmez, form kütüphanesine bağlı değildir. Sütunu
  `DataTable`'ın `ColumnDef`'i; tür adları aynı, R1'de çıkarılan sheet alanları geri gelir. Hücre motoru `core/`'a
  girer, DataSheet onu ikinci kullanıcı olarak alır; bu yüzden `FormGrid` önce yazılır.
- D31'i değiştirmez: D31 salt okunur detay tablosuydu, düzenlenen satır dizisi o karar yazılırken yoktu.
- Spesifikasyon: `docs/form-grid.md` (onaylandı, 2026-11-23).

## R35 · `float` yerine `decimal`; ondalık metin olarak taşınır (03'ü değiştirir)

- Tür `float`'ın adı `decimal` olur; değer tam ondalıktır, float değil. Eski ad kalmaz (tek kullanıcı Swors).
- `decimal`, `currency` ve `percentage` değeri sunucudaki gibi ondalık metindir (`"1200.0000"`, `.` ayırıcı, gruplama
  ve üs yok). Paket sayıyı da okur ama yazdığı her zaman metindir; bu değerleri float'a çevirip hesap yapmaz.
  `int` ve `star` sayı kalır.
- Gösterim metni `Intl.NumberFormat`'a olduğu gibi verir (tarayıcı metni tam okur). Toplam, ortalama ve sıralama
  `decimal.js` ile. Eşitlik değere bakar: `"120.0000"` = `"120"`, F2 + Enter değişiklik sayılmaz.
- Paket kolonun ölçeğini bilmez: yazdığı metin kanoniktir (`"2.5"`), sabit ölçek sunucunun işi.
- Neden: Swors'ta ondalık backend'de tam (brick/math), telde metin; Laraql da 0.5'te `decimal` / `percentage`'ı metin
  gönderir. Paketin float'a çevirmesi "123.456"yı binlik sanmak gibi hatalara ve 15 haneden sonra kayba yol açıyordu.

## R36 · Sayı sütununda işaret: `signDisplay`, `signTone`; satır bazında birim hücrede (03'ü genişletir)

- `int`, `decimal`, `currency`, `percentage` iki isteğe bağlı alan alır; verilmezse bugünkü gibi (yalnız eksi, renk yok).
- `signDisplay`: Intl'in adı ve değerleri, `'auto' | 'exceptZero' | 'never'`. `exceptZero` artıya + yazar (stok girişi),
  `never` işareti yazmaz (yön B/A gibi başka yerde söyleniyorsa). Yalnız ekranındır: pano ve CSV işareti her zaman yazar,
  Excel değeri tipli sayıdır; kopyalanan geri yapıştırılınca aynı değer olmalı. Sıralama ve filtre gerçek değere bakar.
- `signTone`: `{ negative?: 'destructive', positive?: 'success', zero?: 'muted' }`; yalnız verilen işaret boyanır. Değer
  serbest renk değil anlam adıdır, tema token'larına bağlanır (`boolean`'ın `falseTone`'u gibi). İşaret `decimal.js` ile
  okunur: "-0.00" sıfırdır. Her zaman boyamak seçilmedi: kredi kartında fazla ödeme gibi eksinin hata olmadığı yerler var.
- `unit` fonksiyonu (satır bazında birim) artık hücrede sayının yanına soluk yazılır (`.dt-unit`); tip bunu söylüyordu ama
  çizilmiyordu, uygulama birimi yazmak için hücreyi elle kuruyordu.

## R37 · Hücre aksiyonları değerin üstüne binmez (03 · actions'ı değiştirir)

- 03'te aksiyonlar hover'da hücrenin sağ ucuna, solan zeminle değerin üstüne biniyordu: sağa yaslı sayı (birim fiyat,
  tutar) tam onların altında kalıyordu. Artık hücre sağda düğmeler kadar yer açar (`actionsWidth`: en çok 2 düğme,
  28 px + 2 px ara, 6 px kenar, 6 px metne; FormGrid pencere kalemi de sayılır).
- Hover'da görünen düğmede yer hover / odakta açılır, değer sola kayar: kalıcı ayrılan yer hover dışında sağda boş
  duruyordu. Dar sütunda değer kesilir; kesilen hücrenin tam metni zaten tooltip'te.
- Hep görünen düğmede (`reveal: 'always'`) yer kalıcıdır ve sütunun varsayılan genişliğine (`width` dahil) eklenir;
  sağa yaslı sütunda başlık da aynı yerde biter.
- Resize ikisinde de en çok düğmeler + 50 px'e iner. `when` bir satırda düğmeyi gizlese de yer açılır: hizalar aynı.
- Düğmeleri sağa yaslı sütunda sola almak seçilmedi: aksiyonların yeri sütundan sütuna değişirdi.

## R38 · `select` düz yazıyla: `display: 'text'` (03'ü genişletir)

- `select` hücresi ve FormGrid listesi seçeneği rozetle çiziyordu. Tonu olmayan, sırası anlam taşıyan seçenekte (POS
  taksiti: Tek çekim, 2 taksit…) rozet sütunu kalabalıklaştırıyor, değer bir durum gibi okunuyordu. `display: 'text'`
  hücrede ve listede düz etiket çizer; varsayılan `'badge'`. Filtre çipi ve filtre editörü değişmez.

## R39 · `select` hücresi: tık yalnız seçer, yazınca ilk eşleşen vurgulu (form-grid.md §3)

- Tık, boş hücrede de yalnız seçer; liste çift tık, Enter ya da Space ile açılır. Önceden boş hücreye tık listeyi
  açıyordu: yer tutucu yazan boş hücrelerin ("Hepsi", "Varsayılan") çok olduğu ızgarada hücreyi seçmek isteyen
  kullanıcının önüne liste çıkıyordu. Shift ile tık aralık seçer.
- Yazarak açılışta liste yazılanla süzülür ve ilk eşleşen hemen vurgulu olur (`autoHighlight: 'always'`); tek Enter
  seçer. Değerin tam yazımı da eşleşir (taksit `1` → Tek çekim), yapıştırmadaki kuralla; değerin parçası aranmaz.
  Önceden değere eşit yazım ("4" → değer 4) süzmeyi atlatıyor, Enter yalnız listeyi kapatıyordu.
- Space listeli hücrede (`select`, `ajax`) listeyi açar, F2 gibi.

## R40 · FormGrid satırı 42 px, varsayılan yoğunluk standart; satır düğmeleri tek grup

- Formda satır elle doldurulur: sıkışık 36 px dar, listenin standart 48 px'i boşluklu. FormGrid'in standart yoğunluğu
  42 px (`.dt-form-grid[data-density='standard']`), varsayılan yoğunluk `standard`; yazı ve iç boşluk standarttaki gibi.
  Liste tablosu 48 px'te kalır. Satır yüksekliği `--dt-row-h`'den okunur, sanal kaydırma aynı sayıyı kullanır.
- Kalem ve ⋯ arası 2 px (tek düğme grubu); üzerine gelince ⋯ de kalem gibi ghost zemin alır.

## R41 · FormGrid gösterimi: `readOnly`, `onRowOpen`, `rowHeight="auto"` (form-grid.md §1 ve §9'u değiştirir)

- Kaydedilmiş belgenin satırları `DataTable` istemci modunda değil, `FormGrid`'in gösterim hâlinde çizilir: belge
  satırı liste değildir (araç çubuğu, sayfalama, görünüm gereksiz), kullanıcı 300–500 satırlık belgede Excel gibi
  seçip kopyalamak ister. Dördüncü bileşen açılmaz: hücre motoru aynıdır, yazan yollar kapanır (form-grid.md §11).
- Depo `readOnly` ile boş satır vermez, hiçbir hücreyi düzenlenebilir saymaz; yapıştırma, silme, çoğaltma çalışmaz.
  Seçim ve kopya depodan okunduğu için değişmez.
- Satır penceresinin yerini `onRowOpen` alır (› düğmesi, ⌘↵, çift tık): detay uygulamanın ekranıdır.
- `rowHeight="auto"` yalnız gösterimde: belge satırının açıklaması, teslim tarihi ve seçenek özeti ayrı satırlarda
  durur. Sanal satırlar TanStack Virtual'ın ölçümüyle (`measureElement`) çizilir; liste tablosunun açılan detayıyla aynı
  yol. Düzenlenen ızgarada sabit yükseklik kalır (R40). Hücreler, satır no ve satır düğmeleri dikeyde ortalıdır:
  görselli iki satırlık ürün hücresinin yanında tek satırlık sayı ortada okunur (Swors belge satırı tasarımı).
- `frame={false}` çerçeveyi ve köşe yuvarlaklığını kaldırır: ızgara bir kartın içinde (belge detayı) kenardan kenara
  durur. Yalnız gösterime bağlı değildir.
- Gösterimde seçim Excel'deki kadar belirgin değildir: hücre düzenlenmez, seçim kopya ve toplam içindir. Zemin
  accent-soft'un yarısı, kenar ve aktif hücre 1 px soluk accent. Alt çubuğun yazısı bir kademe küçük ve soluktur.

## R42 · Başlık, satır no ve alt çubuk zemini: `--dt-head-bg`, `--dt-gutter-bg`, `--dt-foot-bg`

- Belge kartının içindeki çerçevesiz ızgarada (R41) gri başlık, satır no sütunu ve alt çubuk kartın bölümlerinden ayrı
  bir kutu gibi duruyordu. Uygulama üçünün zeminini kartın rengine eşitleyebilir.
- `--dt-surface-2` değiştirilmez: alt çubuk, menüler ve kilitli hücre de onu kullanır. İki token `tokens.css`'te
  tanımlı değildir (dosya Vue spesifikasyonundan üretilir); kullanıldıkları yerde `--dt-surface-2`'ye düşer.
- Saydam değil, kartın rengi: başlık yapışkan, satır no sütunu sabit; saydam zeminde altından geçen satır görünür.

## R43 · Yıkıcı menü öğesi, alt menü oku ve tooltip

- Yıkıcı öğe (`destructive`: Sil) hafif kırmızı zeminde (`--dt-danger` %10) kırmızı ikon ve yazıdır; vurgulanınca zemin
  dolu `--dt-danger`, ikon ve yazı `--dt-on-danger`. Yalnız kırmızı yazı menüde öteki öğelerden zor ayrılıyordu. shadcn
  köprüsü `--dt-danger`'ı `--destructive`'e bağlar: Swors'un DropdownMenu'sündeki Sil ile aynı renk.
- Alt menü tetiğinin oku metin "›" değil 16 px `CaretRightIcon` (`.dt-menu-caret`): metin ok seçilmeyecek kadar küçüktü.
- Hücre tooltip'i (`.dt-tip`) Swors'un shadcn Tooltip'iyle aynıdır: shadcn köprüsü zemini `--foreground`, yazıyı
  `--background`'a bağlar (koyu temada açık kutu; koyu gri kutu tablo zemininden ayrılmıyordu), 12/6 px boşluk, normal
  kalınlık, üst kenarda 10 px ok. Kutu pencere kenarına yaslansa da ok öğenin (geniş öğede imlecin) hizasındadır
  (`--dt-tip-arrow-x`). 10 satır sınırı içteki kutudadır (`.dt-tip-body`): dıştaki kırpsaydı ok da kesilirdi.

## R44 · DataSheet: Vue 07'den sapmalar

- Spesifikasyon: `docs/data-sheet.md` (onaylandı, 2026-11-26). Hücre motoru FormGrid'inki (R34); kanca + bileşen
  (`useDataSheet` / `DataSheet`), liste tablosu gibi.
- Değişen satırın görünen bütün sütunları gider, gizliler gitmez (değiştirildikten sonra gizlenen de); `onSave` satır başına `values` ve taslaklı `row`
  verir, uygulama gönderirken alan ekler ve biçim düzenler (Vue: yalnız değişen alanlar).
- Yeni satırda anahtar, anahtar sütunu `required` değilse boş kalabilir; sunucu numara verir (Swors kod serisi). Boş
  anahtarlar tekillik kontrolüne girmez (Vue 07 §9: anahtar zorunlu).
- Formül çubuğu, "Add row" düğmesi, başlıktan sıralama ve filtre çipleri yok: altta boş satır, Bul, F8 ve Hatalılar
  görünümü yeter (Vue 07 §2, §10, §11).
- `saving` prop'u yok: ilerleme `applyResult` ile gelen satır sayısından; `onSave` reddedilirse sonuçsuz satırlar
  taslak kalır.
- İçe aktarmada `ajax` sütunu `remote.match` ile çözülür (Vue'da yok). Sütun görünürlüğü oturumludur.
- Araç çubuğunu uygulama çizer (Vue'da paket): paket ızgarayı, işaretleri, ⌘S'yi ve onay pencerelerini çizer;
  `useDataSheet` görünüm, sayılar, özet, geri al, kaydet / vazgeç, ilerleme, sonuç ve sütun görünürlüğünü verir.
- İçe aktarma penceresi pakette (`importFile()` sonucu söz olarak döner), dışa aktarma `exportFile()`; düğmeler
  uygulamanın. Alan listesi yalnız görünen sütunlar; aynı değer yazılmaz (dışa aktarıp geri almak değişiklik doğurmaz).

## R45 · DataSheet: penceresiz içe aktarma (`importRows`)

- Uygulama kayıtları başka bir sistemden kendisi getirir (Swors: Bayiloji'den aktarım) ve dosya gibi içe aktarmak
  ister. Penceredeki uygulama adımı (`remote.match` + plan) `import/apply.ts`'e çıktı; pencere ve
  `sheet.importRows(records, { addNew })` aynı yoldan geçer. Kayıt sütun kimliğiyle yazılır, değer dosya hücresi gibi
  çözülür; yalnız görünen alan sütunları yazılır (§6). Vue'da karşılığı yok.
- Satırları `rows` tabanına koymak yeni satır yerine kayıtlı satır sayılmalarına yol açardı; eşlemeyi uygulamada
  yazmak paketin içe aktarma kurallarını kopyalardı.

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

- Dışa aktarma (D46) ⋯ › Export › CSV / Excel; telefonda ⋯ sayfasında Export › seviyesi. Yazıcı (`core/export/`) Vue'nunkiyle
  aynı: playground T1'den inen .csv bayt bayt, .xlsx'in XML'leri birebir aynı. Vue'daki `@export` dinleme kuralının
  karşılığı `onExport` prop'u. Telefon seviyesinin başlığı (`sheet.export`) atlanan sheet bölümünden tek anahtar olarak
  alınır (`scripts/docs.ts` · `KEPT_KEYS`). Vue testindeki okuyucuyla gidiş-dönüş taşınmadı (içe aktarma yok, R1).
- İçe aktarma yok (R1). Telefon araç çubuğu Faz 7'de.
- Vue'daki kaydırma konumu hapı taşınmadı.
- Sütun gösterme isteği debounce edilmez: Columns dialog'u değişiklikleri Save'de tek seferde uygular.
- Uygulama `useDataTable({ density })` ile yoğunluğu sabitlerse Display'deki ve telefon ⋯ sayfasındaki Density seçicisi
  gizlenir (`table.densityFixed`). Vue seçiciyi gösterir ama seçim etkisiz kalır.
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
- Base UI tetikleyicinin arkasına (Combobox) ve açık popover'da önüne de gizli yardımcılar koyar (odak bekçisi
  `aria-hidden`, portal bağı `aria-owns`); `.dt-btn-group`'un kaydırma ve köşe kuralları bunları kardeş saymaz
  (`ui.css`, R9 sapması). Yoksa Display açılınca düğme sol köşesini kaybediyordu (`e2e/layout.spec.ts`).
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
- `bulkActions` ve `selectionActions` yoksa seçim çubuğu çizilmez, `selectionBar="toolbar"` de araç çubuğunun yerini
  almaz: çubukta yalnızca sayaç ve × kalıyordu (aksiyon bölümünün ayırıcıları yan yana). Seçim Export'ta ("Export 3
  selected rows"), header checkbox'ında ve Esc'te kalır. Vue çubuğu her seçimde çizer.
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
- Telefon ⋯ sayfasında Import (R1) yok; Vue playground'unda bu yüzden 1 satır fazla.
- Metin ve sayı editörü açılınca kendi kutusuna odaklanır (Vue: `onMounted` focus); sheet'te başka odak kaynağı yok.
- Vue'dan farkı olmayan ama React'e özgü tuzak: metin editöründe Enter aynı olayda önce değeri yazar sonra Done
  der; sayfanın taslağı updater ile güncellenir, yoksa Done eski taslağı görüp çipi boş sayar.

Faz 7c notları (erişilebilirlik):

- Filtre çipinin gövdesi ya da × odaktayken halka çipin tamamını sarar (düzenleme halkasıyla aynı); odaktaki ×
  hover zeminiyle ayrılır. Vue halkayı yalnızca odaktaki parçaya çizer: editör kapanınca odak gövdeye döndüğü için
  yarım halka çipin kenarıyla üst üste biniyor, × tarafında kesiliyordu. Yüksek kontrastta çip `Highlight`
  outline alır, odaktaki × ayrıca kendi outline'ını (normalde saydam).
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
