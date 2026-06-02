import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { Linking } from 'react-native'
import api from '../../services/api'
import { resolveGooglePlaceId } from '../../services/googlePlaces'
import { usePlacePhoto } from '../../hooks/usePlacePhoto'
import { getBizPhoto } from '../../utils/bizPhoto'
import { getPlatformConfig } from '../../utils/platformConfig'
import TodayCard from '../../components/TodayCard'

type Network = { network_id: string; name: string; slug: string; url?: string }
type Review = {
  review_id: string
  review_text: string
  rating: number
  listing_id?: string
  listing?: { listing_id?: string; name: string; external_rating?: number; external_url?: string; external_listing_id?: string; networks?: Network[] }
  business?: { name: string; business_type?: string; address?: string }
}

const SENTIMENT_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: 'Excellent', color: '#2D6A4F' },
  4: { label: 'Very good', color: '#40916C' },
  3: { label: 'Average', color: '#FFB800' },
  2: { label: 'Poor', color: '#EF4444' },
  1: { label: 'Terrible', color: '#EF4444' },
}

function PlatformIcon({ slug, size = 14 }: { slug: string; size?: number }) {
  const cfg = getPlatformConfig(slug)
  if (cfg?.faIcon) return <FontAwesome name={cfg.faIcon as any} size={size} color="#fff" />
  return <Ionicons name="globe-outline" size={size} color="#fff" />
}

