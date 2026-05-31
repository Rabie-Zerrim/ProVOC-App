import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE_URL } from '../constants/api'

const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 })

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@provoc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
