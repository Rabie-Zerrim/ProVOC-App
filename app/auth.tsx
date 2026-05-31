import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from '../services/api'

type Mode = 'login' | 'register'

export default function AuthScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    if (mode === 'register' && !displayName) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const body =
        mode === 'login'
          ? { email, password }
          : { email, password, display_name: displayName }

      const { data } = await api.post(endpoint, body)
      await AsyncStorage.setItem('@provoc_token', data.access_token)
      if (data.user) {
        await AsyncStorage.setItem('@provoc_user', JSON.stringify(data.user))
      }
      router.replace('/(tabs)/home')
    } catch (err: any) {
      if (!err?.response) {
        setError('Cannot reach server. Check your connection.')
      } else {
        const msg =
          err.response.data?.message ||
          (mode === 'login' ? 'Invalid email or password.' : 'Registration failed.')
        setError(Array.isArray(msg) ? msg.join(', ') : msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Green circle decoration */}
      <View style={styles.greenCircle} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Top area */}
          <View style={styles.topArea}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* White card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Set up your account</Text>
            <Text style={styles.subtitle}>
              Login to enjoy the best review experience
            </Text>

            {/* Toggle tabs */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleTab, mode === 'login' && styles.toggleTabActive]}
                onPress={() => { setMode('login'); setError('') }}
              >
                <Text style={[styles.toggleTabText, mode === 'login' && styles.toggleTabTextActive]}>
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleTab, mode === 'register' && styles.toggleTabActive]}
                onPress={() => { setMode('register'); setError('') }}
              >
                <Text style={[styles.toggleTabText, mode === 'register' && styles.toggleTabTextActive]}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {/* Display name (register only) */}
            {mode === 'register' && (
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#8B9099" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#8B9099"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#8B9099" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#8B9099"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#8B9099" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#8B9099"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#8B9099"
                />
              </TouchableOpacity>
            </View>

            {/* Remember me / Forgot password */}
            {mode === 'login' && (
              <View style={styles.rememberRow}>
                <Text style={styles.rememberText}>Remember me</Text>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </View>
            )}

            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  flex: { flex: 1 },
  greenCircle: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#2D6A4F',
    opacity: 0.6,
  },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  topArea: { padding: 20, paddingTop: 60 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 48,
  },
  heading: { fontSize: 24, fontWeight: '700', color: '#0D0D0D', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8B9099', marginBottom: 24 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleTabActive: { backgroundColor: '#fff' },
  toggleTabText: { fontSize: 14, fontWeight: '500', color: '#8B9099' },
  toggleTabTextActive: { color: '#0D0D0D', fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#0D0D0D' },
  eyeBtn: { padding: 4 },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rememberText: { fontSize: 13, color: '#8B9099' },
  forgotText: { fontSize: 13, color: '#2D6A4F', fontWeight: '600' },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  submitBtn: {
    backgroundColor: '#2D6A4F',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
