import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Switch } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TodayCard from '../../components/TodayCard'
import api from '../../services/api'
import { getBizPhoto } from '../../utils/bizPhoto'

type Network = { id: string; name: string; slug: string }

const PLATFORM_COLORS: Record<string, string> = {
  google: '#4285F4',
  yelp: '#D32323',
  facebook: '#1877F2',
  tripadvisor: '#00AA6C',
  trustpilot: '#00B67A',
}

const PLATFORM_FA_ICONS: Record<string, string> = {
  google: 'google',
  yelp: 'yelp',
  facebook: 'facebook',
}

function PlatformDot({ slug, name }: { slug: string; name: string }) {
  const color = PLATFORM_COLORS[slug] ?? '#2D6A4F'
  const faIcon = PLATFORM_FA_ICONS[slug]
  return (
    <View style={[styles.platformDot, { backgroundColor: color }]}>
      {faIcon
        ? <FontAwesome name={faIcon as any} size={16} color="#fff" />
        : <Text style={styles.platformDotText}>{name[0]}</Text>
      }
    </View>
  )
}

export default function NetworksScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { listing_id, business_name, address, rating, business_type, network_ids } =
    useLocalSearchParams<{
      listing_id: string; business_name: string; address: string
      rating: string; business_type: string; network_ids: string
    }>()
  const bizPhoto = getBizPhoto(business_type ?? '', listing_id ?? business_name ?? '')
  const [networks, setNetworks] = useState<Network[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!listing_id) return
    api.get(`/listings/${listing_id}`)
      .then(({ data }) => {
        const nets: Network[] = data.networks ?? data.listing?.networks ?? []
        setNetworks(nets)
      })
      .catch(() => {
        setNetworks([])
      })
      .finally(() => setLoading(false))
  }, [listing_id])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll = () => {
    if (selected.size === networks.length) setSelected(new Set())
    else setSelected(new Set(networks.map((n) => n.id)))
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Network select</Text>
        <View style={{ width: 36 }} />
      </View>

      <TodayCard
        businessName={business_name}
        address={address}
        rating={rating}
        businessType={business_type}
        imageUri={bizPhoto}
      />

      <View style={styles.card}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2D6A4F" size="large" />
            <Text style={styles.loadingText}>Searching for networks...</Text>
          </View>
        ) : (
          <>
            {networks.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="alert-circle-outline" size={32} color="#8B9099" />
                <Text style={styles.emptyText}>No platforms found for this business</Text>
              </View>
            ) : (
              <>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Network select</Text>
                  <TouchableOpacity style={styles.selectAllBtn} onPress={selectAll}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#8B9099" />
                    <Text style={styles.selectAll}>
                      {selected.size === networks.length ? 'DESELECT ALL' : 'SELECT ALL'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {networks.map((net) => (
                  <View key={net.id} style={styles.platformRow}>
                    <PlatformDot slug={net.slug} name={net.name} />
                    <Text style={styles.platformName}>{net.name}</Text>
                    <Switch
                      value={selected.has(net.id)}
                      onValueChange={() => toggle(net.id)}
                      trackColor={{ false: '#3A3F4B', true: '#2D6A4F' }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, selected.size === 0 && styles.btnDisabled]}
          disabled={selected.size === 0 || loading}
          onPress={() =>
            router.push({
              pathname: '/review/rate',
              params: { listing_id, business_name, address, rating, business_type, network_ids: JSON.stringify([...selected]) },
            })
          }
        >
          <Text style={styles.btnPrimaryText}>Next</Text>
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
    paddingHorizontal: 16, marginBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center',
  },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: '#1A1F2E', borderRadius: 16, marginHorizontal: 20, padding: 20, flex: 1 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#8B9099', fontSize: 14 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#8B9099', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectAll: { color: '#8B9099', fontSize: 11, fontWeight: '700' },
  platformRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3045', gap: 12 },
  platformDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  platformDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  platformName: { color: '#fff', fontSize: 15, flex: 1 },
  bottomBar: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  btnSecondary: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#1A1F2E', justifyContent: 'center', alignItems: 'center' },
  btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#2D6A4F', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
})
