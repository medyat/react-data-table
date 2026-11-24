# FormGrid · formun içindeki satırlar

**Durum:** Onaylandı, 2026-11-23.

Paket üç tablodur, üçü ayrı bileşen ve ayrı sözleşmedir (D17'nin "union yok" gerekçesi React'te de geçerli):

| Bileşen | İş | Veri kimin | Kaydetme |
|---|---|---|---|
| `DataTable` | Sunucudan sayfa sayfa gelen kayıt listesi; salt okunur | Sorgu (`table.request` → `result`, R4) | Yok |
| `DataSheet` | Çok kaydı tabloda toplu düzenleme (Vue 07: anahtar sütun, içe aktarma, `onSave` / `applyResult`) | Bileşenin taslak deposu | Bileşen değişiklikleri teslim eder |
| `FormGrid` | Bir formun **tek alanı** olan satır dizisini düzenler: belge satırları, POS komisyon oranları, talep satırları | Formun (React Hook Form) | Form kaydeder; ızgara kaydetmez |

`FormGrid`, DataSheet'in hücre motorunu (seçim, klavye, editörler, pano, doldurma, geri al) paylaşır; bu yüzden
DataSheet'ten önce yazılır ve motor `core/`'a girer (iki kuralı: DataSheet geldiğinde ikinci kullanıcı olur).
Vue D31 (`DocumentTable` kapsam dışı) salt okunur detay tablosu içindi; düzenlenen satır dizisi o karar
yazılırken yoktu. Bu belge D31'i değiştirmez, yanına üçüncü bileşeni koyar (R34).

Tasarım panoları: "Belge satır tablosu" (Swors, claude.ai artifact `75ijYnWfh7U7aioh8A6aTR`). Aşağıda pano adları
oradaki kodlardır (1a, F3a, G1a…).

## 1. Ne zaman hangisi

- Satırlar bir kaydın parçasıysa ve kayıtla birlikte tek istekte gidiyorsa: `FormGrid`.
- Satırlar kendi başına kayıtsa ve çoğu aynı anda değişiyorsa (fiyat listesi, ürün kartları): `DataSheet`.
- Yalnızca gösteriliyorsa: `DataTable` (istemci modunda) ya da uygulamanın kendi tablosu (D31).

## 2. API

```tsx
// Swors tarafı: RHF'ye bağlayan ince sarmalayıcı uygulamada durur (paket RHF'ye bağımlı değil).
<FormGrid
  rows={rows}                      // Row[] — formun değeri
  onRowsChange={(rows, change) => …} // her düzenleme, yapıştırma, doldurma, geri al tek çağrı
  columns={columns}                // ColumnDef<Row>[] — liste tablosuyla aynı tür ve alanlar (§3)
  errors={errors}                  // Record<string, string>, anahtar "3.detail.delivery_term" (§6)
  newRow={(rows) => ({ … })}       // boş satıra ilk değer yazılınca öbür hücreler (§5)
  maxRows={12}                     // dolunca boş satır kaybolur (§5)
  rowActions={rowActions}          // RowAction<Row>[] — paketteki tip; ⋯ menüsü
  rowDialog                        // varsayılan true: kalem + satır penceresi (§7)
  reorderable={false}              // varsayılan false (§5)
  search                           // varsayılan true: ⌘F ızgara araması (§8.1); false kapatır
/>
```

- **Kontrollü ve RHF'den bağımsız.** Paket veri çekmez (D18) ve form kütüphanesi seçmez. Swors'ta
  `src/components/form/` altında `useController` ile bağlayan bir alan bileşeni durur; değer RHF'de kalır.
- **`change`** neyin değiştiğini söyler (`{ kind: 'edit' | 'paste' | 'fill' | 'undo' | 'redo' | 'remove', cells }`):
  uygulama örneğin yalnız Ürün değişince fiyat ister.
