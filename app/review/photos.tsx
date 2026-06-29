import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Alert, ActivityIndicator, Modal, Pressable, Dimensions,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import api from '../../services/api'

const { width: SCREEN_W } = Dimensions.get('window')

type UploadedPhoto = { media_id: string; url: string; uri: string }

export default function PhotosScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ review_id?: string }>()
  const reviewId = String(params.review_id ?? '')

  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState<Set<string>>(new Set())
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  const refreshMedia = async () => {
    if (!reviewId) return
    try {
      const { data } = await api.get(`/reviews/${reviewId}/media`)
      const serverList: UploadedPhoto[] = (Array.isArray(data) ? data : (data?.data ?? []))
        .map((m: any) => ({ media_id: m.media_id, url: m.url, uri: m.url }))
      setPhotos(prev => {
        const stillUploading = prev.filter(p => !p.media_id)
        return [...serverList, ...stillUploading]
      })
    } catch {}
  }

  useEffect(() => { refreshMedia() }, [])

  const uploadPhoto = async (uri: string) => {
    if (!reviewId) {
      Alert.alert('Error', 'No review ID — please go back and try again.')
      return
    }

    setPhotos(prev => [...prev, { media_id: '', url: uri, uri }])
    setUploading(prev => new Set(prev).add(uri))

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )
      const uploadUri = manipResult.uri

      const formData = new FormData()
      formData.append('photo', { uri: uploadUri, type: 'image/jpeg', name: 'photo.jpg' } as any)

      await api.post(`/reviews/${reviewId}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })

      await refreshMedia()
    } catch {
      setPhotos(prev => prev.filter(p => p.uri !== uri))
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.')
    } finally {
      setUploading(prev => {
        const next = new Set(prev)
        next.delete(uri)
        return next
      })
    }
  }

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      result.assets.forEach(asset => uploadPhoto(asset.uri))
    }
  }

  const pickSingle = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return null
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    })
    if (result.canceled) return null
    return result.assets[0]?.uri ?? null
  }

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri)
    }
  }

  const removePhoto = async (photo: UploadedPhoto) => {
    if (!photo.media_id) {
      setPhotos(prev => prev.filter(p => p.uri !== photo.uri))
      return
    }
    try {
      await api.delete(`/reviews/${reviewId}/media/${photo.media_id}`)
      setPhotos(prev => prev.filter(p => p.uri !== photo.uri))
    } catch {
      Alert.alert('Error', 'Could not remove photo. Please try again.')
    }
  }

  const replacePhoto = async (idx: number) => {
    setPreviewIdx(null)
    const photo = photos[idx]
    if (!photo) return
    const uri = await pickSingle()
    if (!uri) return
    await removePhoto(photo)
    uploadPhoto(uri)
  }

  const isUploading = uploading.size > 0
  const previewPhotos = photos.filter(p => !!p.url)

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Share photos</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Gallery upload area */}
        <TouchableOpacity style={styles.uploadArea} onPress={pickFromGallery} disabled={isUploading}>
          <Ionicons name="image-outline" size={40} color="#8B9099" />
          <Text style={styles.uploadText}>Tap to upload photo</Text>
          <View style={styles.uploadBtn}>
            <Text style={styles.uploadBtnText}>Upload photo</Text>
          </View>
        </TouchableOpacity>

        {/* OR separator */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        {/* Camera button */}
        <TouchableOpacity style={styles.cameraBtn} onPress={openCamera} disabled={isUploading}>
          <Ionicons name="camera-outline" size={22} color="#fff" />
          <Text style={styles.cameraBtnText}>Open camera & take photos</Text>
        </TouchableOpacity>

        {/* Legal disclaimer */}
        <Text style={styles.disclaimer}>
          By uploading this photo, I verify that I am the owner of this content and accept Provoc's{' '}
          <Text style={styles.link}>Terms of Use</Text>.
        </Text>

        {/* Thumbnails grid */}
        {photos.length > 0 && (
          <View style={styles.thumbGrid}>
            {photos.map((photo, idx) => {
              const busy = uploading.has(photo.uri)
              return (
                <TouchableOpacity
                  key={photo.uri}
                  style={styles.thumbWrapper}
                  onPress={() => !busy && setPreviewIdx(idx)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: photo.uri }} style={styles.thumb} />
                  {busy ? (
                    <View style={styles.thumbOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(photo)}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, isUploading && styles.btnDisabled]}
          disabled={isUploading}
          onPress={() => router.push({ pathname: '/review/result', params })}
        >
          <Text style={styles.btnPrimaryText}>{photos.length > 0 ? 'Next' : 'Skip'}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Fullscreen preview modal */}
      <Modal
        visible={previewIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIdx(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewIdx(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>

          {previewIdx !== null && previewPhotos[previewIdx] && (
            <Image
              source={{ uri: previewPhotos[previewIdx].uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}

          {/* Left / Right navigation */}
          <View style={styles.previewNav}>
            <TouchableOpacity
              style={[styles.previewArrow, previewIdx === 0 && styles.previewArrowDisabled]}
              onPress={() => setPreviewIdx(i => (i !== null && i > 0 ? i - 1 : i))}
              disabled={previewIdx === 0}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.replaceBtn}
              onPress={() => previewIdx !== null && replacePhoto(previewIdx)}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
              <Text style={styles.replaceBtnText}>Replace Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.previewArrow, previewIdx === previewPhotos.length - 1 && styles.previewArrowDisabled]}
              onPress={() => setPreviewIdx(i => (i !== null && i < previewPhotos.length - 1 ? i + 1 : i))}
              disabled={previewIdx === previewPhotos.length - 1}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {previewPhotos.length > 1 && previewIdx !== null && (
            <Text style={styles.previewCounter}>
              {previewIdx + 1} / {previewPhotos.length}
            </Text>
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 56 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  content: { padding: 20 },

  uploadArea: {
    borderWidth: 2, borderColor: '#2A3045', borderStyle: 'dashed', borderRadius: 16,
    height: 180, justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  uploadText: { color: '#8B9099', fontSize: 14 },
  uploadBtn: {
    backgroundColor: '#1A1F2E', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8,
  },
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#2A3045' },
  orText: { color: '#8B9099', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#2D6A4F', borderRadius: 14, paddingVertical: 14, marginBottom: 24,
  },
  cameraBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  thumbWrapper: { width: 90, height: 90, borderRadius: 10, overflow: 'visible' },
  thumb: { width: 90, height: 90, borderRadius: 10 },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: { position: 'absolute', top: -8, right: -8 },

  disclaimer: { color: '#8B9099', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  link: { color: '#2D6A4F', fontWeight: '600' },

  bottomBar: { flexDirection: 'row', padding: 20, gap: 12 },
  btnSecondary: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center' },
  btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  /* Fullscreen preview */
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewClose: {
    position: 'absolute', top: 52, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  previewImage: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  previewNav: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    position: 'absolute', bottom: 80,
  },
  previewArrow: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewArrowDisabled: { opacity: 0.3 },
  replaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2D6A4F', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  replaceBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  previewCounter: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600',
    position: 'absolute', bottom: 48,
  },
})
