import { useState, useEffect } from 'react'

export function usePlaceRating(placeId: string | undefined | null): number | null {
  const [rating, setRating] = useState<number | null>(null)

  useEffect(() => {
    if (!placeId || !placeId.startsWith('ChIJ')) return
    const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
    if (!key) return

    fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=rating&key=${key}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.rating === 'number') {
          setRating(data.rating)
        }
      })
      .catch(() => {})
  }, [placeId])

  return rating
}
