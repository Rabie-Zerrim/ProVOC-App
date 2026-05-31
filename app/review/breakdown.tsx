import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TodayCard from '../../components/TodayCard'
import { PLATFORM_CONFIG } from '../../utils/platformConfig'
import { getBizPhoto } from '../../utils/bizPhoto'

const PLATFORMS_ORDER = ['facebook', 'yelp', 'google', 'tripadvisor', 'trustpilot']

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.subRow}>
      <Text style={styles.subLabel}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity key={s} onPress={() => onChange(s)} hitSlop={6}>
            <Ionicons
              name={s <= value ? 'star' : 'star-outline'}
              size={26}
              color={s <= value ? '#FFB800' : '#3A3F55'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

function PlatformIcon({ slug }: { slug: string }) {
  const cfg = PLATFORM_CONFIG[slug]
  if (cfg?.faIcon) return <FontAwesome name={cfg.faIcon as any} size={15} color="#fff" />
  return <Ionicons name="globe-outline" size={15} color="#fff" />
}

export default function BreakdownScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    listing_id: string; business_name: string; address: string
    rating: string; business_type: string; network_ids: string; review_id: string
    selected_networks?: string
  }>()
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({})

  const setRating = (platform: string, sub: string, val: number) =>
    setRatings((prev) => ({ ...prev, [platform]: { ...(prev[platform] ?? {}), [sub]: val } }))

  let selectedSlugs: string[]
  try {
    selectedSlugs = params.selected_networks
      ? JSON.parse(params.selected_networks)
      : []
  } catch {
    selectedSlugs = []
  }

  const bizPhoto = getBizPhoto(params.business_type ?? '', params.listing_id ?? params.business_name ?? '')

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Breakdown Rates</Text>
        <View style={{ width: 36 }} />
      </View>

      <TodayCard
        businessName={params.business_name}
        address={params.address}
        rating={params.rating}
        businessType={params.business_type}
        imageUri={bizPhoto}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {PLATFORMS_ORDER.filter((slug) => selectedSlugs.includes(slug)).map((slug) => {
          const cfg = PLATFORM_CONFIG[slug]
          const subs = cfg.breakdownCategories

          return (
            <View key={slug} style={styles.platformCard}>
              {/* Platform header */}
              <View style={styles.platformHeader}>
                <View style={[styles.platformDot, { backgroundColor: cfg.color }]}>
                  <PlatformIcon slug={slug} />
                </View>
                <Text style={styles.platformName}>{cfg.displayName}</Text>
              </View>

              {/* Sub-category star rows */}
              {subs.map((sub, i) => (
                <StarRow
                  key={sub}
                  label={sub}
                  value={ratings[cfg.displayName]?.[sub] ?? 0}
                  onChange={(v) => setRating(cfg.displayName, sub, v)}
                />
              ))}
            </View>
          )
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push({
            pathname: '/review/result',
            params: { ...params, breakdown: JSON.stringify(ratings) },
          })}
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

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },

  content: { paddingHorizontal: 20, paddingTop: 8 },

  platformCard: {
    backgroundColor: '#1A1F2E', borderRadius: 16,
    marginBottom: 14, overflow: 'hidden',
  },

  platformHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#2A3045',
  },
  platformDot: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  platformName: { color: '#fff', fontSize: 15, fontWeight: '700' },

  subRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#2A3045',
  },
  subLabel: { color: '#C0C6D4', fontSize: 14 },
  stars: { flexDirection: 'row', gap: 6 },

  bottomBar: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12 },
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
})
