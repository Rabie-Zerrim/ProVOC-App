import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function ThankYouScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        {/* Outlined thumbs-up in green circle */}
        <View style={styles.iconCircle}>
          <Ionicons name="thumbs-up-outline" size={56} color="#2D6A4F" />
        </View>

        <Text style={styles.heading}>Thank you</Text>
        <Text style={styles.subtitle}>
          Your review has been successfully{'\n'}submitted. Thank you for sharing!
        </Text>
      </View>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace('/(tabs)/home')}
      >
        <Text style={styles.homeBtnText}>Go back home</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0D0D0D',
    paddingTop: 56, paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20,
  },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, borderColor: '#2D6A4F',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0D1A14',
    marginBottom: 8,
  },
  heading: {
    color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center',
  },
  subtitle: {
    color: '#8B9099', fontSize: 15, textAlign: 'center', lineHeight: 23,
  },
  homeBtn: {
    backgroundColor: '#2D6A4F', borderRadius: 14,
    height: 54, justifyContent: 'center', alignItems: 'center',
  },
  homeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
