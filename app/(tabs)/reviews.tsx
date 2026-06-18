import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle, G } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from '../../services/api'

type Review = {
  review_id: string
  status: string
  rating: number
  review_text: string
  updated_at: string
  listing?: { name: string }
  business?: { name?: string }
}

type FilterTab = 'all' | 'published' | 'pending' | 'draft'

type DashboardSummary = {
  total_reviews: number
  by_status: { draft: number; pending: number; published: number; posted: number }
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:    { bg: '#2A3045', text: '#8B9099' },
  pending:  { bg: '#3A2E00', text: '#FFB800' },
  posted:   { bg: '#1B4332', text: '#22C55E' },
  failed:   { bg: '#3A0000', text: '#EF4444' },
}

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  draft:    'create-outline',
  pending:  'time-outline',
  posted:   'checkmark-circle',
  failed:   'close-circle',
}

// Dashboard's by_status keys are a separate lifecycle breakdown from the
// review-list STATUS_COLORS above (it tracks 'published' in addition to
// 'posted' — confirmed against pv-bff's REVIEW_STATUSES) so it gets its own
// color/label map rather than reusing STATUS_COLORS, which has no 'published' key.
const DASHBOARD_STATUS_META: { key: keyof DashboardSummary['by_status']; label: string; color: string }[] = [
  { key: 'draft',     label: 'Draft',     color: '#8B9099' },
  { key: 'pending',   label: 'Pending',   color: '#FFB800' },
  { key: 'published', label: 'Published', color: '#40916C' },
  { key: 'posted',    label: 'Posted',    color: '#22C55E' },
]

