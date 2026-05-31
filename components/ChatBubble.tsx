import { View, Text, StyleSheet } from 'react-native'

type Props = { role: 'ai' | 'user'; text: string }

export default function ChatBubble({ role, text }: Props) {
  return (
    <View style={[styles.bubble, role === 'user' ? styles.userBubble : styles.aiBubble]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 10 },
  aiBubble: { backgroundColor: '#1A1F2E', alignSelf: 'flex-start' },
  userBubble: { backgroundColor: '#2A3045', alignSelf: 'flex-end' },
  text: { color: '#fff', fontSize: 14, lineHeight: 20 },
})
