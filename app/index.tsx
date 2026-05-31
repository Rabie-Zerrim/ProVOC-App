import { useEffect } from 'react'
import { Redirect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState } from 'react'
import { View, ActivityIndicator } from 'react-native'

export default function Index() {
  const [token, setToken] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    AsyncStorage.getItem('@provoc_token').then(setToken)
  }, [])

  if (token === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#2D6A4F" />
      </View>
    )
  }

  if (token) return <Redirect href="/(tabs)/home" />
  return <Redirect href="/auth" />
}
