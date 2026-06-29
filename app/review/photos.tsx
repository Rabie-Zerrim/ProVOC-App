import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import api from '../../services/api'

type UploadedPhoto = { media_id: string; url: string; uri: string }

export default function PhotosScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ review_id?: string }>()
  const reviewId = String(params.review_id ?? '')

  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState<Set<string>>(new Set())

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

      const { data } = await api.post(`/reviews/${reviewId}/media`, formData, {
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

  const pickImage = async () => {
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

  const isUploading = uploading.size > 0

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
        <TouchableOpacity style={styles.uploadArea} onPress={pickImage} disabled={isUploading}>
          <Ionicons name="camera-outline" size={40} color="#8B9099" />
          <Text style={styles.uploadText}>Upload photo</Text>
          <Text style={styles.uploadHint}>Tap to select from your gallery</Text>
        </TouchableOpacity>

        {photos.length > 0 && (
          <View style={styles.thumbGrid}>
            {photos.map((photo) => {
              const busy = uploading.has(photo.uri)
              return (
                <View key={photo.uri} style={styles.thumbWrapper}>
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
                </View>
              )
            })}
          </View>
        )}

        <Text style={styles.disclaimer}>
          By uploading photos you agree to our{' '}
          <Text style={styles.link}>Terms of Use</Text>
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, isUploading && styles.btnDisabled]}
          disabled={isUploading}
          onPress={() => router.push({ pathname: '/review/thankyou', params })}
        >
          <Text style={styles.btnPrimaryText}>{photos.length > 0 ? 'Next' : 'Skip'}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
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
    height: 180, justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  uploadText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  uploadHint: { color: '#8B9099', fontSize: 12 },
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
})
