// @vitest-environment node
// FormGrid A adımı: hücre girişinin çözümlenmesi (Vue tests/sheet-store.test.ts · parseInput'tan taşındı).
import { describe, expect, it } from 'vitest'
import { dateMask, fillMask, inputText, maskText, parseDateInput, parseInput } from '../src/core/sheet/parse'
import type { ColumnDef } from '../src/types'

const env = { locale: 'en', today: new Date(2026, 9, 21), todayWord: 'Today', yesWord: 'Yes', noWord: 'No' }
const tr = { ...env, locale: 'tr', todayWord: 'Bugün', yesWord: 'Evet', noWord: 'Hayır' }
const price: ColumnDef = { id: 'price', header: 'Price', type: 'currency', currency: 'USD' }
const unit: ColumnDef = {
  id: 'unit',
  header: 'Unit',
  type: 'select',
  options: [
    { value: 'pcs', label: 'Pieces' },
    { value: 'i', label: 'İthal' },
  ],
}

describe('parseInput', () => {
  it('sayılar yerel ayara göre; yüzde; boş → null; çözülemeyen ham metin', () => {
    expect(parseInput(price, '2240', env)).toBe('2240')
    expect(parseInput(price, '2.240,00', env)).toBe('2240')
    expect(parseInput(price, '2,240.00', env)).toBe('2240')
    expect(parseInput(price, '2,5', tr)).toBe('2.5')
    expect(parseInput(price, '2.5', env)).toBe('2.5')
    // Ondalık float'tan geçmez: 0,1 + gösterim hatası yok, uzun değer hane kaybetmez; int sayı kalır.
    expect(parseInput(price, '0,1', tr)).toBe('0.1')
    expect(parseInput(price, '12345678901234567,89', tr)).toBe('12345678901234567.89')
    expect(parseInput({ id: 'n', header: 'N', type: 'int' }, '1.234', tr)).toBe(1234)
    expect(parseInput(price, '  ', env)).toBeNull()
    expect(parseInput(price, 'abc', env)).toBe('abc')
    expect(parseInput(price, '=1+1', env)).toBe('=1+1')
    const pct: ColumnDef = { id: 'vat', header: 'VAT', type: 'percentage' }
    expect(parseInput(pct, '%20', tr)).toBe('20')
    expect(parseInput(pct, '20%', env)).toBe('20')
  })
  it('tarihler: "24.10", "24.10.2026", "+7d", "today"/"bugün", ISO; geçersiz gün ham kalır', () => {
    expect(parseDateInput('24.10', env)).toBe('2026-10-24')
    expect(parseDateInput('24/10/2025', tr)).toBe('2025-10-24')
    expect(parseDateInput('24.10.25', env)).toBe('2025-10-24')
    expect(parseDateInput('+7d', env)).toBe('2026-10-28')
    expect(parseDateInput('-1d', env)).toBe('2026-10-20')
    expect(parseDateInput('today', tr)).toBe('2026-10-21')
    expect(parseDateInput('Bugün', tr)).toBe('2026-10-21')
    expect(parseDateInput('2026-02-03T10:00', env)).toBe('2026-02-03')
    expect(parseDateInput('31.02', env)).toBeNull()
    expect(parseInput({ id: 'd', header: 'D', type: 'date' }, '31.02', env)).toBe('31.02')
  })
  it('seçenek etiketle ya da değerle, büyük/küçük harf ve İ/ı duyarsız; eşleşmeyen ham kalır', () => {
    expect(parseInput(unit, 'pieces', env)).toBe('pcs')
    expect(parseInput(unit, 'pcs', env)).toBe('pcs')
    expect(parseInput(unit, 'ithal', tr)).toBe('i')
    expect(parseInput(unit, 'Adt', env)).toBe('Adt')
  })
  it('boolean her dilde true/1/yes ve kendi dilinin kelimesi', () => {
    const b: ColumnDef = { id: 'b', header: 'B', type: 'boolean' }
    expect(parseInput(b, 'evet', tr)).toBe(true)
    expect(parseInput(b, '0', tr)).toBe(false)
    expect(parseInput(b, 'belki', tr)).toBe('belki')
  })
  it('inputText: ham metin; seçenek etiketi; boş → ""', () => {
    expect(inputText(price, 2240)).toBe('2240')
    expect(inputText(unit, 'pcs')).toBe('Pieces')
    expect(inputText(unit, null)).toBe('')
  })
})

describe('datetime: an (ISO UTC), kullanıcı yerel gün ve saatle yazar', () => {
  const at: ColumnDef = { id: 'at', header: 'At', type: 'datetime' }
  const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString()
  it('yerel gün + saat → UTC; saat yoksa 00:00; gün yazımları date ile aynı', () => {
    expect(parseInput(at, '24.11.2026 14:30', tr)).toBe(local(2026, 11, 24, 14, 30))
    expect(parseInput(at, '2026-11-24 09:05', env)).toBe(local(2026, 11, 24, 9, 5))
    expect(parseInput(at, '24.11 14.30', tr)).toBe(local(2026, 11, 24, 14, 30))
    expect(parseInput(at, '24.11.2026', tr)).toBe(local(2026, 11, 24))
    expect(parseInput(at, 'bugün 08:00', tr)).toBe(local(2026, 10, 21, 8))
  })
  it('bölgesi yazılı ISO (kendi kopyamız, sunucu) anı korur', () => {
    expect(parseInput(at, '2026-11-24T11:30:00.000Z', env)).toBe('2026-11-24T11:30:00.000Z')
    expect(parseInput(at, '2026-11-24T14:30:00+03:00', env)).toBe('2026-11-24T11:30:00.000Z')
  })
  it('geçersiz saat ya da gün ham metin kalır (tip hatası)', () => {
    expect(parseInput(at, '24.11.2026 25:00', tr)).toBe('24.11.2026 25:00')
    expect(parseInput(at, '31.02.2026 10:00', tr)).toBe('31.02.2026 10:00')
  })
  it('editör metni yerel gün ve saat; geri çözülünce aynı an', () => {
    const iso = local(2026, 11, 24, 14, 30)
    expect(inputText(at, iso)).toBe('2026-11-24 14:30')
    expect(parseInput(at, inputText(at, iso), env)).toBe(iso)
  })
})

