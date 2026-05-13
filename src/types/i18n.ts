export type LangCode = 'en' | 'zh'

export type StringValue = string | ((...args: any[]) => string)

export interface StringTable {
  [key: string]: StringValue
}

export interface I18nStrings {
  [lang: string]: StringTable
}
