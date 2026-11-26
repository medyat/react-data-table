// Güçlü şifre (şifre sütununun `generate` aksiyonu). Karışan karakterler (0/O, 1/l/I) yok: şifre okunup yazdırılabilir.
const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?-_+=']
const ALL = SETS.join('')

const pick = (chars: string): string => {
  const [n] = crypto.getRandomValues(new Uint32Array(1))
  return chars[n! % chars.length]!
}

/** Her kümeden en az bir karakter, gerisi rastgele; sıra karıştırılır. */
export function generatePassword(length = 16): string {
  const chars = [...SETS.map(pick), ...Array.from({ length: length - SETS.length }, () => pick(ALL))]
  for (let i = chars.length - 1; i > 0; i--) {
    const [n] = crypto.getRandomValues(new Uint32Array(1))
    const j = n! % (i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}
