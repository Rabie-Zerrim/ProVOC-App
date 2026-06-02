const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? ''

/**
 * Uses Google Places API (v1) to resolve a ChIJ Place ID from a business name and optional address.
 * Returns null on any failure so callers can fall back gracefully.
 */
export async function resolveGooglePlaceId(
  businessName: string,
  address?: string,
): Promise<string | null> {
  if (!API_KEY || !businessName) return null
  try {
    const textQuery = [businessName, address].filter(Boolean).join(', ')
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({ textQuery }),
    })
    if (!res.ok) {
      console.log('Places API error:', res.status)
      return null
    }
    const json = await res.json()
    const id = json.places?.[0]?.id as string | undefined
    console.log('Places API resolved:', id ?? 'none')
    return id ?? null
  } catch (e) {
    console.log('Places API exception:', e)
    return null
  }
}
