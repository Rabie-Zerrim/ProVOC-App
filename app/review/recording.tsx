import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../services/api'
import { setPendingTranscript } from '../../utils/enhanceStore'

const MAX_SECONDS = 60

export default function RecordingScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    listing_id: string; business_name: string; rating: string
    network_ids: string; review_id: string
  }>()
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [uploading, setUploading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const insets = useSafeAreaInsets()

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow microphone access.')
        return
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(rec)
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e >= MAX_SECONDS - 1) {
            stopAndTranscribe()
            return e
          }
          return e + 1
        })
      }, 1000)
    } catch {
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.')
    }
  }

  const stopAndTranscribe = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (!recording) {
      router.push({ pathname: '/review/chat', params })
      return
    }
    setUploading(true)
    let rec = recording
    setRecording(null)
    try {
      await rec.stopAndUnloadAsync()
      const uri = rec.getURI()

      let reviewId = params.review_id
      if (!reviewId) {
        const { data } = await api.post('/reviews', {
          listing_id: params.listing_id,
          review_text: ' ',
          rating: Number(params.rating) || 4,
          tone: 'neutral',
          language: 'en',
        })
        reviewId = data.review_id ?? data.id
      }

      if (!uri) throw new Error('Recording file not found')

      const formData = new FormData()
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any)
      formData.append('language', 'en')

      const response = await api.post(
        `/reviews/${reviewId}/transcribe`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
      )
      const transcript = response.data.text ?? response.data.transcript ?? ''
      if (params.review_id) {
        // Already in an existing chat — go back and inject the transcript there
        setPendingTranscript(transcript)
        router.back()
      } else {
        router.push({
          pathname: '/review/chat',
          params: { ...params, review_id: reviewId, transcript },
        })
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error'
      const isNetworkErr = !err?.response
      Alert.alert(
        isNetworkErr ? 'Server unreachable' : 'Transcription failed',
        isNetworkErr
          ? 'Cannot connect to the server. Make sure you are on the same Wi-Fi as the server, or run: adb reverse tcp:3001 tcp:3001\n\nYou can still type your review manually.'
          : String(Array.isArray(msg) ? msg[0] : msg),
        [
          { text: 'Type instead', onPress: () => router.push({ pathname: '/review/chat', params }) },
          { text: 'Retry', onPress: () => setUploading(false) },
        ],
      )
      if (!isNetworkErr) setUploading(false)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      {/* Close */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Provoc logo */}
      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Ionicons name="star" size={32} color="#fff" />
        </View>
        <Text style={styles.logoText}>Provoc</Text>
      </View>

      {/* Heading + tip */}
      <View style={styles.textArea}>
        <Text style={styles.heading}>Speak your review</Text>
        <Text style={styles.tip}>
          Share your experience naturally — we'll turn it into a polished review
        </Text>
      </View>

      {/* Timer */}
      <View style={styles.timerArea}>
        {recording ? (
          <>
            <View style={styles.recordingDot} />
            <Text style={styles.timerText}>{fmtTime(elapsed)}</Text>
            <Text style={styles.timerMax}>/ {fmtTime(MAX_SECONDS)}</Text>
          </>
        ) : (
          <Text style={styles.timerPlaceholder}>Ready to record</Text>
        )}
      </View>

      {/* Record button */}
      <View style={styles.recordArea}>
        <TouchableOpacity
          style={[styles.recordBtn, recording && styles.recordBtnActive]}
          onPress={recording ? stopAndTranscribe : startRecording}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <Ionicons
              name={recording ? 'stop' : 'mic'}
              size={48}
              color="#fff"
            />
          )}
        </TouchableOpacity>
        <Text style={styles.tapLabel}>
          {uploading
            ? 'Processing...'
            : recording
            ? 'Tap to stop'
            : 'Tap to speak (01 min max)'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
  },

  closeBtn: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1F2E',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoArea: {
    marginTop: 32,
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2D6A4F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },

  textArea: {
    marginTop: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 10,
  },
  heading: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  tip: {
    color: '#8B9099',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },

  timerArea: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 30,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  timerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerMax: {
    color: '#8B9099',
    fontSize: 16,
  },
  timerPlaceholder: {
    color: '#3A3F4B',
    fontSize: 14,
  },

  recordArea: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 20,
    paddingBottom: 8,
  },
  recordBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  recordBtnActive: {
    backgroundColor: '#B91C1C',
    shadowOpacity: 0.3,
  },
  tapLabel: {
    color: '#8B9099',
    fontSize: 13,
    textAlign: 'center',
  },
})
