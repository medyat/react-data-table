# DataSheet · toplu kayıt

**Durum:** Onaylandı, 2026-11-26. Vue'dan sapmalar: R44.

Çok kaydı tek ekranda Excel gibi düzenleyip tek Kaydet ile göndermek: ürün kartları, cariler, kategoriler, fiyat
listeleri. Spesifikasyon Vue 07 (`../data-table/docs/data-table/07-mode-sheet.md`); bu belge yalnız React'te farklı
olanı ve Vue'da olmayanı yazar. Burada geçmeyen konuda Vue 07 geçerlidir.

Hücre motoru FormGrid'inkidir (`core/sheet`: seçim, klavye, editörler, pano, doldurma, geri al, arama, satır
penceresi). Hücre, klavye ve pano kuralları `form-grid.md` §3–§8'deki gibidir; DataSheet onların üstüne taslak
katmanı, anahtar sütunu, kaydetme ve içe aktarma ekler (R34: motorun ikinci kullanıcısı).

İlk kullanıcı Swors'un `mass-save` uçlarıdır (§9); paket yine HTTP bilmez (D18).

## 1. API

```tsx
const sheet = useDataSheet({
  rows,                       // Row[] — uygulamanın yüklediği kayıtlar (taban)
  loading,                    // boolean | { done, total } — yüklenirken düzenleme kapalı (ilerlemeyi uygulama çizer)
  columns,                    // ColumnDef<Row>[] — DataTable / FormGrid ile aynı tür ve alanlar
  keyColumn: 'code',          // eşleme anahtarı (§3)
  getRowId: (row) => row.id,  // yüklenen satırın kimliği; yeni satıra paket kimlik verir
  newRow: (rows) => ({ … }),  // FormGrid'deki gibi
  maxRows: 10_000,
  onSave: async (changes) => { … },  // §5
})

<DataSheet sheet={sheet} label="Ürünler" />
// frame={false}: dış çerçeve uygulamanın; autoFocus: satırlar ilk gelince imleç ilk düzenlenebilir hücrede
// (kullanıcı daha önce bir hücreye girdiyse dokunmaz: boş tabloda yazılan ilk satır odağı kaçırmaz)

sheet.isDirty        // ayrılma koruması uygulamanın (yönlendirici + beforeunload)
sheet.applyResult(results)
sheet.reset()        // onaysız

// Araç çubuğu uygulamanındır (§2): durumu okur, komutları çağırır.
sheet.view / sheet.setView(view)        // 'all' | 'changed' | 'errors'
sheet.counts                            // { all, changed, errors }: görünümlerin satır sayısı
sheet.summary                           // { rows, cells, newRows }: "96 satırda 128 değişiklik · 1 yeni"
sheet.canUndo / canRedo / undo() / redo()
sheet.save()                            // ⌘S ile aynı; hatalı satır varsa paketin onayı (§5)
sheet.discard()                         // paketin onayını sorar, taslağı atar
sheet.saving                            // { done, total } | null
sheet.result                            // { created, updated, failed } | null: son kayıt, sonraki değişiklikte kalkar
sheet.readOnly / sheet.phone            // düzenleme kapalı (telefon, yükleme, kayıt) / telefon
sheet.openColumns()                     // liste tablosunun Sütunlar penceresi: göster / gizle, sıra; sabitleme yok
sheet.focusNewRow()                     // Tümü'ne geçer, imleç alttaki boş satırın anahtardan sonraki ilk hücresinde
sheet.importFile()                      // paketin penceresi; Promise<{ updated, added } | null>
sheet.exportFile({ format, name, columns }) // 'xlsx' | 'csv'; bütün satırlar; columns: 'visible' (varsayılan) | 'all'
```

- Kabı sütunlu flex ise ızgara boyunu doldurur: az satırda alt çubuk kabın dibinde durur (2026-11-26).
- Sütunlar liste tablosunun penceresiyle seçilir (karar, 2026-11-26): iki ayrı sütun seçici olmasın. Anahtar başta
  kilitli, `required` gizlenemez; ızgara yalnız ilk sütunu sabitlediği için sabitleme bölümü çizilmez. Düzen oturumludur.
