# CLAUDE.md — React Data Table paketi

Bu repo `@medyat/react-data-table`'ı geliştirir: `@medyat/vue-data-table`'ın liste bileşeninin React 19
karşılığı. Yalnızca liste; sheet bu sürümde yok.

## Her işe başlamadan önce

1. Spesifikasyon Vue paketindedir, kardeş repo `../data-table`: `docs/data-table/README.md` (karar günlüğü
   D1–D47), `10-roadmap.md` (fazın kabul kriterleri), ilgili bileşen belgesi, `api-draft.ts`, tasarımlar
   `design/`, ölçüler `docs/handoff/`.
2. `docs/react-kararlar.md`: React'te farklı olan kararlar (R1–R22). Burada geçmeyen konuda Vue
   spesifikasyonu geçerlidir. Vue kodu referanstır, kaynak değil: React'te daha iyi bir yol varsa o
   yazılır ve kararı `react-kararlar.md`'ye eklenir.
3. Bir karar uygulamada sorun çıkarırsa değiştirmeden önce sor. Açık soru varsa tek soru sor.

## Kurallar

- Renk, ölçü, gölge, yarıçap için sabit değer yok: `--dt-*` token'ları. `tokens.css`, `core/i18n/en.ts`
  ve `tr.ts` üretilmiş dosyalardır; Vue'daki dokümanı değiştirip `pnpm gen:docs` çalıştır. `ru.ts` elle,
  anahtarları ve parametreleri `en.ts` ile birebir.
- Paket veri çekmez (D18), adres okumaz/yazmaz (D25). İstek `table.request`, sonuç `result` (R4).
- TanStack Table yalnızca `core/columns/use-column-layout.ts` ve `list/use-list-table.ts` içinde; public
  API'de TanStack tipi yok (ESLint, D23). `core/` `list/`'i import etmez.
- Paket React Compiler'dan geçerek derlenir. `useMemo`/`useCallback`/`memo` varsayılan değil; TanStack
  Table ya da Virtualizer örneğini değiştiren dosyalar `"use no memo"` taşır (R11).
- Spesifikasyonda olmayan ya da reddedilmiş özellik eklenmez (Vue `CLAUDE.md`'deki liste geçerli).
- Kullanıcıya görünen her metin i18n anahtarından gelir; erişilebilirlik spesifikasyonun parçasıdır (08).
- Dosyalar `kebab-case`, yorumlar Türkçe ve yalnızca nedeni anlatır.

## Komutlar

    pnpm dev        # playground (localhost:5175)
    pnpm check      # typecheck + lint + prettier + test + build
    pnpm gen:docs   # tokens.css ve en/tr metinleri Vue spesifikasyonundan

## Bitti tanımı (her faz)

- Fazın kabul kriterleri sağlandı ve testleri var; `pnpm check` temiz.
- Light/dark ve üç yoğunlukta tasarımla eşleşiyor (ölçerek, göz kararı değil); klavyeyle kullanılabiliyor.
- Playground'da senaryo sayfası var; `react-kararlar.md` güncel.

## Yayın

npm'e yalnızca GitHub Release yayınlar (`.github/workflows/publish.yml`, npm Trusted Publishing; token yok).

    npm version minor --tag-version-prefix="" -m "Sürüm %s"   # ya da patch; etiket `v`siz
    git push origin production --follow-tags
    # GitHub'da o etiketten Release açılır; etiket package.json sürümüyle aynı değilse Action durur.