- **Satır kimliği:** `getRowId(row)` verilmezse paket satıra geçici kimlik verir (seçim ve geri al için); kimlik
  `rows`'a yazılmaz. Uygulama bir satırı yeni nesneyle değiştirince (sunucudan gelen fiyat, form kütüphanesinin
  kopyası) kimlik aynı sıradaki eski nesneden devralınır; `getRowId` bu yüzden isteğe bağlıdır. Devralma, satırların
  sırası değiştirilip aynı anda kopyalandığında tutmaz: sıralanabilir ızgarada (`reorderable`) `getRowId` verilir.
- Boş satıra yazınca doğan satır `kind: 'edit'`, yapıştırmayla doğanlar `'paste'` bildirilir. "Araya ekle" yalnız
  `reorderable` ile gelir (§5); o gelince `'insert'` eklenir.

## 3. Sütunlar: tek sözleşme

`FormGrid` sütunu `DataTable`'ın `ColumnDef`'idir. **Tür adları değişmez:** 23 tür aynen kullanılır (03); ekran için
yeni tür uydurulmaz. Panolardaki sütunlar şöyle eşlendi:

| Sütun (pano) | Tür |
|---|---|
| Ad, GTİP | `string` (GTİP `validate` ile 12 rakam) |
| Açıklama, Not | `text` |
| Miktar, Stok, Faturalanan | `decimal` (R35) |
| Bloke (gün) | `int` + `unit` |
| İndirim / KDV / vergi / komisyon oranı | `percentage` (18 saklanır, bölünmez) |
| Birim fiyat, tutarlar, Sigorta, Navlun, FOB | `currency` (`currency: row => belgenin birimi`) |
| Birim, KDV, Teslim şekli, Taksit, Tevkifat kodu, Takip | `select` |
| Ürün, Konum (çıkış / giriş) | `ajax` |
| İstenen tarih | `date` |
| Taksitle aktarım | `boolean` |
| Sipariş, Kaynak bağlantısı | `id` + `href` |
| Görsel | `string` + `cell` |
| Taşıma, Kap | `object` + `editor` pencere (§7) |
| Lot / seri, sevk satırları | `array` + `editor` pencere (§7) |

### 3.1 DataSheet'ten gelen alanlar (Vue 07 §3, §5)

R1 bunları liste için sütundan çıkarmıştı; `FormGrid` ile geri gelir, `DataTable` onları yok sayar:

```ts
editable?: boolean | ((row: Row, ctx: { isNew: boolean }) => boolean)
editor?: CellEditor | WindowEditor<Row>   // WindowEditor: §7
validate?: Validator<Row>   // (value, { row, rows, isNew }) => string | null; Vue'daki `original` yok
warn?: Validator<Row>
hint?: string
optionEnabled?: (option: OptionDef, row: Row, rows: readonly Row[]) => boolean  // Vue'da rows yok
```

### 3.2 Yeni ya da genişleyen alanlar

Her biri bir panodan çıktı; pano yoksa alan da yok.

| Alan | İmza | Neden (pano) |
|---|---|---|
| `required` | `boolean \| (row) => boolean` | Vue'da yalnız `boolean`. Çıkış konumu yalnız Stok takipli satırda zorunlu (S1a). Fonksiyonsa header yıldız taşımaz. |
| `optionEnabled` | `rows` üçüncü parametre | Taksit her satırda bir kez (G1a). |
| `remote.search` | `ctx.row` eklenir | Konum seçicisi satırdaki ürünün stoklu raflarını ister (1h, S1a). Boş satırda `row` yok. |
| `remote.match` | `(texts, { signal }) => Promise<(O \| null)[]>` | Excel'den ürün kodu ya da adı yapıştırılır; seçenek `onChange`'e gider, boş yapıştırılan Ad üründen dolar (1b). Paket 100'erlik sorar; bulunamayan metin değer olarak kalır, sunucu reddeder. Verilmezse metin değerdir. |
| `placeholder` | `(row) => string \| null` | Boş hücrede başka yerden gelen değer soluk yazılır, değer olmaz: talebin İhtiyaç tarihi (T1a). |
| `onChange` | `(row, value, { option, rows }) => Partial<Row> \| void` | Aynı satıra yazma: tek çekimde Taksitle aktarım kapanır (G1a), Ürün seçilince Ad ve Birim dolar (1b). `option` seçilen seçenektir; `ajax`'ta aramanın döndürdüğü nesne, ek alanlarıyla (ürünün birimi). Yazılanlar aynı geri al adımına girer; onların `onChange`'i çağrılmaz. |
| `group` | `string \| string[]` | İç içe başlık: İndirim → Oran \| Tutar, ek vergiler grup → vergi → Oran \| Tutar, İhracat (F1a, F1b, F3a). Grup başlığı rengi yalnız başlık hücresinde. |
| `display` (`boolean`) | `'text' \| 'switch'` | POS'ta anahtar görünümü (G1a). |

