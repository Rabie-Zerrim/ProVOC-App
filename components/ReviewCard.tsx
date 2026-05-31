import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type Props = {
  businessName: string
  reviewText: string
  rating: number
  status: string
  daysAgo: string
  onPress: () => void
}

export default function ReviewCard({ businessName, reviewText, rating, status, daysAgo, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{businessName}</Text>
        <View style={[styles.badge, status === 'published' && styles.badgePublished]}>
          <Text style={styles.badgeText}>{status}</Text>
        </View>
      </View>
      <Text style={styles.text} numberOfLines={2}>{reviewText}</Text>
      <View style={styles.footer}>
        <View style={styles.stars}>
          {[1,2,3,4,5].map((s) => (
            <Ionicons key={s} name={s <= rating ? 'star' : 'star-outline'} size={12} color="#FFB800" />
          ))}
        </View>
        <Text style={styles.date}>{daysAgo}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1A1F2E', borderRadius: 14, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  badge: { backgroundColor: '#1E2435', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgePublished: { backgroundColor: '#1B4332' },
  badgeText: { color: '#8B9099', fontSize: 10, textTransform: 'capitalize' },
  text: { color: '#8B9099', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stars: { flexDirection: 'row', gap: 2 },
  date: { color: '#8B9099', fontSize: 11 },
})
