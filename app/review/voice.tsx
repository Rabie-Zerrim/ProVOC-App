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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Provoc Voice</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>How would you describe{'\n'}your experience?</Text>
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

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* Ask anything input pill */}
        <View style={styles.inputPill}>
          <Ionicons name="keypad-outline" size={20} color="#8B9099" />
          <TextInput
            style={styles.chatInput}
            placeholder="Ask anything..."
            placeholderTextColor="#8B9099"
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity style={styles.sendBtn}>
            <Ionicons name="send" size={18} color="#2D6A4F" />
          </TouchableOpacity>
        </View>

        {/* Tap to speak green pill */}
        <TouchableOpacity
          style={styles.speakBtn}
          onPress={() => router.push({ pathname: '/review/recording', params: { ...params, topics: JSON.stringify([...selected]) } })}
          activeOpacity={0.85}
        >
          <Ionicons name="radio-outline" size={22} color="#fff" />
          <Text style={styles.speakBtnText}>Tap to speak</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 56 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 24,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 200 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 24, textAlign: 'center', lineHeight: 28 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: '#1E2435', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: '#2A3045',
  },
  chipActive: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16, gap: 12,
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1, borderTopColor: '#1A1F2E',
  },
  inputPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1F2E', borderRadius: 28,
    paddingHorizontal: 18, paddingVertical: 10, gap: 10,
  },
  chatInput: { flex: 1, color: '#fff', fontSize: 15 },
  sendBtn: { padding: 4 },
  speakBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#2D6A4F', borderRadius: 28,
    paddingVertical: 14,
  },
  speakBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
