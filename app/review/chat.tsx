import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../services/api'
import { takePendingEnhance, takePendingTranscript } from '../../utils/enhanceStore'

type ChatHistoryItem = { message_id: string; review_id: string; role: string; content: string; created_at: string }
type Message = { id: string; role: 'ai' | 'user'; text: string }
type FlatItem = Message | { id: string; kind: 'divider' }

function ProvocAvatar() {
  return (
    <View style={styles.aiAvatar}>
      <Ionicons name="star" size={14} color="#fff" />
    </View>
  )
}

export default function ChatScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    listing_id: string; business_name: string; rating: string
    review_id: string; transcript: string; network_ids: string
    address: string; business_type: string; breakdown: string
    enhance_context: string
  }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [historyMessages, setHistoryMessages] = useState<Message[]>([])
  const [historyLoading, setHistoryLoading] = useState(!!params.review_id)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(params.review_id ?? null)
  const [generatedReview, setGeneratedReview] = useState<string | null>(null)
  const [businessAddress, setBusinessAddress] = useState<string>(params.address ?? '')
  const [editingReview, setEditingReview] = useState(false)
  const [editReviewText, setEditReviewText] = useState('')
  const [rephrasing, setRephrasing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [initError, setInitError] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const flatRef = useRef<FlatList>(null)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => { initChat() }, [])

  useFocusEffect(useCallback(() => {
    const sendToAI = async (msg: string) => {
      if (!reviewId) return
      addMessage('user', msg)
      setLoading(true)
      try {
        let sid = sessionId
        if (!sid) {
          const { data: startData } = await api.post(
            `/reviews/${reviewId}/chat/start`,
            { listing_context: { business_name: params.business_name, networks: [] }, language: 'en' },
            { timeout: 60000 }
          )
          sid = startData.session_id
          setSessionId(sid)
        }
        try {
          const { data } = await api.post(
            `/reviews/${reviewId}/chat/message`,
            { session_id: sid, message: msg },
            { timeout: 60000 }
          )
          const reply = data.message ?? data.response ?? data.reply ?? data.text
          addMessage('ai', reply ?? 'Could not get response.')
        } catch {
          // Session expired mid-conversation — restart and retry
          const { data: resumeData } = await api.post(
            `/reviews/${reviewId}/chat/start`,
            { listing_context: { business_name: params.business_name, networks: [] }, language: 'en' },
            { timeout: 60000 }
          )
          sid = resumeData.session_id
          setSessionId(sid)
          const history = messagesRef.current
            .filter(m => !['ai-initial', 'fallback'].includes(m.id))
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
            .join('\n')
          if (history) {
            await api.post(`/reviews/${reviewId}/chat/message`,
              { session_id: sid, message: `Previous conversation:\n${history}` },
              { timeout: 60000 }
            ).catch(() => {})
          }
          const { data: retryData } = await api.post(
            `/reviews/${reviewId}/chat/message`,
            { session_id: sid, message: msg },
            { timeout: 60000 }
          )
          const reply = retryData.message ?? retryData.response ?? retryData.reply ?? retryData.text
          addMessage('ai', reply ?? 'Could not get response.')
        }
      } catch {
        addMessage('ai', 'Sorry, something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    const ctx = takePendingEnhance()
    if (ctx && reviewId) {
      try {
        const parsed = JSON.parse(ctx)
        const parts: string[] = []
        if (parsed.emotion) parts.push(`I felt ${parsed.emotion.replace(/^.*\s/, '')} about my experience`)
        if (parsed.aspects?.length) parts.push(`Key aspects: ${parsed.aspects.map((a: string) => a.replace(/^.*\s/, '')).join(', ')}`)
        if (parsed.tone) parts.push(`Please use a ${parsed.tone} tone`)
        if (parsed.goal) parts.push(`My goal is to ${parsed.goal.toLowerCase()}`)
        sendToAI(parts.join('. ') + '.')
      } catch {}
    }

    const transcript = takePendingTranscript()
    if (transcript && reviewId) {
      setVoiceMode(false)
      sendToAI(transcript)
    }
  }, [sessionId, reviewId]))

  const initChat = async () => {
    let rid = reviewId

    // Fetch persisted chat history when continuing a draft review
    if (rid) {
      try {
        const { data: histData } = await api.get(`/reviews/${rid}/chat/history`, { timeout: 30000 })
        if (Array.isArray(histData) && histData.length > 0) {
          setHistoryMessages(
            histData.map((m: ChatHistoryItem) => ({
              id: m.message_id,
              role: (m.role === 'assistant' ? 'ai' : 'user') as 'ai' | 'user',
              text: m.content,
            }))
          )
        }
      } catch {}
      setHistoryLoading(false)
      if (!params.address) {
        api.get(`/reviews/${rid}`, { timeout: 15000 })
          .then(({ data }) => { if (data.business?.address) setBusinessAddress(data.business.address) })
          .catch(() => {})
      }
    }

    setLoading(true)
    try {
      if (!rid) {
        const { data } = await api.post('/reviews', {
          listing_id: params.listing_id,
          review_text: params.transcript ?? ' ',
          rating: Number(params.rating) || 4,
          tone: 'neutral',
          language: 'en',
        }, { timeout: 30000 })
        rid = data.review_id ?? data.id
        setReviewId(rid)
      }

      const enhanceCtx = params.enhance_context
        ? JSON.parse(params.enhance_context as string)
        : null

      const contextNote = [
        params.rating ? `The user rated this experience ${params.rating} out of 5 stars.` : '',
        enhanceCtx?.emotion ? `They felt ${enhanceCtx.emotion.replace(/^.*\s/, '')} about it.` : '',
        enhanceCtx?.tone ? `They want a ${enhanceCtx.tone} tone.` : '',
        enhanceCtx?.goal ? `Their goal is to ${enhanceCtx.goal.toLowerCase()}.` : '',
        enhanceCtx?.aspects?.length ? `Key aspects: ${enhanceCtx.aspects.map((a: string) => a.replace(/^.*\s/, '')).join(', ')}.` : '',
      ].filter(Boolean).join(' ')

      const { data } = await api.post(
        `/reviews/${rid}/chat/start`,
        {
          listing_context: {
            business_name: params.business_name,
            networks: [],
            context_note: contextNote,
          },
          language: 'en',
        },
        { timeout: 120000 }
      )
      setSessionId(data.session_id)

      const initialMsgs: Message[] = [
        {
          id: 'ai-initial',
          role: 'ai',
          text: data.message ?? data.initial_response ?? data.response ?? 'Hello! Tell me about your experience.',
        },
      ]

      // If coming from Smart Review (enhance), send the context as first user message
      if (params.enhance_context && !params.transcript) {
        try {
          const ctx = JSON.parse(params.enhance_context)
          const parts: string[] = []
          if (ctx.emotion) parts.push(`I felt ${ctx.emotion.replace(/^.*\s/, '')} about my experience`)
          if (ctx.aspects?.length) parts.push(`Key aspects: ${ctx.aspects.map((a: string) => a.replace(/^.*\s/, '')).join(', ')}`)
          if (ctx.tone) parts.push(`Please use a ${ctx.tone} tone`)
          if (ctx.goal) parts.push(`My goal is to ${ctx.goal.toLowerCase()}`)
          const ctxMsg = parts.join('. ') + '.'
          initialMsgs.push({ id: 'enhance-ctx', role: 'user', text: ctxMsg })

          // Send to API so AI can include this context
          if (data.session_id) {
            api.post(`/reviews/${rid}/chat/message`, {
              session_id: data.session_id,
              message: ctxMsg,
            }, { timeout: 60000 })
              .then(({ data: resp }) => {
                const respText = resp.message ?? resp.response ?? resp.reply ?? resp.text
                if (respText) {
                  setMessages((prev) => [...prev, {
                    id: 'ai-ctx-resp',
                    role: 'ai',
                    text: respText,
                  }])
                }
              })
              .catch(() => {})
          }
        } catch {}
      }

      if (params.transcript) {
        initialMsgs.push({ id: 'transcript', role: 'user', text: params.transcript })
        setMessages(initialMsgs)
        // Send transcript to AI and show reply
        if (data.session_id && rid) {
          setLoading(true)
          api.post(`/reviews/${rid}/chat/message`,
            { session_id: data.session_id, message: params.transcript },
            { timeout: 60000 }
          ).then(({ data: resp }) => {
            const reply = resp.message ?? resp.response ?? resp.reply ?? resp.text
            if (reply) setMessages((prev) => [...prev, { id: 'ai-transcript-resp', role: 'ai', text: reply }])
          }).catch(() => {}).finally(() => setLoading(false))
        }
      } else {
        setMessages(initialMsgs)
      }
    } catch (e: any) {
      setInitError(true)
      const status = e?.response?.status
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'unknown'
      const errDetail = status ? `${status}: ${Array.isArray(msg) ? msg[0] : msg}` : String(msg)
      const fallback: Message[] = [
        { id: 'fallback', role: 'ai', text: `Connection failed: ${errDetail}` },
      ]
      if (params.transcript) {
        fallback.push({ id: 'transcript', role: 'user', text: params.transcript })
      }
      setMessages(fallback)
    } finally {
      setLoading(false)
    }
  }

  const addMessage = (role: 'ai' | 'user', text: string) =>
    setMessages((prev) => {
      const next = [...prev, { id: Date.now().toString(), role, text }]
      messagesRef.current = next
      return next
    })

  const retryInit = () => {
    setInitError(false)
    setMessages([])
    initChat()
  }

  const sendMessage = async () => {
    if (!input.trim() || !reviewId) return
    const text = input.trim()
    setInput('')
    addMessage('user', text)
    setLoading(true)
    try {
      let sid = sessionId
      if (!sid) {
        const { data: startData } = await api.post(
          `/reviews/${reviewId}/chat/start`,
          { listing_context: { business_name: params.business_name, networks: [] }, language: 'en' },
          { timeout: 60000 }
        )
        sid = startData.session_id
        setSessionId(sid)
      }
      const { data } = await api.post(
        `/reviews/${reviewId}/chat/message`,
        { session_id: sid, message: text },
        { timeout: 60000 }
      )
      addMessage('ai', data.message ?? data.response ?? data.reply ?? data.text ?? 'Could not get response.')
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'unknown'
      addMessage('ai', `Error ${status ? `(${status})` : '(network)'}: ${Array.isArray(msg) ? msg[0] : msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!sessionId || !reviewId) return
    setSubmitting(true)
    try {
      const { data } = await api.post(
        `/reviews/${reviewId}/chat/approve`,
        { session_id: sessionId },
        { timeout: 60000 }
      )
      const reviewText = data.review_text ?? data.improved_text ?? data.text ?? ''
      setGeneratedReview(reviewText)
      setEditReviewText(reviewText)
      setSessionId(null)
      if (reviewText) setVoiceMode(true)
      if (reviewText) {
        await api.patch(`/reviews/${reviewId}`, { review_text: reviewText, rating: data.rating })
      }
    } catch {
      // keep current state
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = async () => {
    if (!reviewId) return
    const prev = generatedReview
    setRephrasing(true)
    try {
      let sid = sessionId

      if (!sid) {
        const { data: startData } = await api.post(
          `/reviews/${reviewId}/chat/start`,
          {
            listing_context: { business_name: params.business_name, networks: [] },
            language: 'en',
          },
          { timeout: 60000 }
        )
        sid = startData.session_id
        setSessionId(sid)
      }

      await api.post(
        `/reviews/${reviewId}/chat/message`,
        {
          session_id: sid,
          message: `Please rewrite this review with different wording and structure, keeping the EXACT same meaning, sentiment, rating, and all negative or positive points. Here is the current review to rephrase: "${generatedReview}"`,
        },
        { timeout: 60000 }
      )

      const { data: approveData } = await api.post(
        `/reviews/${reviewId}/chat/approve`,
        { session_id: sid },
        { timeout: 60000 }
      )

      const newText = approveData.review_text ?? approveData.improved_text ?? approveData.text ?? ''
      setSessionId(null)

      if (newText) {
        setGeneratedReview(newText)
        setEditReviewText(newText)
        await api.patch(`/reviews/${reviewId}`, { review_text: newText, rating: approveData.rating })
      } else {
        setGeneratedReview(prev)
      }
    } catch {
      setGeneratedReview(prev)
    } finally {
      setRephrasing(false)
    }
  }

  const handleRegenerate = async () => {
    if (!reviewId) return

    if (!sessionId) {
      Alert.alert(
        'Continue the conversation first',
        'Send a message about what you want to add or change, then tap Regenerate to update the review.',
      )
      return
    }

    const prev = generatedReview
    setRegenerating(true)
    try {
      const { data: approveData } = await api.post(
        `/reviews/${reviewId}/chat/approve`,
        { session_id: sessionId },
        { timeout: 60000 }
      )

      const newText = approveData.review_text ??
        approveData.improved_text ??
        approveData.text ?? ''

      setSessionId(null)

      if (newText) {
        setGeneratedReview(newText)
        setEditReviewText(newText)
        await api.patch(`/reviews/${reviewId}`, {
          review_text: newText,
          rating: approveData.rating
        })
      } else {
        setGeneratedReview(prev)
      }
    } catch {
      setGeneratedReview(prev)
      Alert.alert(
        'Error',
        'Could not regenerate the review. Please try again.'
      )
    } finally {
      setRegenerating(false)
    }
  }

  const saveEditedReview = async () => {
    const trimmed = editReviewText.trim()
    if (!trimmed) { setEditingReview(false); return }
    setGeneratedReview(trimmed)
    setEditingReview(false)
    if (reviewId) await api.patch(`/reviews/${reviewId}`, { review_text: trimmed }).catch(() => {})
  }

  const buildSelectedSlugs = async () => {
    try {
      const { data } = await api.get('/networks')
      const networkIdList = (params.network_ids ?? '')
        .split(',')
        .filter(Boolean)
      return data
        .filter((n: any) => networkIdList.includes(n.network_id))
        .map((n: any) => n.slug)
    } catch {
      return []
    }
  }

  const handleSubmit = async () => {
    const selectedSlugs = await buildSelectedSlugs()
    router.push({
      pathname: '/review/breakdown',
      params: {
        ...params,
        review_id: reviewId ?? '',
        address: businessAddress,
        review_text: generatedReview ?? '',
        selected_networks: JSON.stringify(selectedSlugs),
      },
    })
  }

  // FlatList data: prepend divider + history messages when continuing a draft
  const flatData: FlatItem[] = historyMessages.length > 0
    ? [{ id: 'history-divider', kind: 'divider' as const }, ...historyMessages, ...messages]
    : messages

  const renderMessage = ({ item }: { item: FlatItem }) => {
    if ('kind' in item) {
      return (
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>Previous conversation</Text>
          <View style={styles.dividerLine} />
        </View>
      )
    }
    return (
      <View style={[styles.bubbleRow, item.role === 'ai' && styles.aiBubbleRow]}>
        {item.role === 'ai' && <ProvocAvatar />}
        <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
          <Text style={styles.bubbleText}>{item.text}</Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <View style={styles.titleLogo}>
            <Ionicons name="star" size={12} color="#fff" />
          </View>
          <Text style={styles.title}>Provoc Voice</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* History loading spinner — shown while fetching prior conversation */}
      {historyLoading ? (
        <View style={styles.historyLoadingContainer}>
          <ActivityIndicator color="#2D6A4F" size="large" />
          <Text style={styles.historyLoadingText}>Loading conversation...</Text>
        </View>
      ) : (
        <>
          {/* Message list */}
          <FlatList
            ref={flatRef}
            data={flatData}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              loading
                ? <ActivityIndicator color="#2D6A4F" style={{ marginVertical: 12 }} />
                : initError
                ? (
                  <TouchableOpacity style={styles.retryBtn} onPress={retryInit}>
                    <Ionicons name="refresh-outline" size={16} color="#fff" />
                    <Text style={styles.retryBtnText}>Retry connection</Text>
                  </TouchableOpacity>
                )
                : null
            }
          />

          {/* AI-Generated Review card */}
          {generatedReview && (
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <ProvocAvatar />
                <Text style={styles.reviewCardTitle}>AI-Generated Review</Text>
                <TouchableOpacity
                  style={styles.enhanceChip}
                  onPress={() => router.push({ pathname: '/review/enhance', params })}
                >
                  <Ionicons name="sparkles-outline" size={12} color="#2D6A4F" />
                  <Text style={styles.enhanceChipText}>Enhance</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={editingReview ? saveEditedReview : () => setEditingReview(true)}
                >
                  <Ionicons
                    name={editingReview ? 'checkmark-circle' : 'create-outline'}
                    size={18}
                    color={editingReview ? '#22C55E' : '#8B9099'}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRetry} disabled={rephrasing || regenerating || editingReview}>
                  {rephrasing
                    ? <ActivityIndicator size="small" color="#8B9099" />
                    : <Ionicons name="refresh-outline" size={18} color="#8B9099" />
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRegenerate} disabled={regenerating || rephrasing || editingReview}>
                  {regenerating
                    ? <ActivityIndicator size="small" color="#8B9099" />
                    : <Ionicons name="sync-outline" size={18} color="#8B9099" />
                  }
                </TouchableOpacity>
              </View>
              {editingReview ? (
                <TextInput
                  style={styles.reviewCardEditInput}
                  value={editReviewText}
                  onChangeText={setEditReviewText}
                  multiline
                  autoFocus
                  scrollEnabled={false}
                />
              ) : (
                <Text style={styles.reviewCardText}>{generatedReview}</Text>
              )}
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>Submit review</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Generate review button (before approval) */}
          {!generatedReview && (
            <View style={styles.approveRow}>
              <TouchableOpacity
                style={[styles.approveBtn, (submitting || messages.length < 2) && styles.btnDisabled]}
                onPress={handleApprove}
                disabled={submitting || messages.length < 2}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={16} color="#fff" />
                    <Text style={styles.approveBtnText}>Generate review</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
            <TouchableOpacity
              style={styles.inputAction}
              onPress={() => router.push({ pathname: '/review/enhance', params })}
            >
              <Ionicons name="add" size={22} color="#8B9099" />
            </TouchableOpacity>
            {generatedReview && voiceMode ? (
              <TouchableOpacity
                style={styles.tapToSpeak}
                onPress={() => router.push({ pathname: '/review/recording', params: { ...params, review_id: reviewId ?? '' } })}
              >
                <Ionicons name="mic-outline" size={16} color="#8B9099" />
                <Text style={styles.tapToSpeakText}>Tap to speak</Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor="#8B9099"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                autoFocus={!!generatedReview && !voiceMode}
              />
            )}
            {generatedReview && !voiceMode && (
              <TouchableOpacity style={styles.sendBtn} onPress={() => setVoiceMode(true)}>
                <Ionicons name="mic-outline" size={18} color="#8B9099" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={generatedReview && voiceMode ? () => setVoiceMode(false) : sendMessage}
            >
              <Ionicons
                name={generatedReview && voiceMode ? 'keypad-outline' : 'send'}
                size={18}
                color={generatedReview && voiceMode ? '#8B9099' : '#2D6A4F'}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 56 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleLogo: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },

  historyLoadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  historyLoadingText: { color: '#8B9099', fontSize: 14 },

  messageList: { padding: 16, paddingBottom: 8 },

  dividerContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 16, paddingHorizontal: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2A3045' },
  dividerLabel: { color: '#8B9099', fontSize: 11, marginHorizontal: 12 },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    justifyContent: 'flex-end',
  },
  aiBubbleRow: { justifyContent: 'flex-start' },

  aiAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2D6A4F',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },

  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  aiBubble: { backgroundColor: '#1A1F2E', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: '#2A3045', borderBottomRightRadius: 4 },
  bubbleText: { color: '#fff', fontSize: 14, lineHeight: 20 },

  reviewCard: {
    backgroundColor: '#1A1F2E', borderRadius: 16, margin: 16, padding: 16,
  },
  reviewCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  reviewCardTitle: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  enhanceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1B3024', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#2D6A4F55',
  },
  enhanceChipText: { color: '#2D6A4F', fontSize: 11, fontWeight: '600' },
  reviewCardText: { color: '#C0C6D4', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  reviewCardEditInput: {
    color: '#E0E0E0', fontSize: 13, lineHeight: 20, marginBottom: 14,
    backgroundColor: '#0D0D0D', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#2D6A4F', textAlignVertical: 'top', minHeight: 80,
  },
  submitBtn: {
    backgroundColor: '#2D6A4F', borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2D6A4F', borderRadius: 10, paddingVertical: 12, margin: 16,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  approveRow: { paddingHorizontal: 16, paddingBottom: 4 },
  approveBtn: {
    backgroundColor: '#1B4332', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1F2E', paddingHorizontal: 12, paddingTop: 12, gap: 10,
  },
  inputAction: { padding: 4 },
  textInput: { flex: 1, color: '#fff', fontSize: 15, height: 38 },
  tapToSpeak: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 38,
  },
  tapToSpeakText: { color: '#8B9099', fontSize: 14 },
  sendBtn: { padding: 4 },
})