Seçimle gelen ama satır değerine girmeyen bilgi (talebin Stok sütunu, T1a) `accessor`'lı sütundur: `accessor`'lı sütun
düzenlenmez ve ızgara ona yazmaz. Taslaktaki `send: false` bu yüzden eklenmedi (F2).

`ajax` hücresi: yazılan metin aramadır, değer değil; listeden seçilene kadar hücre eski değerini korur. Liste ilk
sayfayı gösterir (arama daraltır); kaydırınca devamı yüklenmez. Seçeneğin içeriği varsayılan olarak ad + açıklamadır; `Item`
(`ComponentType<{ option, search }>`, Swors `SourcePicker`'ın adı ve biçimi) stok, kategori gibi alanları çizer:
`option` aramanın döndürdüğü nesnedir. Liste içeriğe göre genişler, `wide` gerekmez.

Vue'daki "aynı satırda başka hücre değişince kilit ve doğrulama yeniden değerlendirilir" kuralı kalır; `onChange`
ondan farklıdır: kilit değeri silmez, `onChange` değer yazar.

### 3.3 Hücre aksiyonları

`actions` (`CellAction`) liste tablosundaki gibidir; genişler (F4a):

- `menu` kendine döner: iç içe menü ("Fiyat getir ›").
- `run(row, ctx)`: `ctx.setValue(value)` hücreye yazar ve geri al'a girer; `ctx.anchor` hücrenin kendisi
  (uygulamanın popover'ı için).
- Menü öğesinin kendi kısayolu yok.

## 4. Yerleşim

Tek düzen; belgede de form içinde de aynı (POS tablosu için ayrı "gömülü" düzen yok):

- Solda satır numarası (gutter; hatalı satırda kırmızı ikon), sağda sabit eylem sütunu: kalem + ⋯.
- Başlık yapışkan; satırlar sayfa ya da Sheet gövdesiyle kayar, tablo kendi içinde dikey kaymaz.
- Yatay kaydırma tablonun kendi çubuğuyla değil, alt çubuğun hemen üstündeki her zaman görünen çubukla;
  ikisi birlikte yapışkan alt. Satır no ve birinci sütun solda sabit.
- Altta her zaman bir boş satır (`maxRows` dolana kadar).
- **Alt çubuk** tablonundur: solda satır sayısı + "N hata — git"; iki ve daha çok hücre seçiliyse sağda Hücre,
  Toplam, Ortalama, En küçük, En büyük. Ekrana özel metin yazılmaz.
- Telefonda aynı sütunlar, yatay kayar; hücre içi düzenleme yok, satıra dokunmak satır penceresini açar (3a, 3b).

## 5. Satırlar

- **Ekleme:** boş satıra yazmak satırı doğurur; `newRow(rows)` öbür hücreleri doldurur (yoksa boş). Yapıştırma
  alttan satır ekler.
- **`maxRows`:** dolunca boş satır kaybolur; sınırı aşan yapıştırma fazla satırı almaz ve kaç satırın alınmadığını
  söyler. `minRows` yok: en az bir satır kuralı sunucunun hatasıdır, alanın altında yazar.
- **Silme:** ⋯ ve sağ tık menüsünde; seçili satırlar birlikte ("3 satırı sil"); seçim dışındaki satırın ⋯'u yalnız
  o satırı siler. Paketin öğesidir, `rowActions`'ın altında; geri al satırları yerine koyar.
- **Sıra:** `reorderable` kapalıyken sürükleme ve "araya ekle" yok, yeni satır sona (belge satırlarında `sq` yok).
- **Boyut:** 1000 satır × 30 sütunda donmaz. Satırlar sanal (sabit satır yüksekliği), sütunlar değil; aktif hücre
  ve seçim satır dışı depoda, hücre yalnız kendi durumunu dinler; geri al değişiklik farkı tutar; kopyala, seçim
  özeti ve "hataya git" DOM'dan değil veriden. 1000×30 fixture ile ölçülür.

## 6. Hatalar

- `errors` anahtarı satır sırası + alan yoludur (`"3.detail.delivery_term"`). Paket her anahtarı, `id`'si yolun en uzun
  ön eki olan sütuna eşler: `detail.transport.vessel_name` → Taşıma (`detail.transport`). Swors sarmalayıcısı
  RHF hatalarını (`lines.3.…`) bu biçime çevirir.
- Hata hücreyi kırmızı yapar; mesaj hücre seçilince ya da üzerine gelince balonda. Hiçbir sütuna düşmeyen hata
  satır başındadır (gutter); klavyeyle okunabilsin diye satırın ilk hücresinin balonunda da görünür ve F8 oraya iner.
- Sunucu hatası olan hücrede istemci kuralı gösterilmez (bir hücre, bir balon). Uyarı (`warn`) sarı köşe + balondur;
  "N hata — git" sayısına ve F8 sırasına girmez. "N hata" hücreleri değil hatalı satırları sayar (Vue ile aynı).
- Seçenek dışı değerde yakın seçenek varsa balonda "{seçenek} kullan" düğmesi hücreye yazar (geri al'a girer).
- `validate` / `warn` istemci kuralıdır; zorunluluk ve iş kuralları sunucudan gelir. `required` istemcide hata
  üretmez, yalnız başlığa yıldız koyar.

## 7. Pencereler

- **Satır penceresi** (`rowDialog`): paket sütunlardan üretir; alanlar sütun sırasıyla tek sütun, dar (440 px).
  Uygulama sütun başına düzenleyiciyi verir. Tamam'da satıra yazar; ‹ › önceki / sonraki satır. Izgaradaki grup
  pencerede bölüm olur (İhracat, F2a).
- **Pencere düzenleyici** (`editor: { window: Component }`): `object` / `array` sütunu hücrede yazılmaz; hücre
  özet gösterir, kalem (hücre aksiyonu), çift tık ya da F2 uygulamanın penceresini açar. Pencere `{ row, value,
  onApply, onCancel }` alır; içini uygulama tasarlar (Lot / seri, Taşıma, Kap). Değer ⌘C / ⌘V / ⌘D ile bütün nesne
  olarak taşınır.

## 8. Klavye

Vue 08'in sheet klavyesi geçerli; farklar:

- Tek ana tuş: Mac ⌘, Windows Ctrl; ipucu sisteme göre. Alt/⌥ ile kısayol yok, **tek istisna ⌥↵ / Alt+Enter**:
  hücrenin aksiyon menüsünü açar (Swors'taki lookup alanıyla aynı tuş). `text` hücresi düzenlenirken ⌥↵ menü açmaz, hücrenin içinde satır atlatır
  (Excel gibi; ⇧↵ de aynı); menü yine hücre seçiliyken açılır.
- ⌘ + yön o yönde en sona gider (aşağıda son dolu satıra, boş satıra değil); ⌘⇧ + yön seçimi oraya kadar büyütür
  (Excel). Izgara olayı işlediği için tarayıcının kendi işi çalışmaz. ⌥ + yön ızgara tuşu değil.
- F2 hücreyi düzenler; pencere türünde pencereyi açar. Yazmaya başlamak düzenler.
- Enter düzenlemede onaylayıp alt hücreye iner, düzenleme yokken yalnız alt hücreye geçer.
- `select`, `ajax` ve `date` editöründe liste / takvim açıkken Enter önce ona gider; listeden ya da takvimden seçmek
  hücreyi onaylar (Enter ile seçilince alt hücreye de iner; Vue'da ikinci Enter gerekiyordu). Tab her zaman onaylar.
  ⌥↓ takvimi açar.
- Esc `select` / `ajax` hücresinde liste açıkken de düzenlemeyi tek basışta iptal eder (Excel gibi). Vue 07 §5'te ilk
  Esc listeyi kapatıp editörde bırakıyordu; hücrede liste düzenlemeyle kendiliğinden açılır, listesiz kalan editörün
  işi yok. Takvim kullanıcının açtığı katmandır: Esc önce onu kapatır, yazılan tarih kalır.
- Ondalık türler (`decimal`, `currency`, `percentage`) metin yazar (R35): "2,5" → `"2.5"`. F2 sunucunun metnini noktayı
  ondalık sayarak açar (tr `"123.456"` → `123,456`); değeri değişmeden Enter yazmaz.
- Sayı editörü yazılanı temizler: harf ve ikinci ondalık ayırıcı yazılmaz, görünen değer yazılandır (filtre sayı
  editörüyle aynı `cleanNumber`). F2 sayıyı yerel ondalıkla açar (tr `1200,5`).
- `text` hücrenin altında açılan kutuda yazılır (en az 320 px, satırların üstüne taşmaz); hücre ilk satırı gösterir.
  Yazmaya başlamak, F2, çift tık ve hücredeki ⤢ kutuyu açar; kilitli hücrede ⤢ yalnız tam metni gösterir.
- Izgara dışına tık onaylar (blur ile onay yok); listedeki ve takvimdeki tık dışarı sayılmaz (`dt-sheet-layer`).
- Izgarada Kaydet kısayolu yok (formun işi).
- Sağ tık menüsü (pano ContextMenu): hücre grubu (başlıkta hücre ve atlanan kilitli hücre sayısı; seçim tamamen
  kilitliyse Kes, Temizle, Doldur pasif), "Seç ›" (satır ⇧Space, sütun ⌃Space, tümü ⌘A), satır grubu (başlıkta satır
  sayısı). ⋯ yalnız satır grubu. Menüden Yapıştır izin alamazsa alt çubukta "⌘V ile yapıştırın" yazar.
- F8 / ⇧F8 sonraki / önceki hata. ⌘⌫ seçili satırları siler (Vue'daki ⌘− sembol tuşu olduğu için alınmadı).
- ⌘Z yalnız kullanıcının yazdığını geri alır: hücre o adımdan sonra uygulama tarafından değiştirildiyse (ör. sunucudan
  gelen fiyat) o hücre atlanır, öbürleri geri alınır.

### 8.1 Arama

Satırlar sanal çizildiği için tarayıcının ⌘F'si ekran dışını bulmaz; ızgaranın kendi araması vardır.

- Genel arama: tek kutu, bütün hücreler; sütun seçilmez, satır gizlenmez (filtre değil). Hücrenin **görünen**
  metninde arar (biçimlenmiş tutar, seçeneğin adı).
- ⌘F yalnız odak ızgaradayken kutuyu açar; formun başka yerinde tarayıcınınki çalışır. Eşleşmeler vurgulanır,
  kutuda "3 / 12"; Enter sonraki, ⇧Enter önceki: ızgara kayar, hücre aktif olur. Esc kutuyu kapatır, odak hücrede kalır.
- `search={false}` kapatır: ⌘F tarayıcıya kalır.

## 9. Kapsam dışı

DataSheet'e ait olanlar `FormGrid`'de yok: anahtar sütun ve upsert, Excel içe aktarma dialog'u, All / Changed /
Errors süzgeci, formula bar, `onSave` / `applyResult`, header'dan sıralama ve filtre (satır gizlemek yapıştırmayı,
doldurmayı ve hataya gitmeyi bozar; bulmak için §8.1).

Swors'ta sipariş ve teklif satırları da `FormGrid` kullanmaz: önce kayıt açılır, satır Sheet'te tek tek girilir
(ürün kararı, 2026-11-23). `FormGrid` Sevk belgesi, fatura, stok fişi, satın alma talebi ve form içi tablolar içindir.

## 10. Uygulama sırası

| Faz | Kapsam |
|---|---|
| F1 | Çekirdek motor `core/`'da: seçim, klavye, yazınca düzenleme, geri al; `string`, `text`, `decimal`, `int`, `percentage`, `currency`, `select`, `date`, `boolean`; hatalar (§6); alt çubuk; 1000×30 ölçümü |
| F2 | `ajax` (satır bağlamıyla), `newRow`, `maxRows`, `onChange`, `required(row)`, `optionEnabled(…, rows)`, `placeholder` |
| F3 | Pano: kopyala, yapıştır (Excel), ⌘D doldurma; sağ tık menüsü; arama (§8.1) |
| F4 | Satır penceresi, pencere düzenleyici, hücre aksiyonu genişlemesi (§3.3), telefon |
| F5 | İç içe başlık (`group`); liste tablosu da kullanır |

Her faz playground'da bir senaryo sayfası ve `pnpm check` ile biter. Swors'ta ilk ekran Sevk belgesidir.

**Hız bütçesi** (1000 × 30, Chrome'da Playwright ile; jsdom süresi yalnız algoritma için): ok tuşundan çizime
< 16 ms, hücre onayından çizime < 50 ms, ilk çizim < 300 ms.

Ölçüm `e2e/form-grid-perf.spec.ts`: olaydan DOM'un güncellenip yerleşimin bittiği ana kadar (boyama hariç), ortanca
bütçeyle karşılaştırılır. 2026-11-24, Apple Silicon, Chrome: ilk çizim ~110 ms (en kötü ~250), ok tuşu ~0,3 ms (yalnız
iki hücre yeniden çizilir), hücre onayı ~22 ms (en kötü ~73; onay bütün satırların sorunlarını yeniden hesaplar). F3'ten sonra
(her satırın ⋯'u seçimi dinler): ilk çizim ~131 ms, ok tuşu ~0,3 ms, hücre onayı ~28 ms (en kötü ~71).

F1 adımları: A saf katman (tipler, ayrıştırma, hata eşleme, seçim özeti, doğrulama) · B depo ve klavye · C iskelet ·
D düzenleme ve editörler · E hatalar ve alt çubuk · F ölçüm.

F3 kararları:
- Kopya görünen biçimdedir (`1.200,50`, seçeneğin adı), TSV + HTML tablosu; yapıştırma sütunun ayrıştırmasından
  geçer, böylece kopyalanan geri yapıştırılır. Tek değer + aralık: aralığın hepsine. Kilitli hücre atlanır.
- Aynı yapıştırmada `onChange`'in yazdığı alanı boş hücre ezmez (kod + boş Ad → Ad üründen), dolu hücre ezer.
- Yapıştırmadaki boş Excel satırı da satır olur: atılsaydı alttaki satırlar yukarı kayardı.
- ⌘D Excel'deki gibi: aralıkta ilk satır aşağı, tek satırda üstteki satır. Seri (1, 2, 3…) yok.
- `maxRows`'u aşan yapıştırmanın alınmayan satır sayısı alt çubukta yazar, sonraki tuşta kalkar (pakette toast yok).
- Menüden kopyala / yapıştır tarayıcının pano iznini ister; kısayollar izinsiz çalışır.
- ⌘F 1000×30'da tuş başına ~70 ms tarar (dev): kutu `useDeferredValue` ile takılmaz. Eşleşme mor; uyarı ve seçim
  üstüne binince onlar görünür.

**Uygulama notları**

- Hücre editörleri filtre editörlerinden ayrıdır (Vue 07 §5'ten sapma; Vue kodu da ayrı yazmış): filtre editörü
  operatör taşır ve gecikmeyle uygular. Ortak olan sayı ayrıştırma ve takvimdir.
- Seçim TanStack ile değil motorun deposuyla tutulur (TanStack yalnız iki dosyada, CLAUDE.md).
- Hatalar, F8 sırası ve seçim özeti her çizimde veriden tek geçişte hesaplanır (`core/sheet/issues.ts`); seçim özeti
  ayrı bileşen olarak depoyu dinler, ok tuşunda ızgara yeniden çizilmez.
- Yapışkan başlık ile yatay kaydırma aynı kapta olamaz: başlık, gövde ve alt çubuk ayrı kaplar, `scrollLeft` eşitlenir.