export default function ResultScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    review_id: string; business_name: string; listing_id: string
    address: string; rating: string; business_type: string
    network_ids: string; breakdown: string; review_text: string
  }>()
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState<string | null>(null)
  const [editingText, setEditingText] = useState(false)
  const [editText, setEditText] = useState('')
  const [checkingHistory, setCheckingHistory] = useState(false)
  const [breakdown, setBreakdown] = useState<Record<string, Record<string, number>>>(() => {
    try { return params.breakdown ? JSON.parse(params.breakdown) : {} } catch { return {} }
  })
  const [editableRating, setEditableRating] = useState(Number(params.rating) || 4)
  const [testUrl, setTestUrl] = useState('https://www.google.com/maps?cid=355590781634030131')

  useEffect(() => {
    if (!params.review_id) { setLoading(false); return }
    api.get(`/reviews/${params.review_id}`)
      .then(({ data }) => {
        console.log('Review API response:', JSON.stringify(data))
        const reviewText = (params.review_text as string) || data.review_text || ''
        setReview({ ...data, review_text: reviewText })
        setEditText(reviewText)
        if (data.rating) setEditableRating(data.rating)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.review_id])

  const setSubRating = (platform: string, sub: string, val: number) =>
    setBreakdown((prev) => ({ ...prev, [platform]: { ...(prev[platform] ?? {}), [sub]: val } }))

  const handlePost = async (networkId: string, platformSlug: string, platformName: string) => {
    if (!review) return
    setPosting(networkId)
    try {
      const { data } = await api.get(`/reviews/${review.review_id}/publish-link?platform_id=${networkId}`)
      console.log('publish-link response:', JSON.stringify(data))
      const reviewText = data.review_text ?? review.review_text

      if (platformSlug === 'google') {
        // Copy silently as fallback, then open WebView to auto-fill & submit
        await Clipboard.setStringAsync(reviewText)
        const platformBreakdown = breakdown[platformName] ?? {}

        // Resolve Google review URL from multiple sources (publish-link often returns null)
        const listingNet = networks.find(n => n.network_id === networkId)
        let rawUrl = data.url || listingNet?.url || review.listing?.external_url || ''

        console.log('listing_id param:', params.listing_id)
        console.log('review.listing_id:', review.listing_id)
        console.log('networks:', JSON.stringify(networks))

        // Fetch the listing directly to get the saved external_url
        const listingId = params.listing_id || review.listing_id || review.listing?.listing_id
        if (!rawUrl && listingId) {
          try {
            const { data: listingData } = await api.get(`/listings/${listingId}`)
            console.log('Listing API response:', JSON.stringify(listingData))
            rawUrl = listingData.external_url ?? ''
          } catch (e) {
            console.log('Could not fetch listing:', e)
          }
        }

        // If external_listing_id is a real Google Place ID, build the write-review URL directly
        if (!rawUrl) {
          const extId = review.listing?.external_listing_id ?? ''
          const isGooglePlaceId = extId && !extId.startsWith('osm-') && !extId.startsWith('fb-') && !extId.startsWith('yelp-') && !extId.startsWith('ta-')
          if (isGooglePlaceId) {
            rawUrl = `https://search.google.com/local/writereview?placeid=${extId}`
            console.log('Built write-review URL from Place ID:', rawUrl)
          }
        }

        // If we still don't have a writereview URL with a ChIJ Place ID, try the Google Places API
        const needsPlaceId = !rawUrl.includes('writereview') || !rawUrl.includes('ChIJ')
        if (needsPlaceId) {
          const placeId = await resolveGooglePlaceId(businessName, bizAddress)
          if (placeId) {
            rawUrl = `https://search.google.com/local/writereview?placeid=${placeId}`
            console.log('Google Places API resolved Place ID:', placeId)
          }
        }

        // Absolute fallback: load Maps CID page and let WebView hook extract Place ID
        if (!rawUrl) {
          const q = encodeURIComponent(`${businessName} ${bizAddress}`.trim())
          rawUrl = `https://www.google.com/maps/search/?api=1&query=${q}`
          console.log('Using Google Maps search fallback — Places API returned nothing')
        }

        // Convert /local/reviews?placeid= → /local/writereview?placeid= to land on the write form
        const reviewUrl = rawUrl.replace(
          'search.google.com/local/reviews?',
          'search.google.com/local/writereview?',
        )
        console.log('Google WebView URL resolved to:', reviewUrl)

        router.push({
          pathname: '/review/webview-post',
          params: {
            review_url:        reviewUrl,
            review_text:       reviewText,
            rating:            String(Math.round(editableRating)),
            food_rating:       platformBreakdown['Food']       ? String(platformBreakdown['Food'])       : '',
            service_rating:    platformBreakdown['Service']    ? String(platformBreakdown['Service'])    : '',
            atmosphere_rating: platformBreakdown['Atmosphere'] ? String(platformBreakdown['Atmosphere']) : '',
            business_name:     businessName,
            review_id:         review.review_id,
          },
        })
      } else {
        await Clipboard.setStringAsync(reviewText)
        const url: string = data.url ?? ''
        if (url) {
          Alert.alert(
            'Review copied!',
            `Paste it when ${data.platform_name ?? platformName} opens.`,
            [{ text: 'Open app', onPress: () => Linking.openURL(url) }]
          )
        } else {
          const q = encodeURIComponent(`${businessName} ${bizAddress}`.trim())
          Alert.alert(
            'Review copied!',
            `Find the business on ${data.platform_name ?? platformName} and paste your review.`,
            [
              { text: 'Open Maps', onPress: () => Linking.openURL(`https://maps.google.com/?q=${q}`) },
              { text: 'Later', style: 'cancel' },
            ]
          )
        }
      }
    } catch (err: any) {
      await Clipboard.setStringAsync(review.review_text)
      Alert.alert(
        'Could not open platform',
        'Your review has been copied to clipboard. ' +
        'Please paste it manually when you open the app.',
      )
    } finally {
      setPosting(null)
    }
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#2D6A4F" size="large" />
    </View>
  )

  const networks = review?.listing?.networks ?? []
  const reviewRating = review?.rating ?? Number(params.rating) ?? 4
  const sentiment = SENTIMENT_LABELS[Math.round(editableRating)] ?? SENTIMENT_LABELS[4]
  const businessName = review?.business?.name ?? review?.listing?.name ?? params.business_name ?? 'Business'
  const bizType = review?.business?.business_type ?? params.business_type ?? ''

  const handleEnhanceTap = async () => {
    if (!params.review_id) {
      router.push({ pathname: '/review/enhance', params: { ...params, source: 'result' } })
      return
    }
    setCheckingHistory(true)
    try {
      const { data } = await api.get(`/reviews/${params.review_id}/chat/history`)
      if (Array.isArray(data) && data.length > 0) {
        router.push({
          pathname: '/review/chat',
          params: {
            ...params,
            review_id: params.review_id,
            listing_id: params.listing_id,
            business_name: businessName,
          },
        })
      } else {
        router.push({ pathname: '/review/enhance', params: { ...params, source: 'result' } })
      }
    } catch {
      router.push({ pathname: '/review/enhance', params: { ...params, source: 'result' } })
    } finally {
      setCheckingHistory(false)
    }
  }
  const bizAddress = review?.business?.address ?? params.address ?? ''
  const placePhotoUrl = usePlacePhoto(review?.listing?.external_listing_id)
  const bizPhoto = placePhotoUrl ?? getBizPhoto(bizType, params.listing_id ?? businessName)
  const externalRating = review?.listing?.external_rating != null ? Number(review.listing.external_rating) : null

  const saveEditedText = async () => {
    const trimmed = editText.trim()
    if (!trimmed || !review) { setEditingText(false); return }
    setReview({ ...review, review_text: trimmed })
    setEditingText(false)
    await api.patch(`/reviews/${review.review_id}`, { review_text: trimmed }).catch(() => {})
  }

  const renderPlatformCard = (
    networkId: string,
    slug: string,
    name: string,
    onPress: () => void,
    isPosting: boolean,
  ) => {
    const cfg = getPlatformConfig(slug) ?? getPlatformConfig(name)
    const subs = cfg?.categories ?? []
    const color = cfg?.color ?? '#2D6A4F'
    const platformRatings = breakdown[name] ?? {}
    const reviewLen = review?.review_text?.length ?? 0
    const maxChars = cfg?.maxChars ?? 0
    const minChars = cfg?.minChars ?? 0
    const charOk = minChars === 0 || reviewLen >= minChars
    const charOver = maxChars > 0 && reviewLen > maxChars
    const barPct = maxChars > 0 ? Math.min(reviewLen / maxChars, 1) : 0
    const firstSub = subs[0]

    return (
      <View key={networkId} style={styles.platformCard}>

        {/* ── Header row: green rating panel + right info ── */}
        <View style={styles.cardHeader}>
          {/* Left: green rating panel */}
          <View style={styles.ratingPanel}>
            <Text style={styles.ratingBigNum}>{editableRating.toFixed(1)}</Text>
            <View style={{ flexDirection: 'row' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={async () => {
                    setEditableRating(s)
                    await api.patch(`/reviews/${params.review_id}`, { rating: s })
                  }}
                >
                  <Ionicons
                    name={s <= editableRating ? 'star' : 'star-outline'}
                    size={24}
                    color="#FFB800"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: '#8B9099', fontSize: 11 }}>Tap to change rating</Text>
            {externalRating ? (
              <Text style={styles.ratingLabel}>{externalRating.toFixed(1)} avg</Text>
            ) : (
              <Text style={styles.ratingLabel}>Your review</Text>
            )}
          </View>

          {/* Right: sentiment + platform + first sub-category */}
          <View style={styles.ratingInfo}>
            <View style={[styles.sentimentBadge, { backgroundColor: sentiment.color + '28' }]}>
              <Text style={[styles.sentimentText, { color: sentiment.color }]}>{sentiment.label}</Text>
            </View>
            <View style={styles.platformRow}>
              <View style={[styles.platformIconBg, { backgroundColor: color }]}>
                <PlatformIcon slug={slug} size={13} />
              </View>
              <Text style={styles.platformName}>{name}</Text>
            </View>
            {firstSub ? (
              <Text style={styles.firstSubLabel}>{firstSub}</Text>
            ) : cfg?.hint ? (
              <Text style={styles.firstSubLabel}>{cfg.hint}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Sub-category breakdown rows ── */}
        {subs.length > 0 && (
          <View style={styles.breakdownSection}>
            {subs.map((sub) => (
              <View key={sub} style={styles.subRow}>
                <Text style={styles.subLabel}>{sub}</Text>
                <View style={styles.subStars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setSubRating(name, sub, s)} hitSlop={4}>
                      <Ionicons
                        name={s <= (platformRatings[sub] ?? 0) ? 'star' : 'star-outline'}
                        size={22}
                        color="#FFB800"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Character count bar ── */}
        {maxChars > 0 && (
          <View style={styles.charSection}>
            <View style={styles.charBar}>
              <View style={[
                styles.charFill,
                { width: `${barPct * 100}%` as any, backgroundColor: charOver ? '#EF4444' : charOk ? '#40916C' : '#FFB800' },
              ]} />
              {minChars > 0 && (
                <View style={[styles.charMinMark, { left: `${(minChars / maxChars) * 100}%` as any }]} />
              )}
            </View>
            <View style={styles.charLabelRow}>
              <Text style={[styles.charCount, charOver && { color: '#EF4444' }]}>
                {reviewLen.toLocaleString()} / {maxChars.toLocaleString()} chars
              </Text>
              {!charOk && <Text style={styles.charWarn}>Min {minChars} required</Text>}
              {charOver && <Text style={styles.charWarn}>{reviewLen - maxChars} over limit</Text>}
            </View>
          </View>
        )}

        {/* ── Requirements badges ── */}
        {(cfg?.requiresTitle || cfg?.ratingType === 'recommendation') && (
          <View style={styles.reqRow}>
            {cfg?.requiresTitle && (
              <View style={styles.reqBadge}>
                <Ionicons name="text-outline" size={11} color="#FFB800" />
                <Text style={styles.reqText}>Title required (max {cfg.titleMaxChars})</Text>
              </View>
            )}
            {cfg?.ratingType === 'recommendation' && (
              <View style={[styles.reqBadge, { backgroundColor: '#1877F222' }]}>
                <Ionicons name="thumbs-up-outline" size={11} color="#6BA3FF" />
                <Text style={[styles.reqText, { color: '#6BA3FF' }]}>Yes/No recommendation</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Tap to share ── */}
        <TouchableOpacity style={styles.shareRow} onPress={onPress} disabled={isPosting}>
          {isPosting ? (
            <ActivityIndicator color="#2D6A4F" />
          ) : (
            <>
              <Text style={styles.shareText}>Tap to share</Text>
              <Ionicons name="arrow-forward-circle-outline" size={20} color="#2D6A4F" />
            </>
          )}
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Review result</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        {/* Business header — TodayCard style */}
        <TodayCard
          businessName={businessName}
          address={bizAddress}
          rating={externalRating ?? undefined}
          businessType={bizType}
          imageUri={bizPhoto}
        />

        {/* Review text */}
        <View style={styles.reviewBox}>
          <View style={styles.reviewBoxHeader}>
            <Text style={styles.reviewBoxLabel}>Review</Text>
            <TouchableOpacity onPress={editingText ? saveEditedText : () => setEditingText(true)}>
              <Ionicons
                name={editingText ? 'checkmark-circle' : 'create-outline'}
                size={18}
                color={editingText ? '#22C55E' : '#8B9099'}
              />
            </TouchableOpacity>
          </View>
          {editingText ? (
            <TextInput
              style={styles.reviewTextInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              scrollEnabled={false}
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.reviewText}>{review?.review_text ?? 'No review text generated.'}</Text>
          )}
        </View>

        {/* Enhance chip */}
        <TouchableOpacity
          style={styles.enhanceChip}
          onPress={handleEnhanceTap}
          disabled={checkingHistory}
        >
          {checkingHistory ? (
            <ActivityIndicator size="small" color="#2D6A4F" />
          ) : (
            <>
              <Ionicons name="sparkles-outline" size={14} color="#2D6A4F" />
              <Text style={styles.enhanceChipText}>Enhance with AI</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── DEV: WebView test card ── */}
        <View style={styles.devCard}>
          <Text style={styles.devLabel}>DEV — Test WebView Post</Text>
          <Text style={styles.devHint}>
            {'1. Open Google Maps in browser\n2. Find any business → Write a review\n3. Copy the URL → paste below'}
          </Text>
          <TextInput
            style={styles.devInput}
            placeholder="https://search.google.com/local/writereview?placeid=ChIJ..."
            placeholderTextColor="#555"
            value={testUrl}
            onChangeText={setTestUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.devBtn, !testUrl.trim() && { opacity: 0.4 }]}
            disabled={!testUrl.trim()}
            onPress={() => router.push({
              pathname: '/review/webview-post',
              params: {
                review_url:        testUrl.trim(),
                review_text:       review?.review_text ?? 'Test review text for the WebView auto-fill.',
                rating:            String(Math.round(editableRating)),
                food_rating:       '',
                service_rating:    '',
                atmosphere_rating: '',
                business_name:     businessName,
                review_id:         review?.review_id ?? '',
              },
            })}
          >
            <Ionicons name="logo-google" size={14} color="#fff" />
            <Text style={styles.devBtnText}>Launch WebView Post</Text>
          </TouchableOpacity>
        </View>

        {/* Platform cards */}
        {networks.length > 0 ? (
          networks.map((net) =>
            renderPlatformCard(
              net.network_id, net.slug, net.name,
              () => handlePost(net.network_id, net.slug, net.name),
              posting === net.network_id,
            )
          )
        ) : (
          renderPlatformCard(
            'google-maps', 'google', 'Google',
            async () => {
              await Clipboard.setStringAsync(review?.review_text ?? '')
              const q = encodeURIComponent(`${businessName} ${bizAddress}`.trim())
              Alert.alert(
                '✓ Review copied!',
                'On Google Maps:\n1. Find the business\n2. Tap "Write a review"\n3. Set your star rating\n4. Paste the text',
                [
                  { text: 'Open Google Maps', onPress: () => Linking.openURL(`https://maps.google.com/?q=${q}`) },
                  { text: 'Later', style: 'cancel' },
                ]
              )
            },
            false,
          )
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push({ pathname: '/review/photos', params: { ...params, breakdown: JSON.stringify(breakdown) } })}
        >
          <Text style={styles.btnPrimaryText}>Next</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },

  content: { paddingBottom: 20 },

  reviewBox: { backgroundColor: '#1A1F2E', borderRadius: 16, padding: 16, marginBottom: 12, marginHorizontal: 20 },
  reviewBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reviewBoxLabel: { color: '#8B9099', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewText: { color: '#E0E0E0', fontSize: 14, lineHeight: 22 },
  reviewTextInput: {
    color: '#E0E0E0', fontSize: 14, lineHeight: 22,
    backgroundColor: '#0D0D0D', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#2D6A4F', minHeight: 100,
  },

  enhanceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#1E2435', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2D6A4F44', marginBottom: 16, marginHorizontal: 20,
  },
  enhanceChipText: { color: '#2D6A4F', fontSize: 13, fontWeight: '600' },

  /* ── Platform card ── */
  platformCard: {
    backgroundColor: '#1A1F2E', borderRadius: 16,
    marginBottom: 14, marginHorizontal: 20, overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row', alignItems: 'stretch',
    padding: 14, gap: 14,
  },

  /* Green left panel */
  ratingPanel: {
    backgroundColor: '#40916C', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    gap: 5, minWidth: 84,
  },
  ratingBigNum: { color: '#fff', fontSize: 34, fontWeight: '800', lineHeight: 38 },
  ratingStars: { flexDirection: 'row', gap: 2 },
  ratingLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2, textAlign: 'center' },

  /* Right info */
  ratingInfo: { flex: 1, justifyContent: 'center', gap: 8 },
  sentimentBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  sentimentText: { fontSize: 12, fontWeight: '700' },
  platformRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platformIconBg: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  platformName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  firstSubLabel: { color: '#8B9099', fontSize: 12, paddingLeft: 2 },

  /* Breakdown sub-criteria */
  breakdownSection: {
    borderTopWidth: 1, borderTopColor: '#2A3045',
    paddingHorizontal: 16, paddingTop: 4,
  },
  subRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#2A3045',
  },
  subLabel: { color: '#C0C6D4', fontSize: 13 },
  subStars: { flexDirection: 'row', gap: 4 },

  /* Char count */
  charSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  charBar: {
    height: 4, backgroundColor: '#2A3045', borderRadius: 2,
    marginBottom: 5, position: 'relative', overflow: 'hidden',
  },
  charFill: { height: '100%', borderRadius: 2 },
  charMinMark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFB80080' },
  charLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  charCount: { color: '#8B9099', fontSize: 11 },
  charWarn: { color: '#EF4444', fontSize: 11, fontWeight: '600' },

  /* Requirements */
  reqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  reqBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFB80018', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  reqText: { color: '#FFB800', fontSize: 11, fontWeight: '600' },

  /* Share row */
  shareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderTopWidth: 1, borderTopColor: '#2A3045',
    paddingVertical: 12,
  },
  shareText: { color: '#2D6A4F', fontSize: 13, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12,
    backgroundColor: '#0D0D0D',
  },
  btnSecondary: {
    flex: 1, height: 50, borderRadius: 12,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnPrimary: {
    flex: 1, height: 50, borderRadius: 12,
    backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  devCard: {
    backgroundColor: '#1A1F2E', borderRadius: 12, marginHorizontal: 20, marginBottom: 14,
    padding: 14, borderWidth: 1, borderColor: '#FFB80044',
  },
  devLabel: { color: '#FFB800', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  devHint: { color: '#8B9099', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  devInput: {
    backgroundColor: '#0D0D0D', borderRadius: 8, borderWidth: 1, borderColor: '#2A3045',
    color: '#fff', fontSize: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  devBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2D6A4F', borderRadius: 8, paddingVertical: 10,
  },
  devBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