- Liste tablosundaki gibi kanca + bileşen (`useDataTable` / `DataTable`): uygulama `isDirty`'yi ve `applyResult`'ı
  ref olmadan alır.
- **Kontrolsüz:** taslak paketin içindedir. `rows` tabandır; Vue 07 §14'teki gibi uygulama `rows`'u yenileyince gelen
  anahtarların tabanı yenilenir, taslaklar kalır.
- Satır kimliği: `getRowId` yüklenen satır içindir (Swors'ta uuid). Yeni satırın kimliği paketindir ve `onSave`'de
  `id` olarak gider; Swors bunu istekteki `rows.*.uuid` olarak kullanır.

## 2. Yerleşim

Vue 07 §2'deki düzen, şu farklarla:

- **Araç çubuğu uygulamanındır (karar, 2026-11-26):** paket ızgarayı, hücre ve satır işaretlerini, ⌘S'yi ve iki onay
  penceresini (hatalı satır, Vazgeç) çizer. Görünüm seçici, geri al / yinele, sütunlar, değişiklik özeti, Vazgeç,
  Kaydet, yükleme ve kayıt ilerlemesi, kısmi kayıt şeridi ve telefon notu uygulamanın kendi bileşenleriyle çizilir ve
  `sheet`'in durumunu okuyup komutlarını çağırır (§1). Neden: çubuk küçük, uygulamanın tasarım diliyle görünmeli ve
  ekrana göre değişebilir (şablon indir, sütunları göstermemek); kurallar (hatalı satır onayı, gönderilecek satırlar,
  sayılar) yine pakette tek yerde. Önerilen çubuk: Tümü / Değişenler / Hatalılar · Geri al / Yinele · İçe aktar ·
  Dışa aktar · Sütunlar · sağda özet · Vazgeç · Kaydet ⌘S. Bul ⌘F ile açılır.
- Formül çubuğu yok. Uzun metin için `text` hücresinin kutusu ve satır penceresi (⌘↵) var; formül
  desteklenmediği için çubuğun hücreden fazla bir işi yok.
- "Satır ekle" düğmesi yok. FormGrid'deki gibi altta her zaman bir boş satır var (yalnız Tümü görünümünde);
  yazmak satırı doğurur, yapıştırma alttan satır ekler.
- Satır no (gutter) kalıcıdır: yükleme sırası, yeni satırlar sonraki numaraları alır. Değişenler / Hatalılar
  görünümünde numara değişmez, böylece "Satır 214" mesajı her görünümde aynı satırı gösterir. Gutter işaretleri:
  değişti (accent kare), yeni (+), hata (kırmızı ikon).
- Satırlar sayfa ya da Sheet gövdesiyle kayar, alt çubuk ve yatay çubuk yapışkan (FormGrid §4).
- **Telefon (D14):** salt okunur (`sheet.phone`); notu uygulama gösterir. Bul ve kopya kalır.

## 3. Anahtar sütunu

- `keyColumn` kaydın sunucudaki eşleme alanıdır (Swors'ta `code`). Yüklenen satırda kilitlidir; yeni satırda yazılır.
- **Yeni satırda anahtar isteğe bağlı olabilir** (Vue 07 §9'dan sapma). Anahtar sütununun `required`'ı belirler:
  `required: false` ise kullanıcı kodu yazabilir ya da boş bırakabilir; boş anahtarlı satır gönderilir ve sunucu
  numarayı kendisi verir (Swors: kod serisi). Boş hücrede sütunun `placeholder(row)`'u yazar ("Sonraki numara").
  Değer olmaz.
- Aynı anahtar listede iki kez olamaz: iki satırın anahtar hücresi de hata alır ve hiçbiri gönderilmez (Vue 07 §9).
  Boş anahtarlar bu kontrole girmez.
- Anahtar sunucuda aranmaz (D47): yeni satırın anahtarı var olan bir kayda denk gelirse ne olacağına sunucu karar
  verir (Swors'ta kayıt seçenekleri, §9).

## 4. Taslak ve değişiklik

- Depo FormGrid'inkidir. DataSheet onu kendi satır dizisiyle besler ve tabanı (`rows` + kaydedilenler) yanında tutar.
  Hücre "değişti" sayılır, değeri tabandakinden farklıysa (`sameValue`; ondalıkta `sameDecimal`). Geri alınarak eski
  değerine dönen hücre değişmiş sayılmaz.
- Satırı listeden çıkarmak (⌘⌫, menüde nötr renk: "Listeden çıkar") kaydı silmez: o satırın değişiklikleri gönderilmez,
  yeni satır tamamen gider (D12). Geri al geri getirir.
- **Tümü / Değişenler / Hatalılar** yalnız görünümü daraltır. Daraltılmış görünümde yapıştırma ve doldurma yalnız
  görünen satırlara yazar; sonradan düzelen satır imlecin altından kaçmaz, bir sonraki görünüm seçimine kadar kalır
  (Vue 07 §11).
- Başlıktan sıralama ve filtre çipleri yok (Vue 07 §10–§11'den sapma). Bul (⌘F), F8 ve Hatalılar görünümü
  aramanın ve gözden geçirmenin işini görüyor. Sıralama, kalıcı satır no ile karışık bir düzen getirir; ihtiyaç
  çıkınca eklenir.
- Sütun görünürlüğü oturumludur, kaydedilmez. Gizli sütunlar gönderilmediği için (§5) eski oturumdan kalan bir
  gizleme kullanıcıyı şaşırtırdı. Başlangıç sütunun `hidden`'ıdır. `required` sütun ve anahtar gizlenemez.

## 5. Kaydetme

**Ne gönderilir (karar, 2026-11-26):** yalnız yeni ve değişmiş satırlar. Değişmiş satırın **görünen bütün sütunları**
gider, gizli sütunlar gitmez. İstisna: değiştirildikten sonra gizlenen sütun gider, yoksa kullanıcının değişikliği
sessizce kaybolurdu. Yeni satırda boş hücre ve gizli sütun gönderilmez (Vue 07 §9). Hatalı ve listeden çıkarılan satır
gitmez. Hiçbir koşulda silme yok (D11).

```ts
interface SheetChangeRow<Row> {
  id: string            // yüklenen satırda getRowId, yenide paketin kimliği
  isNew: boolean        // listeye bu oturumda eklendi (sunucuda olup olmadığını paket bilmez, D47)
  key: unknown          // anahtar sütununun değeri; yeni satırda boş olabilir (§3)
  values: Partial<Row>  // görünen sütunların değerleri, sütun id'sinin yoluyla (`variables.renk`)
  row: Row              // satırın taslaklı tam hâli, gizli alanlar dahil
}
onSave: (changes: { rows: SheetChangeRow<Row>[] }) => Promise<void>
```

- **`values` + `row`:** varsayılan olarak `values` gönderilir. Uygulama gönderirken alan ekler ve biçim düzenler:
  gizli para birimini `row`'dan alır, değeri sunucunun biçimine sokar, istek düzeyindeki işaretleri koyar. Pakette
  bunun için ayrı bir seçenek yok (karar, 2026-11-26). `accessor`'lı sütun `values`'a girmez: ızgara ona yazmaz.
- **Başlatma:** Kaydet ya da ⌘S (odak ızgaradayken). Hatalı satır varsa önce paketin onay penceresi (Vue 07 §14):
  "N satırda hata var" · Önce düzelt · Yine de kaydet. Yine de kaydet hatalılar dahil değişen bütün satırları
  gönderir: hata sunucudan gelmiş olabilir (eşleşmeyen ilişki, geçici sorun) ve kullanıcının düzeltecek bir şeyi
  olmayabilir; sunucu yine reddederse hata satırda kalır, hatasız satırlar kaydedilir (karar, 2026-11-26). Uygulamanın kendi onayı (Swors'ta kayıt
  seçenekleri) `onSave`'in içindedir; vazgeçilirse `onSave` sonuç vermeden döner ve taslak olduğu gibi kalır.
- **İlerleme:** `onSave` sürerken ızgara salt okunurdur (kaydırma, Bul ve seçim serbest). Paket ilerlemeyi
  kendisi sayar: `applyResult` ile gelen satır sayısı / gönderilen satır sayısı. Uygulama parçaları işledikçe
  `applyResult` çağırır. Vue'daki `saving` prop'u bu yüzden yok.
- **Taşıma hatası:** `onSave` reddedilirse sonuç gelmeyen satırlar taslak olarak kalır, kullanıcı tekrar kaydeder.
  Mesaj uygulamanındır.

```ts
type SheetRowResult<Row> =
  | { id: string; status: 'created' | 'updated'; row?: Row }
  | { id: string; status: 'error'; fieldErrors?: Record<string, string | string[]>; rowError?: string }
```

- `created` / `updated`: taslak düşer, `row` verildiyse taban onunla yenilenir (boş anahtarla açılan satır sunucunun
  verdiği kodu böyle alır), satır "yüklenmiş" olur ve anahtarı kilitlenir.
- `error`: değişiklikler kalır. `fieldErrors`'ın anahtarı alan yoludur ve FormGrid §6'daki gibi en uzun ön eki sütun
  id'si olan sütuna düşer; düşmeyen ve `rowError` satırındır. Kullanıcı hücreyi düzenleyince o hücrenin sunucu
  hatası kalkar.
- Bitiş Vue 07 §14'teki gibi: hepsi kaydedildiyse alt çubukta "96 satır kaydedildi · 24 yeni · 72 güncellendi";
  bir kısmı kaydedilemediyse kırmızı şerit, görünüm Hatalılar'a geçer, aktif hücre ilk hatada. Geri al yığını
  temizlenir.
- **Vazgeç:** onay penceresi, sonra `reset()`. Bütün satırlar tabana döner.

## 6. İçe aktarma (Excel / CSV)

Vue 07 §13 ve D46, şu farklarla:

- **Pencere paketindir, düğme uygulamanın:** çubuktaki İçe aktar `sheet.importFile()` çağırır; pencere Tümü görünümünde
  açılır, uygulanınca söz `{ updated, added }` ile, vazgeçilince `null` ile çözülür. "N satır alındı" bildirimi
  uygulamanındır (Vue'daki toast).
- Alan listesi ızgaranın görünen, değerle yazılan sütunlarıdır (pencere türü ve accessor'lı sütun yok): gizli sütuna
  dosyadan yazılmaz, böylece gönderilmeyen alan sessizce değişmez (§5).
- `.xlsx`'te sayı hücresi ham metniyle okunur: ondalık kayan noktaya girmez, kod sütunundaki 12345 "12345.0" olmaz.
- Dosyadaki değer olduğu gibi alınır, ölçeklenmez: yüzde sütununda 20 = %20, Excel'in yüzde biçimli hücresindeki 0,2
  = %0,2 (karar 2026-11-26; dönüştürme seçeneği denendi, kaldırıldı). İlk değer sütunu çevrilmiş hâli gösterir.
- Listedeki satırda değeri zaten aynı olan hücre yazılmaz; özet ve sonuç gerçek değişikliği sayar (dışa aktarıp geri
  almak 0 satır günceller).
- Dosyada ikinci kez gelen, listede olan anahtar yeni satır olur ve tabloda tekrar hatası alır; "listede olmayan"
  sayılmaz ve "eklensin" kutusuna bağlı değildir.

- Okuyucu: `.xlsx` için `read-excel-file` (yeni bağımlılık; yazıcı `write-excel-file` zaten var), `.csv` paketin
  ayrıştırıcısı. Başlık satırı tespiti ve sütun eşleme ayrı saf fonksiyonlardır, ayrı test edilir.
- **`ajax` sütunu `remote.match` ile çözülür** (Vue'da yok). Dosyadaki kod ya da ad 100'erlik parçalarla seçeneğe
  çevrilir, seçenek sütunun `onChange`'ine gider (yapıştırmayla aynı yol, FormGrid F3). Bulunamayan metin hücrede
  "seçenek değil" hatası olur. `match` yoksa metin olduğu gibi değer olur.
- Eşleme anahtar sütunuyla yapılır. Listede olan anahtar o satırı günceller; olmayan, "eklensin" kutusu açıksa yeni
  satır olur. Boş anahtarlı dosya satırı her zaman yeni satırdır (§3); özet sayısını ayrıca söyler.
- Excel'deki boş hücre mevcut değeri silmez. İçe aktarma tek geri al adımıdır.

**Dışa aktarma:** liste tablosunun yazıcısı (`core/export`), taslak değerlerle ve listenin bütün satırlarıyla. Seçim
sütundadır: "Görünen sütunlar" (varsayılan) / "Tüm sütunlar" (`columns: 'all'`, gizliler dahil). Satır seçimi kaldırıldı
(2026-11-26): görünüm sekmesi geçicidir, dosya listenin tamamını taşımalı. Menüyü uygulama çizer.
Seçenek sayfası (Vue 07 §13) dosyanın Excel'de düzenlenip geri alınmasını sağlar.

## 7. Klavye

FormGrid §8 geçerlidir. Ekler: ⌘S kaydeder (FormGrid'de yok: orada formun işi), ⌘⌫ listeden çıkarır.

## 8. Boyut

Hedef 10.000 satır × 30 sütun (Vue 07 §1). Bütçeler FormGrid'inkiyle aynı: ok tuşu < 16 ms, hücre onayı < 50 ms,
ilk çizim < 300 ms. Bugün hücre onayı bütün satırların sorunlarını yeniden hesaplıyor (`core/sheet/issues.ts`,
1000 satırda ~32 ms). DataSheet sorunları satır nesnesine bağlı önbellekle tutar: yalnız değişen satır yeniden
doğrulanır (`validate`'in `rows` bağlamı o satırın son değiştiği andaki listedir). Ölçüm
`e2e/data-sheet-perf.spec.ts`; 2026-11-26, 10.000 satır × 9 sütun, sistem Chrome'u: ok tuşu ortanca 0,3 ms, hücre
onayı ortanca 15,8 ms. Bütçe tutmazsa `maxRows` varsayılanı ölçülen değere iner.

## 9. Swors'un kullanımı (paketin dışı, sözleşmeyi sınamak için)

Backend `MassSaveAction`: istek `{ if_exists, if_not_exists, rows: [{ uuid, query }] }`, en çok 100 satır; cevap satır
başına `{ uuid, data, created }` ya da `{ uuid, problem }`. Swors'ta bir `useMassSave` adapter'ı:

- `onSave` önce kayıt seçeneklerini sorar: "Varsa güncelle" (`if_exists`) ve "Yoksa oluştur" (`if_not_exists`), iki
  ayrı seçenek (karar, 2026-11-26). Kaynağa göre ek işaretler de burada sorulur (`if_update_balance`,
  `if_update_qty`). Pencere sayıları `isNew` ile yazar: "48 yüklenen satır, 3 eklenen satır".
- Satırları 100'erli, sırayla gönderir; `query` = `values` + gerekiyorsa `row`'dan alanlar.
- Cevabı çevirir: `data` → `row` (Resource'un biçimi satırınkinden farklıysa kaynağın kendi eşlemesiyle),
  `created` → `status`, `problem.errors` → `fieldErrors`, `problem.detail` → `rowError`.
- İlişki sütunları (`category_id`, `group_id` …) `ajax` + `remote.match`'tir; kaynağı entity'nin feature'ındaki
  `SourcePicker` kaynağıdır.
- Backend'in zorunlu alanları (`ProductMassRowRequest` vb.) DataSheet'te `required` sütundur: gizlenemedikleri için
  değişen her satırda giderler, güncelleme doğrulamadan geçer.

## 10. Kapsam dışı

Formül çubuğu, başlıktan sıralama ve filtre çipleri (§2, §4), yatay doldurma (FormGrid'deki gibi), ⌘-tık
ile çoklu aralık, telefonda düzenleme, paketin HTTP / parça / yeniden deneme bilmesi.

## 11. Uygulama sırası

| Faz | Kapsam |
|---|---|
| DS1 | `useDataSheet` + `DataSheet`: taban ve taslak, değişti işareti, anahtar sütunu (§3), listeden çıkarma, Tümü / Değişenler / Hatalılar, `onSave` / `applyResult`, ilerleme sayacı, Vazgeç onayı, ⌘S, `isDirty`, sütun görünürlüğü, telefonda salt okunur, araç çubuğu için durum ve komutlar; artımlı sorun hesabı ve 10.000 × 30 ölçümü |
| DS2 | İçe aktarma penceresi (başlık tespiti, sütun eşleme, `importAliases`, `remote.match`), dışa aktarma menüsü |

Her faz playground'da senaryo sayfası ve `pnpm check` ile biter. Swors'ta ilk ekran Ürün'dür.
