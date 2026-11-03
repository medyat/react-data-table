# @medyat/react-data-table

React 19 için liste tablosu. Davranış ve tasarım `@medyat/vue-data-table` ile aynı sözleşmeye dayanır;
React'e özgü kararlar `docs/react-kararlar.md`'de.

> Durum: Faz 0 (kurulum, token'lar, i18n, sağlayıcı). Bileşen henüz yok.

## Kurulum

```tsx
import { DataTableProvider, createLocalStorageViews } from '@medyat/react-data-table'
import '@medyat/react-data-table/style.css'
import '@medyat/react-data-table/shadcn-bridge.css' // shadcn teması kullanılıyorsa, style.css'ten sonra

;<DataTableProvider locale="tr" viewsAdapter={createLocalStorageViews({ scope: tenantId })}>
  <App />
</DataTableProvider>
```

## Stil

Tüm CSS `@layer medyat-dt` içindedir. Tailwind v4'te katmanı `utilities`'den önce bildirin; uygulamanın
sınıfları paketi ezsin:

```css
@layer theme, base, medyat-dt, components, utilities;
```

Tema `.dark` sınıfı ya da `data-theme="dark"` ile, yoğunluk bileşen kökündeki `data-density` ile değişir.
