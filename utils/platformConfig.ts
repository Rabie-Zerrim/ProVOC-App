export type PlatformConfig = {
  displayName: string
  color: string
  faIcon: string | null
  categories: string[]          // official platform sub-categories (result screen)
  breakdownCategories: string[] // user-facing rating aspects (breakdown screen)
  minChars: number
  maxChars: number
  requiresTitle: boolean
  titleMaxChars: number
  ratingType: 'stars' | 'recommendation'
  hint: string
}

export const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  google: {
    displayName: 'Google',
    color: '#4285F4',
    faIcon: 'google',
    categories: [],
    breakdownCategories: ['Service', 'Staff'],
    minChars: 0,
    maxChars: 4000,
    requiresTitle: false,
    titleMaxChars: 0,
    ratingType: 'stars',
    hint: 'Overall rating only · Max 4 000 chars',
  },
  yelp: {
    displayName: 'Yelp',
    color: '#D32323',
    faIcon: 'yelp',
    categories: [],
    breakdownCategories: ['Service', 'Environment', 'Price'],
    minChars: 0,
    maxChars: 5000,
    requiresTitle: false,
    titleMaxChars: 0,
    ratingType: 'stars',
    hint: 'Overall rating only · Max 5 000 chars',
  },
  facebook: {
    displayName: 'Facebook',
    color: '#1877F2',
    faIcon: 'facebook',
    categories: [],
    breakdownCategories: ['Communication', 'Food', 'Price'],
    minChars: 25,
    maxChars: 63206,
    requiresTitle: false,
    titleMaxChars: 0,
    ratingType: 'recommendation',
    hint: 'Yes/No recommendation · Min 25 chars',
  },
  tripadvisor: {
    displayName: 'TripAdvisor',
    color: '#00AA6C',
    faIcon: null,
    categories: ['Food', 'Service', 'Value', 'Atmosphere'],
    breakdownCategories: ['Food', 'Service', 'Value', 'Atmosphere'],
    minChars: 100,
    maxChars: 10000,
    requiresTitle: true,
    titleMaxChars: 120,
    ratingType: 'stars',
    hint: 'Title required · Min 100 chars',
  },
  trustpilot: {
    displayName: 'Trustpilot',
    color: '#00B67A',
    faIcon: null,
    categories: [],
    breakdownCategories: ['Quality', 'Support', 'Value'],
    minChars: 20,
    maxChars: 10000,
    requiresTitle: true,
    titleMaxChars: 100,
    ratingType: 'stars',
    hint: 'Title required · Min 20 chars',
  },
}

export function getPlatformConfig(slugOrName: string): PlatformConfig | null {
  const key = slugOrName.toLowerCase().replace(/\s/g, '')
  // direct slug match
  if (PLATFORM_CONFIG[key]) return PLATFORM_CONFIG[key]
  // name match (e.g. "TripAdvisor" → "tripadvisor")
  for (const [k, v] of Object.entries(PLATFORM_CONFIG)) {
    if (v.displayName.toLowerCase() === slugOrName.toLowerCase()) return v
    if (k === key) return v
  }
  return null
}
