import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Switch, Image, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import Svg, { Circle, G } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import api from '../../services/api'
import { withNetworkErrorRetry } from '../../utils/withNetworkErrorRetry'

type User = { user_id: string; email: string; display_name: string; avatar_data?: string | null }

type DashboardSummary = {
  total_reviews: number
  by_status: { draft: number; pending: number; published: number; posted: number }
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

const DASHBOARD_STATUS_META: { label: string; color: string }[] = [
  { label: 'Draft',   color: '#8B9099' },
  { label: 'Pending', color: '#FFB800' },
  { label: 'Posted',  color: '#22C55E' },
]

// Simple stroke-dasharray ring chart — avoids hand-built arc-path geometry,
// which is fiddlier to get pixel-correct than this standard SVG technique.
function DonutChart({
  data, size = 110, strokeWidth = 16,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number
  strokeWidth?: number
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius

  if (total === 0) {
    return (
      <View style={[styles.donutEmpty, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.donutEmptyText}>No data</Text>
      </View>
    )
  }

  let offset = 0
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${cx}, ${cy}`}>
        {data.map((d) => {
          if (d.value === 0) return null
          const segmentLength = (d.value / total) * circumference
          const dashOffset = -offset
          offset += segmentLength
          return (
            <Circle
              key={d.label}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={dashOffset}
              fill="none"
            />
          )
        })}
      </G>
    </Svg>
  )
}

const PLATFORMS_KEY = '@provoc_platforms'
const AVATAR_KEY = '@provoc_avatar'

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [user, setUser] = useState<User | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<string, boolean>>({
    google: true, yelp: true, tripadvisor: false, facebook: false, trustpilot: false,
  })
  const [avatarUri, setAvatarUri] = useState<string | null>(null)

  // Unified edit-profile modal state
  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [profileError, setProfileError] = useState('')       // 409 shown under email
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPasswordError, setCurrentPasswordError] = useState('') // 401
  const [passwordError, setPasswordError] = useState('')     // mismatch / length / generic
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const raw = await AsyncStorage.getItem('@provoc_user')
      let cachedUser: User | null = null
      if (raw) {
        cachedUser = JSON.parse(raw)
        setUser(cachedUser)
        if (!cachedUser?.display_name || cachedUser.avatar_data === undefined) fetchMe()
      } else {
        fetchMe()
      }
      const plRaw = await AsyncStorage.getItem(PLATFORMS_KEY)
      if (plRaw) setEnabledPlatforms(JSON.parse(plRaw))
      // avatar_data from the synced user record is the real source of truth;
      // the local AsyncStorage avatar is only a fallback for offline-first
      // display or for users cached before this field existed.
      const savedAvatar = await AsyncStorage.getItem(AVATAR_KEY)
      if (cachedUser?.avatar_data) {
        setAvatarUri(cachedUser.avatar_data)
      } else if (savedAvatar) {
        setAvatarUri(savedAvatar)
      }
    }
    load()
  }, [])

  const fetchMe = async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
      await AsyncStorage.setItem('@provoc_user', JSON.stringify(data))
      if (data.avatar_data) {
        setAvatarUri(data.avatar_data)
        await AsyncStorage.setItem(AVATAR_KEY, data.avatar_data)
      }
    } catch {}
  }

  useEffect(() => {
    setLoading(true)
    api.get('/reviews/dashboard')
      .then(({ data }) => setDashboard(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // preferred_networks is the list of currently ENABLED platform slugs
  // (toggle ON = included in the array), per UpdatePreferencesDto.
  useEffect(() => {
    api.get('/users/me/preferences')
      .then(({ data }) => {
        const enabled: string[] = data?.preferred_networks ?? []
        const next: Record<string, boolean> = {}
        PLATFORMS.forEach((p) => { next[p.key] = enabled.includes(p.key) })
        setEnabledPlatforms(next)
        AsyncStorage.setItem(PLATFORMS_KEY, JSON.stringify(next))
      })
      .catch(() => {})
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
      base64: true,
    })
    if (result.canceled || !result.assets[0]?.base64) return
    const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`
    try {
      await api.patch('/users/me/avatar', { avatar_data: dataUri })
      setAvatarUri(dataUri)
      await AsyncStorage.setItem(AVATAR_KEY, dataUri)
      if (user) {
        const updatedUser = { ...user, avatar_data: dataUri }
        setUser(updatedUser)
        await AsyncStorage.setItem('@provoc_user', JSON.stringify(updatedUser))
      }
    } catch {
      Alert.alert('Could not update avatar', 'Please try again.')
    }
  }

  const openEditModal = () => {
    setEditName(user?.display_name ?? '')
    setEditEmail(user?.email ?? '')
    setProfileError('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setCurrentPasswordError('')
    setPasswordError('')
    setEditingProfile(true)
  }

  const closeEditModal = () => {
    setEditingProfile(false)
    setProfileError('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setCurrentPasswordError('')
    setPasswordError('')
  }

  const handleSave = async () => {
    setProfileError('')
    setCurrentPasswordError('')
    setPasswordError('')

    const trimmedName = editName.trim()
    const trimmedEmail = editEmail.trim()
    const profilePayload: { display_name?: string; email?: string } = {}
    if (trimmedName && trimmedName !== user?.display_name) profilePayload.display_name = trimmedName
    if (trimmedEmail && trimmedEmail !== user?.email) profilePayload.email = trimmedEmail

    const changingPassword = !!(currentPassword || newPassword || confirmPassword)

    if (changingPassword) {
      if (newPassword.length < 8) {
        setPasswordError('Password must be at least 8 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match.')
        return
      }
    }

    if (Object.keys(profilePayload).length === 0 && !changingPassword) {
      closeEditModal()
      return
    }

    setSaving(true)
    try {
      if (Object.keys(profilePayload).length > 0) {
        // PATCH /users/me — body: { display_name?, email? }
        // JWT attached automatically by api interceptor (services/api.ts)
        // 409 → email conflict
        const { data } = await api.patch('/users/me', profilePayload)
        const updatedUser = { ...user, ...data }
        setUser(updatedUser)
        await AsyncStorage.setItem('@provoc_user', JSON.stringify(updatedUser))
      }

      if (changingPassword) {
        await api.patch('/users/me/password', {
          current_password: currentPassword,
          new_password: newPassword,
        })
      }

      closeEditModal()
      if (changingPassword) {
        Alert.alert('Password changed', 'Your password has been updated.')
      }
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setProfileError('Email already in use.')
      } else if (err?.response?.status === 401) {
        setCurrentPasswordError('Current password is incorrect.')
      } else {
        setPasswordError('Could not save changes. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const togglePlatform = async (key: string, val: boolean) => {
    const next = { ...enabledPlatforms, [key]: val }
    setEnabledPlatforms(next)
    await AsyncStorage.setItem(PLATFORMS_KEY, JSON.stringify(next))
    const enabledSlugs = PLATFORMS.filter((p) => next[p.key]).map((p) => p.key)
    try {
      await withNetworkErrorRetry(() => api.patch('/users/me/preferences', { preferred_networks: enabledSlugs }))
    } catch {
      // Soft-fail — local toggle already applied; next preferences fetch
      // will reconcile if this write didn't actually stick server-side.
    }
  }

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove([
              '@provoc_token',
              '@provoc_user',
              '@provoc_avatar',
              '@provoc_pins',
              '@provoc_platforms',
              '@provoc_pinned_drafts',
            ])
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
    <>
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
            <View style={styles.userNameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.display_name || user?.email || '—'}</Text>
                <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
              </View>
              <TouchableOpacity onPress={openEditModal} hitSlop={8}>
                <Ionicons name="create-outline" size={16} color="#8B9099" />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Stats dashboard — placed right after identity info and before
            account-management actions (password/platforms), so "who you are"
            is immediately followed by "your activity" before settings. */}
        <View style={styles.dashboardCard}>
          <View style={styles.dashboardChartRow}>
            {(() => {
              const byStatus = dashboard?.by_status
              const postedCount = (byStatus?.posted ?? 0) + (byStatus?.published ?? 0)
              const chartData = [
                { label: 'Draft',   value: byStatus?.draft   ?? 0, color: '#8B9099' },
                { label: 'Pending', value: byStatus?.pending ?? 0, color: '#FFB800' },
                { label: 'Posted',  value: postedCount,             color: '#22C55E' },
              ]
              return (
                <>
                  <DonutChart data={chartData} />
                  <View style={styles.dashboardLegend}>
                    {chartData.map((m) => (
                      <View key={m.label} style={styles.legendRow}>
                        <View style={[styles.legendSwatch, { backgroundColor: m.color }]} />
                        <Text style={styles.legendLabel}>{m.label}</Text>
                        <Text style={styles.legendCount}>{m.value}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )
            })()}
          </View>
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

      {/* Edit Profile Modal — name, email, and optional password change in one place */}
      <Modal
        visible={editingProfile}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKAV}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                <Text style={styles.modalTitle}>Edit Profile</Text>

                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Display name"
                  placeholderTextColor="#8B9099"
                  autoFocus
                />
                <TextInput
                  style={styles.modalInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Email"
                  placeholderTextColor="#8B9099"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {!!profileError && <Text style={styles.modalError}>{profileError}</Text>}

                <View style={styles.modalDivider} />
                <Text style={styles.modalSectionLabel}>Change password</Text>

                <TextInput
                  style={styles.modalInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Current password"
                  placeholderTextColor="#8B9099"
                  secureTextEntry
                />
                {!!currentPasswordError && <Text style={styles.modalError}>{currentPasswordError}</Text>}
                <TextInput
                  style={styles.modalInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  placeholderTextColor="#8B9099"
                  secureTextEntry
                />
                <TextInput
                  style={styles.modalInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#8B9099"
                  secureTextEntry
                />
                {!!passwordError && <Text style={styles.modalError}>{passwordError}</Text>}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={closeEditModal}
                    style={styles.modalCancelBtn}
                    disabled={saving}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    style={styles.modalSaveBtn}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userEmail: { color: '#8B9099', fontSize: 12 },
  logoutBtn: { padding: 8 },

  dashboardCard: {
    backgroundColor: '#1A1F2E', borderRadius: 16, padding: 16, marginBottom: 14,
  },
  dashboardChartRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 16 },
  dashboardLegend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: '#C0C6D4', fontSize: 12 },
  legendCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  donutEmpty: { borderWidth: 16, borderColor: '#2A3045', justifyContent: 'center', alignItems: 'center' },
  donutEmptyText: { color: '#8B9099', fontSize: 11 },

  section: { backgroundColor: '#1A1F2E', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { color: '#8B9099', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  platformRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#0D0D0D' },
  platformDot: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  platformName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },

  // Modal
  modalKAV: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalInput: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: '#0D0D0D',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3045',
  },
  modalError: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 12,
    marginTop: -4,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#2A3045',
    marginBottom: 16,
    marginTop: 4,
  },
  modalSectionLabel: {
    color: '#8B9099',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#2A3045',
  },
  modalCancelText: {
    color: '#8B9099',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
