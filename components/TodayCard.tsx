import { View, Text, StyleSheet, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type Props = {
  businessName: string
  address?: string
  rating?: string | number
  reviewCount?: string | number
  businessType?: string
  imageUri?: string
}

export default function TodayCard({ businessName, address, rating, reviewCount, businessType, imageUri }: Props) {
  const initial = businessName?.[0]?.toUpperCase() ?? 'B'
  const ratingNum = rating ? Number(rating) : null

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Today you are reviewing</Text>
      <View style={styles.row}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatar} />
        ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{businessName ?? 'Business'}</Text>
            {businessType ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{businessType}</Text>
              </View>
            ) : null}
          </View>
          {address ? (
            <Text style={styles.address} numberOfLines={1}>{address}</Text>
          ) : null}
          {ratingNum ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#FFB800" />
              <Text style={styles.ratingText}>{ratingNum.toFixed(1)}</Text>
              {reviewCount ? <Text style={styles.reviewCount}>({reviewCount})</Text> : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  label: { color: '#8B9099', fontSize: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  avatarFallback: {
    backgroundColor: '#2D6A4F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 20 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  name: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  badge: { backgroundColor: '#2A3045', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#8B9099', fontSize: 11, fontWeight: '600' },
  address: { color: '#8B9099', fontSize: 12, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reviewCount: { color: '#8B9099', fontSize: 11 },
})
