import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import api from '../services/api'
import { getBizPhoto } from '../utils/bizPhoto'

const HISTORY_KEY = '@provoc_search_history'
const MAX_HISTORY = 6
const NEARBY_RADIUS = 8000

type SearchResult = {
  id: string
  name: string
  formattedAddress: string
  globalRating: number
  reviewCount: number | { native?: { total?: number } }
  url: string
  photo_reference?: string
}

type ResultItem = {
  network: string   // 'google' | 'yelp' | 'osm'
  data: SearchResult
  bizType?: string  // amenity type for photo lookup
}

type HistoryItem = {
  id: string
  name: string
  address: string
  rating: number
  category: string
}

type ActiveNetwork = { network_id: string; name: string; slug: string; post_auth_type: string | null }

const FALLBACK_SLUGS = ['google', 'yelp', 'tripadvisor', 'facebook', 'trustpilot']

const CATEGORIES = [
  { label: 'Food', emoji: '🍔', amenities: ['restaurant', 'fast_food', 'food_court'] },
  { label: 'Coffee', emoji: '☕', amenities: ['cafe', 'bar'] },
  { label: 'Fitness', emoji: '🏋️', amenities: ['gym', 'sports_centre'] },
  { label: 'Fun', emoji: '🎭', amenities: ['cinema', 'theatre'] },
  { label: 'Shopping', emoji: '🛍️', amenities: ['mall', 'marketplace'] },
  { label: 'Health', emoji: '🏥', amenities: ['pharmacy', 'clinic', 'hospital'] },
]

type SearchResultItemProps = {
  item: ResultItem
  activeCategory: string | null
  onPress: () => void
}

