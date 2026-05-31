import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Switch, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import api from '../../services/api'

type User = { user_id: string; email: string; display_name: string }

type Stats = { average_rating: number | null; this_month: number; last_month: number }

type DashboardSummary = {
  total_reviews: number
  by_status: { draft: number; pending: number; published: number; simulated: number }
}

const PLATFORMS = [
  { key: 'google',      label: 'Google',      color: '#4285F4', icon: 'google'      },
  { key: 'yelp',        label: 'Yelp',        color: '#FF1A1A', icon: 'yelp'        },
  { key: 'tripadvisor', label: 'TripAdvisor', color: '#00AA6C', icon: 'tripadvisor' },
  { key: 'facebook',    label: 'Facebook',    color: '#1877F2', icon: 'facebook'    },
  { key: 'trustpilot',  label: 'Trustpilot',  color: '#00B67A', icon: null          },
]

function PlatformIcon({ icon, color, size = 15 }: { icon: string | null; color: string; size?: number }) {
  if (icon) return <FontAwesome name={icon as any} size={size} color="#fff" />
  return <Ionicons name="star" size={size} color="#fff" />
}

const PLATFORMS_KEY = '@provoc_platforms'
const AVATAR_KEY = '@provoc_avatar'

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<string, boolean>>({
    google: true, yelp: true, tripadvisor: false, facebook: false, trustpilot: false,
  })
  const [avatarUri, setAvatarUri] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const raw = await AsyncStorage.getItem('@provoc_user')
      if (raw) {
        const stored = JSON.parse(raw)
        setUser(stored)
        if (!stored.display_name) fetchMe()
      } else {
        fetchMe()
      }
      const plRaw = await AsyncStorage.getItem(PLATFORMS_KEY)
      if (plRaw) setEnabledPlatforms(JSON.parse(plRaw))
      const savedAvatar = await AsyncStorage.getItem(AVATAR_KEY)
      if (savedAvatar) setAvatarUri(savedAvatar)
    }
    load()
  }, [])

  const fetchMe = async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
      await AsyncStorage.setItem('@provoc_user', JSON.stringify(data))
    } catch {}
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/reviews/stats'),
      api.get('/reviews/dashboard'),
    ])
      .then(([statsRes, dashRes]) => {
        setStats(statsRes.data)
        setDashboard(dashRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a profile picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri
      setAvatarUri(uri)
      await AsyncStorage.setItem(AVATAR_KEY, uri)
    }
  }

  const togglePlatform = async (key: string, val: boolean) => {
    const next = { ...enabledPlatforms, [key]: val }
    setEnabledPlatforms(next)
    await AsyncStorage.setItem(PLATFORMS_KEY, JSON.stringify(next))
  }

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['@provoc_token', '@provoc_user'])
          router.replace('/auth')
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2D6A4F" size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* User card */}
      <View style={styles.userCard}>
        <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.display_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'P'}
              </Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={11} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.display_name || user?.email || '—'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { val: String(dashboard?.total_reviews ?? 0), label: 'Total' },
          { val: String(stats?.this_month ?? 0), label: 'This month' },
          { val: stats?.average_rating != null ? stats.average_rating.toFixed(1) : '—', label: 'Avg ⭐', color: '#FFB800' },
          { val: String(dashboard?.by_status.published ?? 0), label: 'Published', color: '#2D6A4F' },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statNum, s.color ? { color: s.color } : {}]}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Platforms */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Review platforms</Text>
        {PLATFORMS.map((p) => (
          <View key={p.key} style={styles.platformRow}>
            <View style={[styles.platformDot, { backgroundColor: p.color }]}>
              <PlatformIcon icon={p.icon} color={p.color} />
            </View>
            <Text style={styles.platformName}>{p.label}</Text>
            <Switch
              value={enabledPlatforms[p.key] ?? false}
              onValueChange={(v) => togglePlatform(p.key, v)}
              trackColor={{ false: '#2A3045', true: '#2D6A4F' }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1F2E',
    borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 14, gap: 12,
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#1A1F2E',
  },
  userInfo: { flex: 1 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userEmail: { color: '#8B9099', fontSize: 12 },
  logoutBtn: { padding: 8 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#1A1F2E', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  statLabel: { color: '#8B9099', fontSize: 10 },

  section: { backgroundColor: '#1A1F2E', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { color: '#8B9099', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  platformRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#0D0D0D' },
  platformDot: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  platformName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
})