describe('Excel ve kullanıcı yazımları (ISO kopya, dile göre okuma)', () => {
  const ru = { ...env, locale: 'ru', todayWord: 'Сегодня' }
  it('eğik çizgi ve tire dilin sırasıyla: en ay önde, tr ve ru gün önde; nokta her dilde gün önde', () => {
    expect(parseDateInput('11/24/2026', env)).toBe('2026-11-24')
    expect(parseDateInput('03/04/2026', env)).toBe('2026-03-04')
    expect(parseDateInput('03/04/2026', tr)).toBe('2026-04-03')
    expect(parseDateInput('24-11-2026', tr)).toBe('2026-11-24')
    expect(parseDateInput('24.11.2026', env)).toBe('2026-11-24')
    expect(parseDateInput('24.11.2026', ru)).toBe('2026-11-24')
    // Dilin sırasında geçersiz olan sessizce çevrilmez: hücre hata gösterir.
    expect(parseDateInput('24/11/2026', env)).toBeNull()
    expect(parseDateInput('11/24/2026', tr)).toBeNull()
  })
  it('ay adı: dilin kısa / uzun adı ve İngilizce; Excel d-mmm-yy', () => {
    expect(parseDateInput('24 Kas 2026', tr)).toBe('2026-11-24')
    expect(parseDateInput('24 Kasım 2026', tr)).toBe('2026-11-24')
    expect(parseDateInput('24-Kas-26', tr)).toBe('2026-11-24')
    expect(parseDateInput('Nov 24, 2026', env)).toBe('2026-11-24')
    expect(parseDateInput('24-Nov-26', tr)).toBe('2026-11-24')
    expect(parseDateInput('24 ноября 2026', ru)).toBe('2026-11-24')
    expect(parseDateInput('24 Şubat', tr)).toBe('2026-02-24')
  })
  it('date sütununa saatli metin: gün alınır', () => {
    expect(parseDateInput('24.11.2026 14:30', tr)).toBe('2026-11-24')
    expect(parseDateInput('11/24/2026 2:30 PM', env)).toBe('2026-11-24')
  })
  it('datetime: saniye ve 12 saat; Excel ABD biçimi', () => {
    const at: ColumnDef = { id: 'at', header: 'At', type: 'datetime' }
    const local = (h: number, m: number, s = 0) => new Date(2026, 10, 24, h, m, s).toISOString()
    expect(parseInput(at, '24.11.2026 14:30:15', tr)).toBe(local(14, 30, 15))
    expect(parseInput(at, '11/24/2026 2:30 PM', env)).toBe(local(14, 30))
    expect(parseInput(at, '11/24/26 12:05 am', env)).toBe(local(0, 5))
    expect(parseInput(at, '24 Kas 2026 09:00', tr)).toBe(local(9, 0))
    expect(parseInput(at, '24.11.2026 13:00 PM', tr)).toBe('24.11.2026 13:00 PM')
  })
})

describe('elle yazım maskesi (dilin sırası)', () => {
  it('kalıp Intl sırasından; tarih-saate saat eklenir', () => {
    expect(dateMask('tr-TR', 'date')).toBe('dd.MM.yyyy')
    expect(dateMask('ru', 'datetime')).toBe('dd.MM.yyyy HH:mm')
    expect(dateMask('en-US', 'datetime')).toBe('MM/dd/yyyy HH:mm')
  })
  it('yalnız rakam alınır, ayraç bir sonraki rakamla gelir (silerken engel olmaz), fazlası atılır', () => {
    const m = 'dd.MM.yyyy HH:mm'
    expect(maskText('2411', m)).toBe('24.11')
    expect(maskText('24', m)).toBe('24')
    expect(maskText('241120261430999', m)).toBe('24.11.2026 14:30')
    expect(maskText('24.11.2026 14:30', m)).toBe('24.11.2026 14:30')
    expect(maskText('asd', m)).toBe('')
  })
  it('değer maskenin biçiminde yazılır; geçersiz değer olduğu gibi', () => {
    expect(fillMask('dd.MM.yyyy', '2026-11-04')).toBe('04.11.2026')
    expect(fillMask('MM/dd/yyyy HH:mm', new Date(2026, 10, 24, 9, 5).toISOString())).toBe('11/24/2026 09:05')
    expect(fillMask('dd.MM.yyyy', 'asd')).toBe('asd')
  })
})

describe('iki haneli yıl', () => {
  it('bugünden en çok 20 yıl ileri, gerisi geçmiş yüzyıl (bugün 2026)', () => {
    expect(parseDateInput('08.06.97', env)).toBe('1997-06-08')
    expect(parseDateInput('08.06.46', env)).toBe('2046-06-08')
    expect(parseDateInput('08.06.47', env)).toBe('1947-06-08')
    expect(parseDateInput('08.06.00', env)).toBe('2000-06-08')
    expect(parseDateInput('08.06.05', { ...env, today: new Date(2090, 0, 1) })).toBe('2105-06-08')
  })
})
