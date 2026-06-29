import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TodayCard from '../../components/TodayCard'
import { getBizPhoto } from '../../utils/bizPhoto'

const RATING_LABELS = ['', 'Terrible', 'Poor', 'Average', 'Very good', 'Excellent']

type ReviewOption = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  dest: '/review/chat' | '/review/enhance' | '/review/voice'
  fullWidth?: boolean
}

const REVIEW_OPTIONS: ReviewOption[] = [
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Regular Review',
    subtitle: 'Take a moment to share your thoughts.',
    dest: '/review/chat',
  },
  {
    icon: 'sparkles-outline',
    title: 'Smart review',
    subtitle: 'Make writing reviews effortless.',
    dest: '/review/enhance',
  },
  {
    icon: 'mic-outline',
    title: 'Voice review',
    subtitle: "Speak your thoughts and we'll handle the writing.",
    dest: '/review/voice',
    fullWidth: true,
  },
]

export default function RateScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    listing_id: string; business_name: string; address: string
    rating: string; business_type: string; network_ids: string
  }>()
  const [userRating, setUserRating] = useState(0)

  const bizPhoto = getBizPhoto(params.business_type ?? '', params.listing_id ?? params.business_name ?? '')
  const topTwo = REVIEW_OPTIONS.filter((o) => !o.fullWidth)
  const voiceOpt = REVIEW_OPTIONS.find((o) => o.fullWidth)!

  const navigateTo = (dest: ReviewOption['dest']) => {
    router.push({ pathname: dest, params: { ...params, rating: String(userRating) } })
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Rate your experience</Text>
        <View style={{ width: 36 }} />
      </View>

      <TodayCard
        businessName={params.business_name}
        address={params.address}
        rating={params.rating}
        businessType={params.business_type}
        imageUri={bizPhoto}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Stars card */}
        <View style={styles.starsCard}>
          <Text style={styles.question}>How would you rate{'\n'}this experience?</Text>
          <Text style={styles.subtitle}>Are you satisfied?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setUserRating(s)} hitSlop={8}>
                <Ionicons
                  name={s <= userRating ? 'star' : 'star-outline'}
                  size={48}
                  color={s <= userRating ? '#FFB800' : '#3A3F55'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {userRating > 0 && (
            <Text style={styles.ratingLabel}>{RATING_LABELS[userRating]}</Text>
          )}
        </View>

        {/* Review type cards — appear after star selection */}
        {userRating > 0 && (
          <>
            <Text style={styles.typePrompt}>How would you like to leave your review?</Text>

            {/* Top row — 2 cards side by side */}
            <View style={styles.topRow}>
              {topTwo.map((opt) => (
                <TouchableOpacity
                  key={opt.title}
                  style={styles.halfCard}
                  onPress={() => navigateTo(opt.dest)}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name={opt.icon} size={28} color="#fff" />
                  </View>
                  <Text style={styles.cardTitle}>{opt.title}</Text>
                  <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
                  <View style={styles.arrowBadge}>
                    <Ionicons name="arrow-forward" size={14} color="#8B9099" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Voice — full width */}
            <TouchableOpacity
              style={styles.fullCard}
              onPress={() => navigateTo(voiceOpt.dest)}
              activeOpacity={0.8}
            >
              <View style={styles.fullCardLeft}>
                <View style={[styles.iconBox, styles.iconBoxVoice]}>
                  <Ionicons name={voiceOpt.icon} size={28} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{voiceOpt.title}</Text>
                  <Text style={styles.cardSubtitle}>{voiceOpt.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#8B9099" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {userRating === 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
            <Text style={styles.btnSecondaryText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
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
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  content: { paddingHorizontal: 20, paddingTop: 8 },

  starsCard: {
    backgroundColor: '#1A1F2E', borderRadius: 16,
    padding: 28, alignItems: 'center', marginBottom: 20,
  },
  question: {
    color: '#fff', fontSize: 20, fontWeight: '700',
    textAlign: 'center', marginBottom: 8, lineHeight: 28,
  },
  subtitle: { color: '#8B9099', fontSize: 14, marginBottom: 28 },
  starsRow: { flexDirection: 'row', gap: 12 },
  ratingLabel: { color: '#FFB800', fontSize: 14, fontWeight: '600', marginTop: 16 },

  typePrompt: { color: '#8B9099', fontSize: 13, marginBottom: 14 },

  topRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  halfCard: {
    flex: 1, backgroundColor: '#1A1F2E', borderRadius: 16,
    padding: 16, minHeight: 160,
  },
  fullCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1F2E', borderRadius: 16,
    padding: 16, gap: 14,
  },
  fullCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },

  iconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#2A3045',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  iconBoxVoice: { backgroundColor: '#2D6A4F', marginBottom: 0 },

  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  cardSubtitle: { color: '#8B9099', fontSize: 12, lineHeight: 17 },
  arrowBadge: { position: 'absolute', top: 14, right: 14 },

  bottomBar: {
    flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12,
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0D0D0D',
  },
  btnSecondary: {
    flex: 1, height: 50, borderRadius: 12,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
