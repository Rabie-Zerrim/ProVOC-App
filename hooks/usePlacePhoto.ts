import { useState, useEffect } from 'react'

/**
 * Fetches a real Google Places photo URL for a given Place ID.
 * Only fires for valid ChIJ... Place IDs — returns null immediately for
 * OSM IDs, Yelp IDs, or anything that isn't a Google Place ID.
 */
export function usePlacePhoto(
  placeId: string | undefined | null,
  maxWidth: number = 400,
): string | null {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    setPhotoUrl(null)
    if (!placeId || !placeId.startsWith('ChIJ')) return
    const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
    if (!key) return

    fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${key}`,
    )
      .then((r) => r.json())
      .then((data) => {
        const ref: string | undefined = data?.result?.photos?.[0]?.photo_reference
        if (ref) {
          setPhotoUrl(
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${encodeURIComponent(ref)}&key=${key}`,
          )
        }
      })
      .catch(() => {})
  }, [placeId, maxWidth])

  return photoUrl
}