function SearchResultItem({ item, activeCategory, onPress }: SearchResultItemProps) {
  const name = typeof item.data.name === 'string' ? item.data.name : ''
  const addr = typeof item.data.formattedAddress === 'string' ? item.data.formattedAddress : ''
  const rating = typeof item.data.globalRating === 'number' && item.data.globalRating > 0 ? item.data.globalRating : null
  const isOSM = item.network === 'osm'

  const rc: any = item.data.reviewCount
  let count: number | null = null
  if (typeof rc === 'number' && rc > 0) {
    count = rc
  } else if (rc && typeof rc === 'object') {
    const nat = rc.native
    if (typeof nat === 'number') count = nat
    else if (nat && typeof nat === 'object' && typeof nat.total === 'number') count = nat.total
  }

  const placePhotoUrl = item.data.photo_reference
    ? `https://places.googleapis.com/v1/${item.data.photo_reference}/media?maxWidthPx=400&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
    : null
  const fallbackUri = getBizPhoto(item.bizType ?? (activeCategory?.toLowerCase() ?? ''), name || item.data.id)
  const photoUri = placePhotoUrl ?? fallbackUri

  return (
    <TouchableOpacity style={styles.resultItem} onPress={onPress}>
      <Image source={{ uri: photoUri }} style={styles.resultThumb} />
      <View style={styles.resultInfo}>
        <View style={styles.resultNameRow}>
          <Text style={styles.resultName} numberOfLines={1}>{name}</Text>
          <View style={[styles.networkChip, isOSM && styles.networkChipOSM]}>
            <Text style={styles.networkChipText}>{isOSM ? 'nearby' : item.network}</Text>
          </View>
        </View>
        <Text style={styles.resultAddress} numberOfLines={1}>{addr}</Text>
        <View style={styles.ratingRow}>
          {rating != null ? (
            <>
              <Ionicons name="star" size={12} color="#FFB800" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              {count != null ? <Text style={styles.reviewCount}>({count} reviews)</Text> : null}
            </>
          ) : (
            <Text style={styles.ratingText}>—</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function SearchScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [address, setAddress] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [usingGPS, setUsingGPS] = useState(false)
  const [locating, setLocating] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [nearbyAddress, setNearbyAddress] = useState('')
  const [usingOSM, setUsingOSM] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeNetworkSlugsRef = useRef<string[]>(FALLBACK_SLUGS)

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) setHistory(JSON.parse(raw))
    })
    detectLocation()
    api.get('/networks').then(({ data }: { data: ActiveNetwork[] }) => {
      if (Array.isArray(data) && data.length > 0) {
        activeNetworkSlugsRef.current = data.map((n) => n.slug)
      }
    }).catch(() => {})
  }, [])

  const detectLocation = async () => {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      if (place) {
        const parts = [
          place.street ? `${place.streetNumber ?? ''} ${place.street}`.trim() : null,
          place.district ?? place.subregion ?? null,
          place.city ?? place.region ?? null,
          place.country ?? null,
        ].filter(Boolean) as string[]
        const locationStr = parts.join(', ')
        if (locationStr) {
          setAddress(locationStr)
          setUsingGPS(true)
          setNearbyAddress(locationStr)
        }
      }
    } catch {
      // silently skip
    } finally {
      setLocating(false)
    }
  }

  const searchNearby = useCallback(async (amenities: string[]) => {
    if (!coords) return
    setLoading(true)
    setSearchError('')
    setResults([])
    setUsingOSM(true)
    try {
      const params = new URLSearchParams({
        lat: coords.lat.toString(),
        lon: coords.lon.toString(),
        amenities: amenities.join(','),
      })
      const { data: json } = await api.get(`/listings/nearby?${params.toString()}`)
      const items: ResultItem[] = (json.items ?? []).map((el: any) => ({
        network: 'osm',
        bizType: el.type ?? '',
        data: {
          id: String(el.id),
          name: el.name ?? '',
          formattedAddress: el.address || nearbyAddress,
          globalRating: 0,
          reviewCount: 0,
          url: '',
        },
      }))
      setResults(items)
      if (items.length === 0) setSearchError('No businesses found nearby.')
    } catch {
      setSearchError('Could not load nearby businesses. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [coords, nearbyAddress])

  const saveToHistory = async (item: ResultItem, listingId: string) => {
    const rawRating: any = item.data.globalRating
    const rating = typeof rawRating === 'number' ? rawRating : 0
    const entry: HistoryItem = {
      id: listingId,
      name: typeof item.data.name === 'string' ? item.data.name : '',
      address: typeof item.data.formattedAddress === 'string' ? item.data.formattedAddress : '',
      rating,
      category: activeCategory ?? 'Business',
    }
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.name !== entry.name)
      const next = [entry, ...filtered].slice(0, MAX_HISTORY)
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    setSearchError('')
    setUsingOSM(false)
    try {
      const searchParams: Record<string, string> = { q }
      if (coords?.lat != null) {
        searchParams.lat = String(coords.lat)
        searchParams.lng = String(coords.lon)
      } else {
        // Default to Tunis centre if GPS unavailable or not yet resolved
        searchParams.lat = '36.8065'
        searchParams.lng = '10.1815'
      }
      const { data } = await api.get('/listings/search', { params: searchParams })
      const networkData = data?.data ?? data
      const items: ResultItem[] = []
      for (const network of Object.keys(networkData)) {
        const entry = networkData[network]
        if (entry && typeof entry === 'object' && entry.id) {
          items.push({ network, data: { ...entry, photo_reference: entry.photo_reference ?? undefined } })
        }
      }
      setResults(items)
      if (items.length === 0) setSearchError('No businesses found. Try a more specific search term.')
    } catch (err: any) {
      console.log('Search error status:', err?.response?.status)
      console.log('Search error body:', JSON.stringify(err?.response?.data))
      const msg = err?.response?.data?.message
        ? (Array.isArray(err.response.data.message) ? err.response.data.message[0] : err.response.data.message)
        : err?.message ?? 'Search failed.'
      setSearchError(msg)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [coords])

  useEffect(() => {
    if (usingOSM) return  // don't trigger Zembra search when showing OSM results
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch, usingOSM])

  // Save additional platform listings for a business already saved under one platform.
  // Returns the network_ids of all listings for this business after saving.
  const saveAllPlatforms = async (
    name: string, address: string,
    primarySlug: string, businessId: string,
  ): Promise<string[]> => {
    const otherSlugs = activeNetworkSlugsRef.current.filter((s) => s !== primarySlug)
    const qs = new URLSearchParams({ name, address })
    otherSlugs.forEach((s) => qs.append('networks[]', s))
    try {
      const { data: zData } = await api.get(`/listings/search?${qs.toString()}`)
      const nd: Record<string, any> = zData?.data ?? zData
      await Promise.allSettled(
        Object.entries(nd)
          .filter(([, e]) => e?.id)
          .map(([slug, e]) =>
            api.post('/listings', {
              external_listing_id: e.id,
              external_url: e.url ?? '',
              name: e.name ?? name,
              address: e.formattedAddress ?? address,
              external_rating: e.globalRating ?? 0,
              network: slug,
              business_id: businessId,
            }),
          ),
      )
    } catch {}
    // Re-fetch the listing to get the full updated networks list
    return []
  }

  const handleSelect = async (item: ResultItem) => {
    if (saving) return
    setSaving(true)
    try {
      let listingId: string | undefined

      if (item.network === 'osm') {
        // Try Zembra match for all platforms using the OSM business name + address
        let zembraRating = 0
        let zembraAddress = item.data.formattedAddress
        let primarySlug = 'google'
        try {
          const qs = new URLSearchParams({ name: item.data.name, address: item.data.formattedAddress })
          activeNetworkSlugsRef.current.forEach((s) => qs.append('networks[]', s))
          const { data: zData } = await api.get(`/listings/search?${qs.toString()}`)
          const nd: Record<string, any> = zData?.data ?? zData
          // Pick first found platform as primary
          const primaryEntry = Object.entries(nd).find(([, e]) => e?.id)
          if (primaryEntry) {
            const [slug, entry] = primaryEntry
            primarySlug = slug
            const { data } = await api.post('/listings', {
              external_listing_id: entry.id,
              external_url: entry.url ?? '',
              name: entry.name ?? item.data.name,
              address: entry.formattedAddress ?? item.data.formattedAddress,
              external_rating: entry.globalRating ?? 0,
              network: slug,
            })
            listingId = data.listing_id ?? data.id
            zembraRating = entry.globalRating ?? 0
            zembraAddress = entry.formattedAddress ?? item.data.formattedAddress
            // Save remaining platforms under the same business
            const businessId = data.business?.business_id ?? data.business_id
            if (businessId) {
              await Promise.allSettled(
                Object.entries(nd)
                  .filter(([s, e]) => s !== slug && e?.id)
                  .map(([s, e]) =>
                    api.post('/listings', {
                      external_listing_id: e.id,
                      external_url: e.url ?? '',
                      name: e.name ?? item.data.name,
                      address: e.formattedAddress ?? item.data.formattedAddress,
                      external_rating: e.globalRating ?? 0,
                      network: s,
                      business_id: businessId,
                    }),
                  ),
              )
            }
          }
        } catch {}

        // Fall back to saving raw OSM data if Zembra had no match
        if (!listingId) {
          const { data } = await api.post('/listings', {
            external_listing_id: `osm-${item.data.id}`,
            external_url: '',
            name: item.data.name,
            address: item.data.formattedAddress,
            external_rating: 0,
            network: 'google',
          })
          listingId = data.listing_id ?? data.id
        }

        // Fetch real network_ids from the saved listing (includes all platforms saved above)
        let networkIds: string[] = []
        try {
          const { data: lData } = await api.get(`/listings/${listingId}`)
          const nets = lData.networks ?? lData.listing?.networks ?? []
          networkIds = nets.map((n: any) => n.network_id ?? n.id).filter(Boolean)
        } catch {}

        const enriched: ResultItem = { ...item, data: { ...item.data, globalRating: zembraRating, formattedAddress: zembraAddress } }
        await saveToHistory(enriched, listingId!)
        router.push({
          pathname: '/review/networks',
          params: {
            listing_id: listingId!,
            business_name: item.data.name,
            address: zembraAddress,
            rating: zembraRating > 0 ? zembraRating.toString() : '0',
            business_type: activeCategory ?? 'Business',
            ...(networkIds.length > 0 ? { network_ids: JSON.stringify(networkIds) } : {}),
          },
        })
      } else {
        // Zembra result — save primary platform then look for others
        const { data } = await api.post('/listings', {
          external_listing_id: item.data.id,
          external_url: item.data.url,
          name: item.data.name,
          address: item.data.formattedAddress,
          external_rating: item.data.globalRating,
          network: item.network,
        })
        listingId = data.listing_id ?? data.id
        const businessId = data.business?.business_id ?? data.business_id
        if (businessId) {
          await saveAllPlatforms(item.data.name, item.data.formattedAddress, item.network, businessId)
        }

        // Fetch real network_ids (includes all platforms saved above)
        let networkIds: string[] = []
        try {
          const { data: lData } = await api.get(`/listings/${listingId}`)
          const nets = lData.networks ?? lData.listing?.networks ?? []
          networkIds = nets.map((n: any) => n.network_id ?? n.id).filter(Boolean)
        } catch {}

        await saveToHistory(item, listingId!)
        router.push({
          pathname: '/review/networks',
          params: {
            listing_id: listingId!,
            business_name: item.data.name,
            address: item.data.formattedAddress ?? '',
            rating: item.data.globalRating?.toString() ?? '',
            business_type: activeCategory ?? 'Restaurant',
            ...(networkIds.length > 0 ? { network_ids: JSON.stringify(networkIds) } : {}),
          },
        })
      }
    } catch (err: any) {
      const existingId = err?.response?.data?.listing_id ?? err?.response?.data?.id
      if (existingId) {
        await saveToHistory(item, existingId)
        router.push({
          pathname: '/review/networks',
          params: {
            listing_id: existingId,
            business_name: item.data.name,
            address: item.data.formattedAddress ?? '',
            rating: '0',
            business_type: activeCategory ?? 'Business',
          },
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleHistorySelect = (h: HistoryItem) => {
    router.push({
      pathname: '/review/networks',
      params: {
        listing_id: h.id,
        business_name: h.name,
        address: h.address,
        rating: h.rating.toString(),
        business_type: h.category,
      },
    })
  }

  const renderResult = ({ item }: { item: ResultItem }) => (
    <SearchResultItem
      item={item}
      activeCategory={activeCategory}
      onPress={() => handleSelect(item)}
    />
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.searchBarWrapper}>
          <Ionicons name="search-outline" size={18} color="#8B9099" />
          <TextInput
            style={styles.searchInput}
            placeholder="Business name..."
            placeholderTextColor="#8B9099"
            value={query}
            onChangeText={(t) => { setQuery(t); setUsingOSM(false) }}
            autoFocus
            returnKeyType="next"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setUsingOSM(false) }}>
              <Ionicons name="close-circle" size={18} color="#8B9099" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.addressRow}>
        {locating ? (
          <ActivityIndicator size="small" color="#2D6A4F" style={{ marginRight: 8 }} />
        ) : (
          <Ionicons
            name={usingGPS ? 'location' : 'location-outline'}
            size={16}
            color={usingGPS ? '#2D6A4F' : '#8B9099'}
            style={{ marginRight: 8 }}
          />
        )}
        <TextInput
          style={styles.addressInput}
          placeholder="Street, City, Country"
          placeholderTextColor="#8B9099"
          value={address}
          onChangeText={(t) => { setAddress(t); setUsingGPS(false); setUsingOSM(false) }}
          returnKeyType="search"
        />
        {usingGPS && (
          <View style={styles.gpsBadge}>
            <Text style={styles.gpsBadgeText}>GPS</Text>
          </View>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.label}
            style={[styles.chip, activeCategory === cat.label && styles.chipActive]}
            onPress={() => {
              const next = activeCategory === cat.label ? null : cat.label
              setActiveCategory(next)
              if (next) {
                if (coords) {
                  // GPS available → query Overpass for nearby businesses
                  searchNearby(cat.amenities)
                } else {
                  // No GPS → pre-fill search bar so user can type manually
                  setQuery(cat.amenities[0])
                  setUsingOSM(false)
                }
              } else {
                setQuery('')
                setResults([])
                setSearchError('')
                setUsingOSM(false)
              }
            }}
          >
            <Text style={styles.chipText}>{cat.emoji} {cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#2D6A4F" />
          <Text style={styles.savingText}>Saving business...</Text>
        </View>
      )}

      {searchError ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={[styles.emptyText, { color: '#EF4444' }]}>{searchError}</Text>
        </View>
      ) : loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#2D6A4F" size="large" />
        </View>
      ) : results.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>
            {usingOSM ? `Nearby ${activeCategory ?? 'businesses'}` : 'Results'}
          </Text>
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.network}-${item.data.id}`}
            renderItem={renderResult}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : query.length > 0 && !loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color="#3A3F4B" />
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      ) : (
        <View style={styles.promptState}>
          <Text style={styles.sectionLabel}>Last searching</Text>
          {history.length > 0 ? (
            <FlatList
              data={history}
              keyExtractor={(h) => h.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: h }) => (
                <TouchableOpacity style={styles.historyItem} onPress={() => handleHistorySelect(h)}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="time-outline" size={18} color="#8B9099" />
                  </View>
                  <View style={styles.historyInfo}>
                    <View style={styles.historyNameRow}>
                      <Text style={styles.historyName} numberOfLines={1}>{h.name}</Text>
                      <View style={styles.categoryChip}>
                        <Text style={styles.categoryChipText}>{h.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyAddress} numberOfLines={1}>{h.address}</Text>
                    {h.rating > 0 && (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color="#FFB800" />
                        <Text style={styles.ratingText}>{h.rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="arrow-forward-outline" size={16} color="#8B9099" />
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="#3A3F4B" />
              <Text style={styles.emptyText}>
                {coords ? 'Tap a category above to find nearby businesses' : 'Search for a business to get started'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14, gap: 10 },
  backBtn: { padding: 4 },
  searchBarWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1F2E', borderRadius: 12, paddingHorizontal: 12, height: 46, gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2E',
    borderRadius: 10, paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 14, height: 40,
  },
  addressInput: { flex: 1, color: '#fff', fontSize: 13 },
  gpsBadge: { backgroundColor: '#1B4332', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  gpsBadgeText: { color: '#2D6A4F', fontSize: 10, fontWeight: '700' },
  chipsScroll: { marginBottom: 12, flexGrow: 0, flexShrink: 0 },
  chipsContent: { paddingHorizontal: 16, gap: 6, alignItems: 'center' },
  chip: {
    backgroundColor: '#1E2435', borderRadius: 16, paddingHorizontal: 10,
    paddingVertical: 6, borderWidth: 1, borderColor: '#2A3045',
    alignSelf: 'flex-start',
  },
  chipActive: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  sectionLabel: {
    color: '#8B9099', fontSize: 12, fontWeight: '600', paddingHorizontal: 20,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1F2E',
  },
  resultThumb: {
    width: 52, height: 52, borderRadius: 10, marginRight: 12, marginTop: 2, backgroundColor: '#1A1F2E',
  },
  resultInfo: { flex: 1 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  resultName: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  networkChip: {
    backgroundColor: '#1E2435', borderRadius: 8, paddingHorizontal: 7,
    paddingVertical: 2, borderWidth: 1, borderColor: '#2A3045',
  },
  networkChipOSM: { backgroundColor: '#1B3045', borderColor: '#2D5A6F' },
  networkChipText: { color: '#8B9099', fontSize: 10, textTransform: 'capitalize' },
  resultAddress: { color: '#8B9099', fontSize: 12, marginBottom: 5 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reviewCount: { color: '#8B9099', fontSize: 11 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  savingOverlay: {
    backgroundColor: '#1A1F2E', margin: 20, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  savingText: { color: '#fff', fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#8B9099', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  promptState: { flex: 1 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1F2E', gap: 12,
  },
  historyIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1F2E',
    justifyContent: 'center', alignItems: 'center',
  },
  historyInfo: { flex: 1 },
  historyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  historyName: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  categoryChip: {
    backgroundColor: '#1E2435', borderRadius: 8, paddingHorizontal: 7,
    paddingVertical: 2, borderWidth: 1, borderColor: '#2A3045',
  },
  categoryChipText: { color: '#8B9099', fontSize: 10, textTransform: 'capitalize' },
  historyAddress: { color: '#8B9099', fontSize: 12, marginBottom: 4 },
})
