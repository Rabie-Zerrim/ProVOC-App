import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type Props = {
  value: number
  onChange?: (v: number) => void
  size?: number
}

export default function StarRating({ value, onChange, size = 28 }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((s) =>
        onChange ? (
          <TouchableOpacity key={s} onPress={() => onChange(s)}>
            <Ionicons name={s <= value ? 'star' : 'star-outline'} size={size} color="#FFB800" />
          </TouchableOpacity>
        ) : (
          <Ionicons key={s} name={s <= value ? 'star' : 'star-outline'} size={size} color="#FFB800" />
        )
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
})
