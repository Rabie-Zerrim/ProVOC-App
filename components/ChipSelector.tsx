import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native'

type Chip = { label: string; emoji?: string }

type Props = {
  chips: Chip[]
  selected: Set<string>
  onToggle: (label: string) => void
  multi?: boolean
}

export default function ChipSelector({ chips, selected, onToggle, multi = true }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((c) => (
        <TouchableOpacity
          key={c.label}
          style={[styles.chip, selected.has(c.label) && styles.chipActive]}
          onPress={() => onToggle(c.label)}
        >
          <Text style={styles.chipText}>{c.emoji ? `${c.emoji} ` : ''}{c.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 8 },
  chip: { backgroundColor: '#1E2435', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2A3045' },
  chipActive: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  chipText: { color: '#fff', fontSize: 13 },
})
