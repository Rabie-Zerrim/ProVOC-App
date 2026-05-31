import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TodayCard from '../../components/TodayCard'
import { getBizPhoto } from '../../utils/bizPhoto'

export default function RateScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    listing_id: string; business_name: string; address: string
    rating: string; business_type: string; network_ids: string
  }>()
  const [userRating, setUserRating] = useState(0)

  const bizPhoto = getBizPhoto(params.business_type ?? '', params.listing_id ?? params.business_name ?? '')

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Rate</Text>
        <View style={{ width: 36 }} />
      </View>

      <TodayCard
        businessName={params.business_name}
        address={params.address}
        rating={params.rating}
        businessType={params.business_type}
        imageUri={bizPhoto}
      />

      <View style={styles.card}>
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
          <Text style={styles.ratingLabel}>
            {['', 'Terrible', 'Poor', 'Average', 'Very good', 'Excellent'][userRating]}
          </Text>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, userRating === 0 && styles.btnDisabled]}
          disabled={userRating === 0}
          onPress={() =>
            router.push({
              pathname: '/review/type',
              params: { ...params, rating: String(userRating) },
            })
          }
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
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  card: {
    backgroundColor: '#1A1F2E', borderRadius: 16,
    marginHorizontal: 20, padding: 28, alignItems: 'center',
  },
  question: {
    color: '#fff', fontSize: 20, fontWeight: '700',
    textAlign: 'center', marginBottom: 8, lineHeight: 28,
  },
  subtitle: { color: '#8B9099', fontSize: 14, marginBottom: 28 },
  starsRow: { flexDirection: 'row', gap: 12 },
  ratingLabel: {
    color: '#FFB800', fontSize: 14, fontWeight: '600', marginTop: 16,
  },

  bottomBar: {
    flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12,
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0D0D0D',
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
  btnDisabled: { opacity: 0.4 },
})
