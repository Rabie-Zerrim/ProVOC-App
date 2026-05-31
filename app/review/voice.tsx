import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TOPICS = [
  { emoji: '🤝', label: 'Service' },
  { emoji: '👥', label: 'Staff' },
  { emoji: '💰', label: 'Price' },
  { emoji: '🏠', label: 'Environment' },
  { emoji: '😊', label: 'Atmosphere' },
  { emoji: '⭐', label: 'Quality' },
  { emoji: '✨', label: 'Cleanliness' },
]

export default function VoiceScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')

  const toggleTopic = (label: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Provoc Voice</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>How would you describe your experience?</Text>
        <View style={styles.topicsGrid}>
          {TOPICS.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.chip, selected.has(t.label) && styles.chipActive]}
              onPress={() => toggleTopic(t.label)}
            >
              <Text style={styles.chipText}>{t.emoji} {t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.plusBtn}>
          <Ionicons name="add" size={22} color="#8B9099" />
        </TouchableOpacity>
        <TextInput
          style={styles.chatInput}
          placeholder="Ask anything..."
          placeholderTextColor="#8B9099"
          value={message}
          onChangeText={setMessage}
        />
        <TouchableOpacity
          style={styles.micBtn}
          onPress={() => router.push({ pathname: '/review/recording', params: { ...params, topics: JSON.stringify([...selected]) } })}
        >
          <Ionicons name="mic-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.waveBtn}>
          <Ionicons name="radio-outline" size={22} color="#8B9099" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 56 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 24 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  heading: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { backgroundColor: '#1E2435', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#2A3045' },
  chipActive: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  chipText: { color: '#fff', fontSize: 13 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2E', padding: 14, gap: 10 },
  plusBtn: { padding: 4 },
  chatInput: { flex: 1, color: '#fff', fontSize: 15, height: 40 },
  micBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center' },
  waveBtn: { padding: 4 },
})
