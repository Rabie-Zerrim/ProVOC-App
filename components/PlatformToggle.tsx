import { View, Text, StyleSheet, Switch } from 'react-native'

const ICONS: Record<string, string> = {
  google: '🔵',
  yelp: '🔴',
  facebook: '🔵',
  tripadvisor: '🟢',
  trustpilot: '⭐',
}

type Props = {
  slug: string
  name: string
  enabled: boolean
  onToggle: (val: boolean) => void
}

export default function PlatformToggle({ slug, name, enabled, onToggle }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{ICONS[slug] ?? '🌐'}</Text>
      <Text style={styles.name}>{name}</Text>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#3A3F4B', true: '#4CAF50' }}
        thumbColor="#fff"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3045', gap: 12 },
  icon: { fontSize: 20 },
  name: { color: '#fff', fontSize: 15, flex: 1 },
})
