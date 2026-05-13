export interface Favorite {
  id: string
  url: string
  title: string
  addedAt: string
  slot: number
  customLogo?: string
  iconUrl?: string
}

export interface FavoriteFormData {
  url: string
  title: string
  customLogo?: string | null
}
