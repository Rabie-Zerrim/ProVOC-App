import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TodayCard from '../../components/TodayCard'
import { getBizPhoto } from '../../utils/bizPhoto'

type Option = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  dest: '/review/chat' | '/review/enhance' | '/review/recording' | '/review/voice'
  fullWidth?: boolean
}

const OPTIONS: Option[] = [
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

export default function ReviewTypeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    listing_id: string; business_name: string; address: string
    rating: string; business_type: string; network_ids: string
  }>()

  const bizPhoto = getBizPhoto(params.business_type ?? '', params.listing_id ?? params.business_name ?? '')

  const topTwo = OPTIONS.filter((o) => !o.fullWidth)
  const voiceOpt = OPTIONS.find((o) => o.fullWidth)!

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Review type</Text>
        <View style={{ width: 36 }} />
      </View>

      <TodayCard
        businessName={params.business_name}
        address={params.address}
        rating={params.rating}
        businessType={params.business_type}
        imageUri={bizPhoto}
      />

      <Text style={styles.prompt}>How would you like to leave your review?</Text>

      {/* Top row — 2 cards side by side */}
      <View style={styles.topRow}>
        {topTwo.map((opt) => (
          <TouchableOpacity
            key={opt.title}
            style={styles.halfCard}
            onPress={() => router.push({ pathname: opt.dest, params })}
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
        onPress={() => router.push({ pathname: voiceOpt.dest, params })}
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
  prompt: { color: '#8B9099', fontSize: 13, paddingHorizontal: 20, marginBottom: 14, marginTop: 4 },

  topRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    minHeight: 160,
  },
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 16,
    gap: 14,
  },
  fullCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2A3045',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBoxVoice: {
    backgroundColor: '#2D6A4F',
    marginBottom: 0,
  },

  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  cardSubtitle: { color: '#8B9099', fontSize: 12, lineHeight: 17 },

  arrowBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
})
