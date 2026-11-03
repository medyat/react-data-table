// api-draft.ts §9. Anahtar listesi ve EN/TR metinleri: docs/data-table/09-i18n.md.
/** Parametreli metinler fonksiyon olabilir. */
export type MessageValue = string | ((params: Record<string, string | number>) => string)
export type Messages = Record<string, MessageValue>
