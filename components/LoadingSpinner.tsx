import { View, ActivityIndicator, StyleSheet } from 'react-native'

export default function LoadingSpinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#2D6A4F" size="large" />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})
