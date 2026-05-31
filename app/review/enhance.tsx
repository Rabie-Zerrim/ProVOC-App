import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { setPendingEnhance } from '../../utils/enhanceStore'

const EMOTIONS = ['😠 Angry', '😕 Confused', '😐 Neutral', '😊 Happy', '🤩 Thrilled']
const ASPECTS = ['🤝 Service', '👥 Staff', '💰 Price', '🏠 Environment', '⭐ Quality', '✨ Cleanliness']
const TONES = [
  { emoji: '🟢', label: 'Neutral', desc: 'Balanced and factual' },
  { emoji: '😊', label: 'Polite', desc: 'Gentle and constructive' },
  { emoji: '⚠️', label: 'Firm', desc: 'Direct and assertive' },
]
const GOALS = [
  { emoji: '🤝', label: 'Praise', desc: 'Celebrate great service' },
  { emoji: '📢', label: 'Awareness', desc: 'Share for others to know' },
  { emoji: '🔧', label: 'Feedback', desc: 'Suggest improvement' },
]

export default function EnhanceScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const [emotion, setEmotion] = useState<string | null>(null)
  const [aspects, setAspects] = useState<Set<string>>(new Set())
  const [tone, setTone] = useState<string | null>(null)
  const [goal, setGoal] = useState<string | null>(null)

  const toggleAspect = (a: string) =>
    setAspects((prev) => { const next = new Set(prev); next.has(a) ? next.delete(a) : next.add(a); return next })

  const enhanceCtx = JSON.stringify({ emotion, aspects: [...aspects], tone, goal })
  const hasSelections = emotion !== null || aspects.size > 0 || tone !== null || goal !== null

  const handleSubmit = () => {
    if (params.review_id && String(params.source) !== 'result') {
      if (hasSelections) setPendingEnhance(enhanceCtx)
      router.back()
    } else {
      router.push({
        pathname: '/review/chat',
        params: hasSelections ? { ...params, enhance_context: enhanceCtx } : { ...params },
      })
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Enhance with AI</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>How did it make you feel?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {EMOTIONS.map((e) => (
            <TouchableOpacity key={e} style={[styles.chip, emotion === e && styles.chipActive]} onPress={() => setEmotion(e)}>
              <Text style={styles.chipText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>What stood out the most</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ASPECTS.map((a) => (
            <TouchableOpacity key={a} style={[styles.chip, aspects.has(a) && styles.chipActive]} onPress={() => toggleAspect(a)}>
              <Text style={styles.chipText}>{a}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Choose your tone</Text>
        <View style={styles.cardRow}>
          {TONES.map((t) => (
            <TouchableOpacity key={t.label} style={[styles.optCard, tone === t.label && styles.optCardActive]} onPress={() => setTone(t.label)}>
              <Text style={styles.optCardEmoji}>{t.emoji}</Text>
              <Text style={styles.optCardTitle}>{t.label}</Text>
              <Text style={styles.optCardDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>What's your goal?</Text>
        <View style={styles.cardRow}>
          {GOALS.map((g) => (
            <TouchableOpacity key={g.label} style={[styles.optCard, goal === g.label && styles.optCardActive]} onPress={() => setGoal(g.label)}>
              <Text style={styles.optCardEmoji}>{g.emoji}</Text>
              <Text style={styles.optCardTitle}>{g.label}</Text>
              <Text style={styles.optCardDesc}>{g.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit}>
          <Text style={styles.btnPrimaryText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 56 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20 },
  sectionLabel: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 16 },
  chipRow: { marginBottom: 4 },
  chip: { backgroundColor: '#1E2435', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#2A3045' },
  chipActive: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  chipText: { color: '#fff', fontSize: 13 },
  cardRow: { flexDirection: 'row', gap: 10 },
  optCard: { flex: 1, backgroundColor: '#1A1F2E', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2A3045', alignItems: 'center' },
  optCardActive: { borderColor: '#2D6A4F' },
  optCardEmoji: { fontSize: 20, marginBottom: 6 },
  optCardTitle: { color: '#fff', fontSize: 12, fontWeight: '700', marginBottom: 3 },
  optCardDesc: { color: '#8B9099', fontSize: 10, textAlign: 'center' },
  bottomBar: { flexDirection: 'row', padding: 20, gap: 12 },
  btnSecondary: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center' },
  btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