// Simple stroke-dasharray ring chart — avoids hand-built arc-path geometry,
// which is fiddlier to get pixel-correct than this standard SVG technique.
function DonutChart({
  data, size = 110, strokeWidth = 16,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number
  strokeWidth?: number
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius

  if (total === 0) {
    return (
      <View style={[styles.donutEmpty, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.donutEmptyText}>No data</Text>
      </View>
    )
  }

  let offset = 0
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${cx}, ${cy}`}>
        {data.map((d) => {
          if (d.value === 0) return null
          const segmentLength = (d.value / total) * circumference
          const dashOffset = -offset
          offset += segmentLength
          return (
            <Circle
              key={d.label}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={dashOffset}
              fill="none"
            />
          )
        })}
      </G>
    </Svg>
  )
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'pending',   label: 'Pending' },
  { key: 'draft',     label: 'Draft' },
]

function getEndpoint(tab: FilterTab) {
  if (tab === 'published') return '/reviews?status=posted'
  if (tab === 'pending')   return '/reviews?status=pending'
  if (tab === 'draft')     return '/reviews?status=draft'
  return '/reviews'
}

const PINS_KEY = '@provoc_pins'

export default function ReviewsScreen() {
  const router = useRouter()
  const [reviews, setReviews]       = useState<Review[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab]   = useState<FilterTab>('all')
  const [activeStar, setActiveStar] = useState<number | null>(null)
  const [pinnedIds, setPinnedIds]   = useState<Set<string>>(new Set())
  const [dashboard, setDashboard]   = useState<DashboardSummary | null>(null)
  const [avgRating, setAvgRating]   = useState<number | null>(null)
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, { average: number; count: number }>>({})
  const [dashLoading, setDashLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(PINS_KEY).then((raw) => {
      if (raw) setPinnedIds(new Set(JSON.parse(raw)))
    })
  }, [])

  useEffect(() => {
    Promise.all([
      api.get('/reviews/stats'),
      api.get('/reviews/dashboard'),
      api.get('/reviews/category-breakdown'),
    ])
      .then(([statsRes, dashRes, categoryRes]) => {
        setAvgRating(statsRes.data?.average_rating ?? null)
        setDashboard(dashRes.data)
        setCategoryBreakdown(categoryRes.data ?? {})
      })
      .catch(() => {})
      .finally(() => setDashLoading(false))
  }, [])

  const fetchReviews = useCallback(async (tab: FilterTab, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const { data } = await api.get(getEndpoint(tab))
      setReviews(data.data ?? data.items ?? data ?? [])
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchReviews(activeTab) }, [activeTab, fetchReviews])

  const onRefresh = () => fetchReviews(activeTab, true)

  const togglePin = async (id: string) => {
    const next = new Set(pinnedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPinnedIds(next)
    await AsyncStorage.setItem(PINS_KEY, JSON.stringify([...next]))
  }

  const deleteReview = (item: Review) => {
    const biz = item.listing?.name ?? item.business?.name ?? 'this review'
    Alert.alert('Delete review', `Delete your review for ${biz}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/reviews/${item.review_id}`)
            setReviews((prev) => prev.filter((r) => r.review_id !== item.review_id))
            if (pinnedIds.has(item.review_id)) {
              const next = new Set(pinnedIds)
              next.delete(item.review_id)
              setPinnedIds(next)
              await AsyncStorage.setItem(PINS_KEY, JSON.stringify([...next]))
            }
          } catch {
            Alert.alert('Error', 'Could not delete the review.')
          }
        },
      },
    ])
  }

  const starFiltered = activeStar
    ? reviews.filter((r) => Math.round(r.rating) === activeStar)
    : reviews

  const sorted = [
    ...starFiltered.filter((r) => pinnedIds.has(r.review_id)),
    ...starFiltered.filter((r) => !pinnedIds.has(r.review_id)),
  ]

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#2D6A4F" size="large" />
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Reviews</Text>

      {/* Stats dashboard */}
      <View style={styles.dashboardCard}>
        {dashLoading ? (
          <View style={styles.dashboardLoading}>
            <ActivityIndicator color="#2D6A4F" />
          </View>
        ) : (
          <>
            <View style={styles.dashboardChartRow}>
              <DonutChart
                data={DASHBOARD_STATUS_META.map((m) => ({
                  label: m.label,
                  value: dashboard?.by_status?.[m.key] ?? 0,
                  color: m.color,
                }))}
              />
              <View style={styles.dashboardLegend}>
                {DASHBOARD_STATUS_META.map((m) => (
                  <View key={m.key} style={styles.legendRow}>
                    <View style={[styles.legendSwatch, { backgroundColor: m.color }]} />
                    <Text style={styles.legendLabel}>{m.label}</Text>
                    <Text style={styles.legendCount}>{dashboard?.by_status?.[m.key] ?? 0}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.dashboardStatsRow}>
              <View style={styles.dashboardStat}>
                <Text style={styles.dashboardStatNum}>{dashboard?.total_reviews ?? 0}</Text>
                <Text style={styles.dashboardStatLabel}>Total reviews</Text>
              </View>
              <View style={styles.dashboardStat}>
                <Text style={[styles.dashboardStatNum, { color: '#FFB800' }]}>
                  {avgRating != null ? avgRating.toFixed(1) : '—'}
                </Text>
                <Text style={styles.dashboardStatLabel}>Avg rating</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Your Ratings — separate card so it can grow independently of the
          donut chart's fixed layout, and so each concern gets its own clear
          heading (matches this app's existing pattern of separate cards per
          section, e.g. profile.tsx's user/password/stats/platforms cards). */}
      <View style={styles.categoryRatingsCard}>
        {dashLoading ? (
          <View style={styles.dashboardLoading}>
            <ActivityIndicator color="#2D6A4F" />
          </View>
        ) : Object.keys(categoryBreakdown).length === 0 ? (
          <>
            <Text style={styles.categoryRatingsTitle}>Your Ratings</Text>
            <Text style={styles.categoryRatingsEmptyText}>
              Rate categories on your reviews to see your average ratings here.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.categoryRatingsTitle}>Your Ratings</Text>
            {Object.entries(categoryBreakdown).map(([category, { average, count }]) => (
              <View key={category} style={styles.categoryRow}>
                <Text style={styles.categoryName}>{category}</Text>
                <View style={styles.categoryValueRow}>
                  <Ionicons name="star" size={13} color="#FFB800" />
                  <Text style={styles.categoryValueText}>{average.toFixed(1)}</Text>
                  <Text style={styles.categoryCountText}>
                    ({count} review{count === 1 ? '' : 's'})
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      {/* Status tabs */}
      <View style={styles.tabs}>
        {TABS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => { setActiveTab(key); setActiveStar(null) }}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Star filter */}
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.starChip, activeStar === s && styles.starChipActive]}
            onPress={() => setActiveStar(activeStar === s ? null : s)}
          >
            <Ionicons name="star" size={11} color={activeStar === s ? '#fff' : '#FFB800'} />
            <Text style={[styles.starChipText, activeStar === s && { color: '#fff' }]}>{s}</Text>
          </TouchableOpacity>
        ))}
        {activeStar !== null && (
          <TouchableOpacity onPress={() => setActiveStar(null)}>
            <Text style={styles.clearFilter}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {sorted.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="star-outline" size={52} color="#3A3F4B" />
          <Text style={styles.emptyText}>No reviews yet</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.review_id}
          contentContainerStyle={{ padding: 20, paddingTop: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D6A4F" />
          }
          renderItem={({ item }) => {
            const statusStyle = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft
            const statusIcon = STATUS_ICONS[item.status] ?? STATUS_ICONS.draft
            const preview = item.review_text?.trim().slice(0, 100)
            const date = new Date(item.updated_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            const isPinned = pinnedIds.has(item.review_id)
            const isEditable = item.status === 'draft' || item.status === 'pending'
            const bizName = item.listing?.name ?? item.business?.name ?? 'Review'

            return (
              <TouchableOpacity
                style={[styles.card, isPinned && styles.cardPinned]}
                onPress={() => router.push({ pathname: '/review/result', params: { review_id: item.review_id } })}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.bizName} numberOfLines={1}>{bizName}</Text>
                  {isPinned && <Ionicons name="pin" size={12} color="#2D6A4F" style={{ marginRight: 4 }} />}
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Ionicons name={statusIcon} size={12} color={statusStyle.text} />
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
                  </View>
                </View>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name={s <= item.rating ? 'star' : 'star-outline'} size={14} color="#FFB800" />
                  ))}
                  <Text style={styles.dateText}>{date}</Text>
                </View>
                {!!preview && (
                  <Text style={styles.reviewText} numberOfLines={2}>{preview}</Text>
                )}
                {isEditable && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={(e) => { e.stopPropagation?.(); togglePin(item.review_id) }}
                    >
                      <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={13} color={isPinned ? '#2D6A4F' : '#8B9099'} />
                      <Text style={[styles.actionText, isPinned && { color: '#2D6A4F' }]}>{isPinned ? 'Pinned' : 'Pin'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={(e) => { e.stopPropagation?.(); router.push({ pathname: '/review/result', params: { review_id: item.review_id } }) }}
                    >
                      <Ionicons name="create-outline" size={13} color="#8B9099" />
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={(e) => { e.stopPropagation?.(); deleteReview(item) }}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                      <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 60 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  heading:   { color: '#fff', fontSize: 22, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14 },
  emptyText: { color: '#8B9099', fontSize: 15 },

  dashboardCard: {
    backgroundColor: '#1A1F2E', borderRadius: 16, padding: 16,
    marginHorizontal: 20, marginBottom: 16,
  },
  dashboardLoading: { paddingVertical: 28, alignItems: 'center' },
  dashboardChartRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 16 },
  dashboardLegend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: '#C0C6D4', fontSize: 12 },
  legendCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dashboardStatsRow: {
    flexDirection: 'row', gap: 8, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#2A3045',
  },
  dashboardStat: { flex: 1, alignItems: 'center' },
  dashboardStatNum: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  dashboardStatLabel: { color: '#8B9099', fontSize: 11 },
  donutEmpty: { borderWidth: 16, borderColor: '#2A3045', justifyContent: 'center', alignItems: 'center' },
  donutEmptyText: { color: '#8B9099', fontSize: 11 },

  categoryRatingsCard: {
    backgroundColor: '#1A1F2E', borderRadius: 16, padding: 16,
    marginHorizontal: 20, marginBottom: 16,
  },
  categoryRatingsTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  categoryRatingsEmptyText: { color: '#8B9099', fontSize: 13, lineHeight: 19 },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#2A3045',
  },
  categoryName: { color: '#C0C6D4', fontSize: 13, flex: 1 },
  categoryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryValueText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  categoryCountText: { color: '#8B9099', fontSize: 11 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10, gap: 6 },
  tab: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1F2E', borderWidth: 1, borderColor: '#2A3045',
  },
  tabActive:     { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  tabText:       { color: '#8B9099', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  starRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 6, marginBottom: 4 },
  starChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#1A1F2E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: '#2A3045',
  },
  starChipActive: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  starChipText:   { color: '#FFB800', fontSize: 11, fontWeight: '600' },
  clearFilter:    { color: '#8B9099', fontSize: 12, marginLeft: 4 },

  card:       { backgroundColor: '#1A1F2E', borderRadius: 14, padding: 16, marginBottom: 12 },
  cardPinned: { borderWidth: 1, borderColor: '#2D6A4F44' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bizName:    { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  statusBadge:{
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8,
  },
  statusText: { fontSize: 12, textTransform: 'capitalize', fontWeight: '600' },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  dateText:   { color: '#8B9099', fontSize: 11, marginLeft: 8 },
  reviewText: { color: '#8B9099', fontSize: 13, lineHeight: 18 },

  actionRow: {
    flexDirection: 'row', marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#2A3045', gap: 4,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 7, borderRadius: 8, backgroundColor: '#0D0D0D',
  },
  actionText: { color: '#8B9099', fontSize: 12, fontWeight: '600' },
})
