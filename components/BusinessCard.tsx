import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import StarRating from './StarRating'

type Props = {
  name: string
  address?: string
  rating?: number
  category?: string
}

export default function BusinessCard({ name, address, rating, category }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="business-outline" size={28} color="#2D6A4F" />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          )}
        </View>
        {address && <Text style={styles.address} numberOfLines={1}>{address}</Text>}
        {rating != null && <StarRating value={Math.round(rating)} size={14} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2E', borderRadius: 16, padding: 16, gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  categoryChip: { backgroundColor: '#1E2435', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#2A3045' },
  categoryText: { color: '#8B9099', fontSize: 10 },
  address: { color: '#8B9099', fontSize: 12 },
})
