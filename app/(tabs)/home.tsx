import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator, ImageBackground, Alert, Modal, Pressable,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import api from '../../services/api'
import { getBizPhoto } from '../../utils/bizPhoto'
import { usePlacePhoto } from '../../hooks/usePlacePhoto'

type User = { user_id: string; email: string; display_name: string }
type DraftReview = {
  review_id: string
  rating: number
  updated_at: string
  business?: { name?: string; business_type?: string }
  listing?: { listing_id?: string; external_url?: string }
}
type NearbyItem = { id: string; name: string; address: string; lat: number; lon: number; type?: string; distance?: number }

const CARD_COLORS = ['#1B4332', '#2D6A4F', '#40916C', '#1A3A2E', '#243B30']

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function fmtDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function formatDraftDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  let relative: string
  if (diffMins < 1) relative = 'Just now'
  else if (diffMins < 60) relative = `${diffMins}m ago`
  else if (diffHours < 24) relative = `${diffHours}h ago`
  else if (diffDays === 1) relative = 'Yesterday'
  else if (diffDays < 7) relative = `${diffDays} days ago`
  else relative = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return { relative, time }
}

type NearbyCardProps = {
  biz: NearbyItem
  onPress: () => void
}

function NearbyCard({ biz, onPress }: NearbyCardProps) {
  const placePhotoUrl = usePlacePhoto(biz.id)
  const fallbackUri = getBizPhoto(biz.type ?? '', biz.id)
  const photoUri = placePhotoUrl ?? fallbackUri

  return (
    <TouchableOpacity style={styles.nearbyCard} onPress={onPress} activeOpacity={0.85}>
      <ImageBackground
        source={{ uri: photoUri }}
        style={styles.nearbyCardBg}
        imageStyle={{ borderRadius: 16 }}
      >
        <View style={styles.nearbyCardOverlay}>
          {biz.distance != null && (
            <View style={styles.nearbyBadge}>
              <Text style={styles.nearbyBadgeText}>{fmtDistance(biz.distance)}</Text>
            </View>
          )}
          <View style={styles.nearbyBottom}>
            <Text style={styles.nearbyName} numberOfLines={2}>{biz.name}</Text>
            <Text style={styles.nearbyAddr} numberOfLines={1}>{biz.address}</Text>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftReview[]>([])
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const [sheetDraft, setSheetDraft] = useState<DraftReview | null>(null)
  const [nearby, setNearby] = useState<NearbyItem[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(true)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])

  // Reload everything whenever the tab is focused
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.multiGet(['@provoc_user', '@provoc_avatar', '@provoc_pinned_drafts']).then(
        ([[, userRaw], [, avatar], [, pinnedRaw]]) => {
          if (userRaw) setUser(JSON.parse(userRaw))
          setAvatarUri(avatar ?? null)
          if (pinnedRaw) setPinned(new Set(JSON.parse(pinnedRaw)))
        }
      )
      api.get('/reviews?statuses=draft,pending&limit=10&sort_by=updated_at&sort_order=desc')
        .then(({ data }) => setDrafts(data.data ?? []))
        .catch(() => {})
    }, [])
  )

  useEffect(() => {
    loadNearby()
  }, [])

  useEffect(() => {
    api.get('/recommendations')
      .then(({ data }) => setRecommendations(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(() => setRecommendations([]))
  }, [])

  const handleLongPress = (draft: DraftReview) => setSheetDraft(draft)

  const handlePin = async () => {
    if (!sheetDraft) return
    const next = new Set(pinned)
    pinned.has(sheetDraft.review_id) ? next.delete(sheetDraft.review_id) : next.add(sheetDraft.review_id)
    setPinned(next)
    await AsyncStorage.setItem('@provoc_pinned_drafts', JSON.stringify([...next]))
    setSheetDraft(null)
  }

  const handleDelete = () => {
    if (!sheetDraft) return
    const name = sheetDraft.business?.name ?? 'this draft'
    Alert.alert('Delete draft', `Are you sure you want to delete the review for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await api.delete(`/reviews/${sheetDraft.review_id}`) } catch {}
          setDrafts((prev) => prev.filter((d) => d.review_id !== sheetDraft.review_id))
          const next = new Set(pinned)
          next.delete(sheetDraft.review_id)
          setPinned(next)
          await AsyncStorage.setItem('@provoc_pinned_drafts', JSON.stringify([...next]))
          setSheetDraft(null)
        },
      },
    ])
  }

  const loadNearby = async () => {
    setNearbyLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setNearbyLoading(false); return }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const userLat = pos.coords.latitude
      const userLon = pos.coords.longitude
      setCoords({ lat: userLat, lon: userLon })

      const params = new URLSearchParams({
        lat: userLat.toString(),
        lon: userLon.toString(),
        amenities: 'restaurant,cafe,gym,cinema',
      })
      const { data } = await api.get(`/listings/nearby?${params.toString()}`)
      const items: NearbyItem[] = (data.items ?? []).map((item: any) => ({
        ...item,
        distance: item.lat && item.lon ? haversineKm(userLat, userLon, item.lat, item.lon) : undefined,
      }))
      items.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
      setNearby(items.slice(0, 6))
    } catch {}
    finally { setNearbyLoading(false) }
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.display_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'P'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Hello {user?.display_name ?? 'there'} 👋</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color="#8B9099" />
            <Text style={styles.locationText}>
              {coords ? 'Using your location' : 'Your location'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/search')}>
        <Ionicons name="search-outline" size={18} color="#8B9099" />
        <Text style={styles.searchPlaceholder}>Search here</Text>
      </TouchableOpacity>

      {/* Nearby section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nearby</Text>
        <TouchableOpacity onPress={() => router.push('/search')}>
          <Text style={styles.sectionLink}>See all</Text>
        </TouchableOpacity>
      </View>

      {nearbyLoading ? (
        <View style={styles.nearbyLoader}>
          <ActivityIndicator color="#2D6A4F" />
        </View>
      ) : nearby.length === 0 ? (
        <View style={styles.nearbyEmpty}>
          <Text style={styles.nearbyEmptyText}>No businesses found nearby</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.nearbyScroll}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}
        >
          {nearby.map((biz) => (
            <NearbyCard key={biz.id} biz={biz} onPress={() => router.push('/search')} />
          ))}
        </ScrollView>
      )}

      {/* Recommended For You */}
      {recommendations.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✨ Recommended For You</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recScroll}
            contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}
          >
            {recommendations.map((rec, idx) => (
              <View key={idx} style={styles.recCard}>
                <Text style={styles.recName} numberOfLines={1}>{rec.business_name}</Text>
                <View style={styles.recRating}>
                  <Text style={{ color: '#FFB800', fontSize: 13, fontWeight: '600' }}>
                    ⭐ {rec.rating?.toFixed(1) ?? '—'}
                  </Text>
                </View>
                <Text style={styles.recScore}>{Math.round((rec.score ?? 0) * 100)}% match</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* CTA card */}
      <View style={styles.ctaCard}>
        <Ionicons name="chatbubble-ellipses-outline" size={32} color="#fff" style={{ marginBottom: 10 }} />
        <Text style={styles.ctaTitle}>How was your last experience?</Text>
        <Text style={styles.ctaSubtitle}>Write once, share everywhere</Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/search')}>
          <Text style={styles.ctaBtnText}>Share review</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={styles.aiDisclaimer}>
          <Ionicons name="sparkles-outline" size={12} color="#8B9099" />
          <Text style={styles.aiDisclaimerText}>AI assists in refining your review</Text>
        </View>
      </View>

      {/* Drafts */}
      {drafts.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Continue a draft</Text>
          </View>
          {[...drafts].sort((a, b) => {
            const ap = pinned.has(a.review_id) ? 0 : 1
            const bp = pinned.has(b.review_id) ? 0 : 1
            return ap - bp
          }).map((draft) => {
            const name = draft.business?.name ?? 'Unnamed business'
            const bizType = draft.business?.business_type
            const { relative, time } = formatDraftDate(draft.updated_at)
            const rating = draft.rating ?? 0
            const isPinned = pinned.has(draft.review_id)
            return (
              <TouchableOpacity
                key={draft.review_id}
                style={[styles.draftItem, isPinned && styles.draftItemPinned]}
                onPress={() => router.push({ pathname: '/review/chat', params: { review_id: draft.review_id, business_name: draft.business?.name ?? '', business_type: draft.business?.business_type ?? '', rating: String(draft.rating ?? '') } })}
                onLongPress={() => handleLongPress(draft)}
                delayLongPress={400}
              >
                <View style={styles.draftThumb}>
                  <Ionicons name="document-text-outline" size={22} color="#2D6A4F" />
                </View>
                <View style={styles.draftInfo}>
                  <View style={styles.draftNameRow}>
                    <Text style={styles.draftName} numberOfLines={1}>{name}</Text>
                    {isPinned && (
                      <Ionicons name="pin" size={13} color="#FFB800" />
                    )}
                    {bizType ? (
                      <View style={styles.draftTypeBadge}>
                        <Text style={styles.draftTypeBadgeText}>{bizType}</Text>
                      </View>
                    ) : null}
                  </View>
                  {rating > 0 && (
                    <View style={styles.draftRatingRow}>
                      {[1,2,3,4,5].map(s => (
                        <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={11} color="#FFB800" />
                      ))}
                      <Text style={styles.draftRatingNum}>{rating.toFixed(1)}</Text>
                    </View>
                  )}
                  <View style={styles.draftDateRow}>
                    <Ionicons name="time-outline" size={11} color="#8B9099" />
                    <Text style={styles.draftDate}>{relative} · {time}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8B9099" />
              </TouchableOpacity>
            )
          })}
        </>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>

    {/* Draft action sheet */}
    <Modal visible={!!sheetDraft} transparent animationType="slide" onRequestClose={() => setSheetDraft(null)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setSheetDraft(null)}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Business info */}
          <View style={styles.sheetBizRow}>
            <View style={styles.sheetBizAvatar}>
              <Ionicons name="document-text" size={20} color="#2D6A4F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetBizName} numberOfLines={1}>
                {sheetDraft?.business?.name ?? 'Draft review'}
              </Text>
              {sheetDraft?.business?.business_type ? (
                <Text style={styles.sheetBizType}>{sheetDraft.business.business_type}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.sheetDivider} />

          {/* Pin action */}
          <TouchableOpacity style={styles.sheetAction} onPress={handlePin}>
            <View style={[styles.sheetActionIcon, { backgroundColor: '#1B3A2E' }]}>
              <Ionicons
                name={sheetDraft && pinned.has(sheetDraft.review_id) ? 'pin' : 'pin-outline'}
                size={20}
                color="#FFB800"
              />
            </View>
            <View style={styles.sheetActionText}>
              <Text style={styles.sheetActionLabel}>
                {sheetDraft && pinned.has(sheetDraft.review_id) ? 'Unpin draft' : 'Pin to top'}
              </Text>
              <Text style={styles.sheetActionSub}>
                {sheetDraft && pinned.has(sheetDraft.review_id)
                  ? 'Remove from pinned drafts'
                  : 'Keep this draft at the top'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Delete action */}
          <TouchableOpacity style={styles.sheetAction} onPress={handleDelete}>
            <View style={[styles.sheetActionIcon, { backgroundColor: '#2A1A1A' }]}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </View>
            <View style={styles.sheetActionText}>
              <Text style={[styles.sheetActionLabel, { color: '#EF4444' }]}>Delete draft</Text>
              <Text style={styles.sheetActionSub}>This action cannot be undone</Text>
            </View>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setSheetDraft(null)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  content: { paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  headerText: { flex: 1 },
  greeting: { color: '#fff', fontSize: 17, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { color: '#8B9099', fontSize: 12 },
  notifBtn: { padding: 6 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2E',
    borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 14,
    height: 48, gap: 10, marginBottom: 24,
  },
  searchPlaceholder: { color: '#8B9099', fontSize: 15 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionLink: { color: '#2D6A4F', fontSize: 13, fontWeight: '600' },
  nearbyScroll: { marginBottom: 24 },
  nearbyLoader: { height: 130, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  nearbyEmpty: { height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  nearbyEmptyText: { color: '#8B9099', fontSize: 13 },
  nearbyCard: { width: 160, height: 140, borderRadius: 16, marginRight: 12, overflow: 'hidden' },
  nearbyCardBg: { width: '100%', height: '100%' },
  nearbyCardOverlay: {
    flex: 1, borderRadius: 16, padding: 10,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  nearbyBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  nearbyBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  nearbyBottom: { gap: 2 },
  nearbyName: { color: '#fff', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  nearbyAddr: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  ctaCard: { backgroundColor: '#1B4332', borderRadius: 16, marginHorizontal: 20, padding: 20, marginBottom: 28 },
  ctaTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  ctaSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 16 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2D6A4F', borderRadius: 10, paddingHorizontal: 16,
    paddingVertical: 10, alignSelf: 'flex-start', marginBottom: 12,
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiDisclaimerText: { color: '#8B9099', fontSize: 11 },
  draftItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2E',
    borderRadius: 12, padding: 14, marginHorizontal: 20, marginBottom: 10,
  },
  draftItemPinned: {
    borderWidth: 1, borderColor: '#2D6A4F',
  },
  draftThumb: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#0D0D0D',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  draftInfo: { flex: 1, gap: 4 },
  draftNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  draftName: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  draftTypeBadge: { backgroundColor: '#2A3045', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  draftTypeBadgeText: { color: '#8B9099', fontSize: 10, fontWeight: '600' },
  draftRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  draftRatingNum: { color: '#FFB800', fontSize: 11, fontWeight: '600', marginLeft: 3 },
  draftDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  draftDate: { color: '#8B9099', fontSize: 11 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: '#1A1F2E', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#2A3045',
    alignSelf: 'center', marginBottom: 20,
  },
  sheetBizRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  sheetBizAvatar: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#0D1A14',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetBizName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sheetBizType: { color: '#8B9099', fontSize: 12, marginTop: 2 },
  sheetDivider: { height: 1, backgroundColor: '#252B3B', marginBottom: 8 },
  sheetAction: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
  },
  sheetActionIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetActionText: { flex: 1 },
  sheetActionLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sheetActionSub: { color: '#8B9099', fontSize: 12, marginTop: 2 },
  sheetCancelBtn: {
    marginTop: 8, backgroundColor: '#252B3B', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  sheetCancelText: { color: '#8B9099', fontSize: 15, fontWeight: '600' },

  recScroll: { marginBottom: 24 },
  recCard: {
    width: 140, backgroundColor: '#1A1F2E', borderRadius: 14,
    padding: 14, marginRight: 12, justifyContent: 'space-between',
  },
  recName: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  recRating: { marginBottom: 6 },
  recScore: { color: '#40916C', fontSize: 11, fontWeight: '700' },
})
