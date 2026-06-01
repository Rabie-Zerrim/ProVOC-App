# ProVOC Frontend Handoff — pv-app
**Date:** 2026-05-29  
**Status:** Backend 100% complete. Frontend substantially built. Core review flow end-to-end functional.  
**Target:** React Native + Expo  
**Demo deadline:** June 10, 2026

---

## 1. Project Context

ProVOC is a review management app. Users search for a business, record or type their experience, an AI refines it into a polished review, and the app opens each review platform with the text pre-copied to clipboard.

Three repos exist:
- `pv-bff` — NestJS backend, runs on port 3001 (bound to 0.0.0.0)
- `pv-ai` — FastAPI AI sidecar, runs on port 5000 (must start with `--host ::` for IPv6 compatibility)
- `pv-app` — React Native + Expo (THIS repo, build from scratch)

---

## 2. Design System

### Colors
- Background: `#0D0D0D` (near black)
- Card background: `#1A1F2E` (dark navy)
- Primary green: `#2D6A4F` (dark green for buttons)
- Primary green light: `#40916C` (hover/active states)
- Accent green CTA: `#1B4332` (the "How was your last experience" card)
- Text primary: `#FFFFFF`
- Text secondary: `#8B9099`
- Star color: `#FFB800` (amber yellow)
- Toggle active: `#4CAF50`
- Toggle inactive: `#3A3F4B`
- Chip background: `#1E2435`
- Chip border: `#2A3045`
- Error: `#EF4444`
- Success: `#22C55E`

### Typography
- Font: System default (SF Pro on iOS, Roboto on Android)
- Headings: Bold, white
- Body: Regular, white or secondary grey
- Small labels: 12px, secondary grey

### Components
- Cards: `border-radius: 16px`, background `#1A1F2E`
- Buttons primary: full width, `border-radius: 12px`, green background, white text
- Buttons secondary: `border-radius: 12px`, dark background, white text
- Chips/tags: `border-radius: 20px`, dark background, white text, emoji prefix
- Toggle switches: iOS-style, green when active
- Input fields: dark background, rounded, grey placeholder

---

## 3. Tech Stack

```
Framework: React Native + Expo (latest)
Navigation: expo-router (file-based)
Styling: NativeWind (Tailwind for React Native)
HTTP: axios
Storage: @react-native-async-storage/async-storage
Audio: expo-av
Camera: expo-camera
Media: expo-image-picker
Icons: @expo/vector-icons (Ionicons)
```

---

## 4. API Configuration

```typescript
// constants/api.ts
export const API_BASE_URL = 'http://192.168.100.4:3001'  // pv-bff (LAN IP — update if server IP changes)
```

All API calls go through pv-bff only. pv-ai is an internal sidecar — never call it directly from the app. `AI_BASE_URL` has been removed from constants/api.ts.

### Axios Interceptor
Every request must include `Authorization: Bearer {token}` header.
Token is stored in AsyncStorage under key `@provoc_token`.

```typescript
// services/api.ts
import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE_URL } from '../constants/api'

const api = axios.create({ baseURL: API_BASE_URL })

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@provoc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
```

---

## 5. Complete API Reference

### Auth
```
POST /auth/register
Body: { email, password, display_name }
Returns: { access_token }

POST /auth/login
Body: { email, password }
Returns: { access_token }
```

### Listings (Business Search)
```
GET /listings/search?name=McDonald%27s&address=Paris&networks[]=google&networks[]=yelp
Returns: { google: { id, name, address, globalRating, url, ... }, yelp: { ... } }

POST /listings
Body: {
  external_listing_id: data.[network].id,   ← CRITICAL: always use .id field
  external_url: data.[network].url,          ← CRITICAL: always use .url field
  name: data.[network].name,
  address: data.[network].formattedAddress,
  external_rating: data.[network].globalRating,
  network_id: <uuid of the network>
}
Returns: { listing_id, ... }

GET /listings/:id
Returns: listing with business and network
⚠️ Network IDs in the response use field name `network_id` (not `id`).
Extract with: `nets.map((n: any) => n.network_id ?? n.id).filter(Boolean)`
```

### Reviews
```
POST /reviews
Body: { listing_id, review_text, rating, tone: 'neutral'|'polite'|'firm', language: 'en'|'fr'|'ar' }
Returns: { review_id, status: 'draft', ... }

GET /reviews
Returns: paginated list of reviews

GET /reviews/:id
Returns: full review with business info

PATCH /reviews/:id
Body: { review_text?, rating?, tone?, status? }

DELETE /reviews/:id
```

### AI Flow (via pv-bff proxy)
```
POST /reviews/:id/transcribe
Body: FormData with audio file (field name: `audio`, type: `audio/m4a`)
Returns: { text, language, confidence }
⚠️ Use `response.data.text` (not `.transcript`) — `.text` is the correct field name.

POST /reviews/:id/chat/start
Body: { listing_context: { business_name, networks, context_note? }, language: 'en' }
— context_note is a plain-English string built from rating + enhance selections (fix 21).
— pv-bff must forward context_note to pv-ai listing_context (fix 22).
— pv-ai must append context_note to the system prompt as "USER CONTEXT: ..." (fix 23).
Returns: { session_id, message: string }

POST /reviews/:id/chat/message
Body: { session_id, message }
Returns: { message: string }

POST /reviews/:id/chat/approve
Body: { session_id }
Returns: { review_text: string, rating: number, tone: string }

GET /reviews/:id/chat/history
Returns: [{ message_id, review_id, role: 'user'|'assistant', content, created_at }]
— Ascending order. Empty array [] when no history exists (new review).
— Call this before chat/start when opening a draft review.
```

### Publishing
```
GET /reviews/:id/publish-link?platform_id=<uuid>
Returns: { url, review_text, platform_name }
— Copies review_text to clipboard, opens url with Linking.openURL()

POST /reviews/:id/publish
Body: { platform_ids: [uuid] }
— Only for Facebook (automatic posting via Graph API)
```

### Networks
```
GET /networks
Returns: [{ network_id, name, slug, post_auth_type }]
— Filtered to is_active: true, ordered by name.
— Used by search.tsx on mount to build the dynamic platform slug list.
— Falls back to ['google', 'yelp', 'tripadvisor', 'facebook', 'trustpilot'] if the call fails.
```
Query GET /listings/:id to get the network_id for a saved listing.

---

## 6. Screen-by-Screen Specification

### Screen 1: Auth — `app/auth.tsx`
**Design:** Dark background with green circular decoration top-left. White card bottom half.

**Elements:**
- Back arrow top left
- "Set up your account" heading
- "Login to enjoy the best review experience" subtitle
- Toggle tabs: **Login** | **Register** (pill shaped, dark background)
- Email input with envelope icon
- Password input with envelope icon + eye toggle
- "Remember me" checkbox + "Forgot password?" link (green text)
- "Continue" button — full width, green, rounded

**Login mode fields:** email, password
**Register mode fields:** display_name, email, password

**Logic:**
- Login → POST /auth/login → store token → navigate to `/(tabs)/home`
- Register → POST /auth/register → store token → navigate to `/(tabs)/home`
- Show inline error on wrong credentials

---

### Screen 2: Home — `app/(tabs)/home.tsx`
**Design:** Full dark background, bottom tab bar.

**Elements:**
- Avatar circle + "Hello [display_name]" + location subtitle with dropdown arrow
- Search bar — rounded, dark, "Search here" placeholder with envelope icon
- "Nearby" section heading + horizontal scroll cards
  - Each card: photo background, rating (star + number + count), distance badge, business name
- Green CTA card: "How was your last experience?" / "Write once, share everywhere" / "Share review" button
- Small disclaimer: AI assists icon + text
- "Continue a draft" section — list of draft reviews
  - Each item: thumbnail photo + business name + "Saved X days ago"
- Bottom tab bar: Home (active, green) | Reviews | Profile

**Logic:**
- Search bar tap → navigate to search screen
- "Share review" button → navigate to search screen
- Draft item tap → navigate to review flow for that review
- "Nearby" cards → tap to start review for that business (mock data for demo)

---

### Screen 3: Search — `app/search.tsx`
**Design:** Dark, full screen search.

**Elements:**
- Search bar with dropdown arrow
- Category filter chips horizontal scroll: 🍔 Food | ☕ Coffee | 🏋️ Fitness | 🎭 Entertainment
- "Last searching" section label
- Results list items:
  - Clock icon (recent) or pin icon (location result)
  - Business name + category tag (pill, dark background)
  - Address
  - Rating (star + number + review count)
- "More from recent history" link at bottom

**Logic:**
- Type in search bar → call GET /listings/search after 500ms debounce
- Tap result → call POST /listings to save → navigate to network select screen
- Map `data.[network].id` → `external_listing_id`
- Map `data.[network].url` → `external_url`
- Category chips → filter results (UI only for demo)

---

### Screen 4: Network Select Loading — `app/review/networks.tsx`
**Design:** Dark card with spinner.

**Elements:**
- Back arrow
- Business info card at top: photo + name + category tag + address + rating
- "Network select" card with loading spinner + "Searching for network..." text
- Back button + disabled Next button

**Logic:**
- On mount: fetch available networks for this listing
- When loaded → show Screen 5

---

### Screen 5: Network Select — same screen, loaded state
**Elements:**
- Business info card (same as above)
- "Network select" heading + "SELECT ALL" toggle
- List of platform toggles with logos:
  - 🔵 Facebook toggle
  - 🔴 Yelp toggle (green = active)
  - 🔵 Google toggle
  - 🟢 Tripadvisor toggle
- Back + Next (green, active when at least one selected)

**Note:** Show only platforms that have a listing saved for this business. For demo show all 4, only Yelp/Google/Facebook/Trustpilot are functional.

---

### Screen 6: Rate — `app/review/rate.tsx`
**Elements:**
- Back arrow
- Business info card (consistent across all review flow screens)
- "How would you rate this experience?" card
- "Are you satisfied?" subtitle
- 5 star selector — tap to select, yellow fill

---

### Screen 7: Review Type — `app/review/type.tsx`
**Elements:**
- Back arrow
- Business info card
- Rating display (from previous screen)
- Three option cards in grid:
  - 💬 **Regular Review** — "Take a moment to share your thoughts." + arrow icon
  - 🤖 **Smart review** — "Make writing reviews effortless." + arrow icon
  - 🎤 **Voice review** — "Speak your thoughts and we'll handle the writing." + arrow icon

**Logic:**
- Regular Review → text input screen
- Smart review → Enhance with AI modal (Screen 11)
- Voice review → Recording screen (Screen 9)

---

### Screen 8: Provoc Voice — Topic Select — `app/review/voice.tsx`
**Design:** Dark, centered content.

**Elements:**
- Back arrow
- "Provoc Voice" title
- "How would you describe your experience?" heading
- Topic chips grid (2-3 per row):
  - 🤝 Service | 👥 Staff | 💰 Price
  - 🏠 Environment | 😊 Atmosphere
  - ⭐ Quality | ✨ Cleanliness
- Bottom bar: + icon | "Ask anything..." input | mic icon | waveform icon

**Logic:**
- Select topics → pass to AI chat as context
- Tap mic → start recording (Screen 9)
- Type in input → send as chat message

---

### Screen 9: Recording — `app/review/recording.tsx`
**Design:** Green gradient bottom half, dark top.

**Elements:**
- Back arrow
- "Provoc Voice" title
- Camera icon button (circular, dark)
- Microphone icon button (circular, dark)  
- **End** button (red, pill shape with waveform icon)

**Logic:**
- Uses expo-av for audio recording
- On "End" tap → stop recording → POST /reviews/:id/transcribe with audio file → navigate to chat screen with transcript
- ⚠️ Use `api.post()` (not raw `fetch()`). Raw fetch bypasses the axios auth interceptor.
- ⚠️ Read transcript from `response.data.text` first, then `.transcript` as fallback.

---

### Screen 10: AI Chat — `app/review/chat.tsx`
**Design:** Chat bubble interface, dark background.

**Elements:**
- Back arrow
- "Provoc Voice" title
- Chat messages:
  - AI messages: left-aligned, dark bubble, no avatar
  - User messages: right-aligned, slightly lighter bubble
- At bottom when AI finishes: "AI-Generated Review" card with review text + refresh icon
- "Enhance with AI" chip button below review
- "Submit review" green button
- Bottom input bar: + | text input | mic | waveform icons

**Logic:**
- On mount → POST /reviews/:id/chat/start
- Send message → POST /reviews/:id/chat/message
- "Submit review" → POST /reviews/:id/chat/approve → navigate to breakdown rates or review result

---

### Screen 11: Enhance with AI — `app/review/enhance.tsx`
**Design:** Modal overlay (bottom sheet or full screen modal).

**Elements:**
- "Enhance with AI" title + X close button
- **"How did it make you feel?"** — emotion chips: 😠 Angry | 😕 Confused | 😐 Neutral | (more)
- **"What stood out the most"** — aspect chips: 🤝 Service | 👥 Staff | 💰 Price | 🏠 Env... (scrollable row)
- **"Choose your tone"** — tone cards:
  - 🟢 Neutral — "Balanced and factual"
  - 😊 Polite — "Gentle and constructive"
  - ⚠️ (third option partially visible — scroll)
- **"What's your goal?"** — goal cards:
  - 🤝 Praise — "Celebrate great service"
  - 📢 Awareness — "Share for others to know"
  - (third partially visible)
- Back + Submit (green) buttons

**Logic:**
- Submit → pass selections as context to AI chat → POST /reviews/:id/chat/message with structured prompt

---

### Screen 12: Breakdown Rates — `app/review/breakdown.tsx`
**Elements:**
- Back arrow
- Business info card
- Per-platform rating sections (only platforms the user selected):
  - 🔵 **Facebook** — Communication / Food / Price (5 stars each)
  - 🔴 **Yelp** — Service / Environment / Price (5 stars each)
  - 🔵 **Google** — Service / Staff (5 stars each)
  - etc.
- Back + Next buttons

**Logic:**
- User rates each sub-category per platform
- ⚠️ Only render platforms included in the `selected_networks` param (JSON-parsed array of slugs). No fallback — if the param is missing or malformed, `selectedSlugs` is `[]` so no platform cards render.
- Pass ratings as `breakdown` param to result screen

---

### Screen 13: Review Result — `app/review/result.tsx`
**Elements:**
- "Review result" title + X button
- Business info card (name + category tag)
- Generated review text block (long form)
- "Enhance with AI" chip button
- Platform summary card: rating number (4.7) + stars + review count + "Very good" badge + platform name + sub-ratings

**Logic:**
- "Enhance with AI" → open Screen 11 modal
- Next → navigate to Share Photos or directly to posting
- ⚠️ Back/X button uses `router.back()` — not `router.push('/(tabs)/home')` which breaks the flow when accessed from the reviews history tab.

---

### Screen 14: Share Photos — `app/review/photos.tsx`
**Elements:**
- Back arrow + "Share photos" title
- Dashed upload area with camera icon + "Upload photo" button
- Legal disclaimer text with "Terms of Use" link
- Back + Next (disabled until photo added or skipped)

**Logic:**
- "Upload photo" → open image picker (Screen 15 gallery or Screen 16 camera)
- Selected photos show as thumbnails with X to remove
- Next → navigate to posting screen

---

### Screen 15: Gallery — native expo-image-picker
**Elements:**
- "Recents" dropdown + SELECT ALL toggle
- Photo grid (3 columns)
- Tap photo → add to selection

---

### Screen 16: Camera — native expo-camera
**Elements:**
- Camera modes: CINEMATIC / VIDEO / PHOTO / PORTRAIT / PANO
- Capture button
- "Add photo" confirmation button

---

### Screen 17: Thank You — `app/review/thankyou.tsx`
**Design:** Dark, centered.

**Elements:**
- Green thumbs up outline icon (large)
- "Thank you" heading
- "Your feedback was successfully submitted" subtitle
- "Go back home" green button (full width, bottom)

**Logic:**
- Button → navigate to `/(tabs)/home`, clear review flow state

---

## 7. Navigation Structure

```
app/
├── index.tsx              → redirect to auth or home based on token
├── auth.tsx               → login / register
├── search.tsx             → business search
├── (tabs)/
│   ├── _layout.tsx        → bottom tab bar
│   ├── home.tsx           → home screen
│   ├── reviews.tsx        → review history list
│   └── profile.tsx        → user profile
└── review/
    ├── networks.tsx       → network select (loading + loaded)
    ├── rate.tsx           → star rating
    ├── type.tsx           → review type selection
    ├── voice.tsx          → topic select + voice input
    ├── recording.tsx      → audio recording
    ├── chat.tsx           → AI chat conversation
    ├── enhance.tsx        → enhance with AI modal
    ├── breakdown.tsx      → per-platform ratings
    ├── result.tsx         → review result
    ├── photos.tsx         → photo upload
    └── thankyou.tsx       → success screen
```

---

## 8. Shared Components

```
components/
├── BusinessCard.tsx       → business info card (reused across all review flow screens)
├── StarRating.tsx         → interactive + display star rating
├── PlatformToggle.tsx     → platform toggle row with logo
├── ChipSelector.tsx       → horizontal scrollable chip selector
├── ChatBubble.tsx         → AI and user message bubbles
├── ReviewCard.tsx         → review list item for history screen
└── LoadingSpinner.tsx     → centered spinner
```

---

## 9. State Management

No Redux needed. Use React state + AsyncStorage.

```
Global state (AsyncStorage):
- @provoc_token         → JWT token
- @provoc_user          → { user_id, email, display_name }

Local state per screen:
- Review flow: pass params through expo-router navigation
  { listing_id, review_id, session_id, selected_networks[] }
```

---

## 10. Key Implementation Notes

### Mapping Zembra Response to POST /listings
```typescript
// CRITICAL — always map like this, no exceptions
const saveBody = {
  external_listing_id: result[network].id,    // e.g. "ChIJx_26Jupv5kcR47OyH6966iE"
  external_url: result[network].url,           // e.g. "https://search.google.com/local/reviews?placeid=..."
  name: result[network].name,
  address: result[network].formattedAddress,
  external_rating: result[network].globalRating,
}
```

### Clipboard + Deep Link Flow (Tier 1)
```typescript
import * as Clipboard from 'expo-clipboard'
import { Linking } from 'react-native'

const handlePost = async (reviewId: string, platformId: string) => {
  const { url, review_text } = await api.get(`/reviews/${reviewId}/publish-link?platform_id=${platformId}`)
  await Clipboard.setStringAsync(review_text)
  await Linking.openURL(url)
  // Show instruction: "Your review has been copied — paste it when the page opens"
}
```

### Audio Recording
```typescript
import { Audio } from 'expo-av'

// Request permission, record, stop, get URI, send as FormData to /reviews/:id/transcribe
```

### Facebook Posting (Tier 1 clipboard — same as others)
```typescript
// Facebook deep link
`https://www.facebook.com/search/top?q=${encodeURIComponent(businessName)}`
```

---

## 11. Features NOT Built (skip for demo)

- Forgot password flow
- Profile edit screen
- Notification center
- URL-based business search
- Google Places autocomplete
- Geolocation nearby search
- Media upload to S3 (photo flow is UI only — no backend upload)
- Tripadvisor posting (marked as inactive in DB)
- OpenTable posting (marked as inactive in DB)

---

## 12. Backend URLs Quick Reference

| Service | URL | What it does |
|---|---|---|
| pv-bff | http://192.168.100.4:3001 | All API calls (LAN IP) |
| pv-ai | http://192.168.100.4:5000 | Internal only, never call directly from app |
| Swagger docs | http://192.168.100.4:3001/api | Full API documentation |

> **Starting pv-ai:** must use `uvicorn main:app --host :: --port 5000` (IPv6 bind) so Node.js on the same machine can reach it via `localhost`. Using `--host 0.0.0.0` causes 503s from pv-bff.

---

## 13. Applied Fixes (2026-05-30)

All 20 fixes below have been applied and verified (`npx tsc --noEmit` → 0 errors).

| # | File | What changed |
|---|---|---|
| 1 | `constants/api.ts` | `API_BASE_URL` → `http://192.168.100.4:3001`; removed `AI_BASE_URL` entirely |
| 2 | `app/review/recording.tsx` | Replaced 22-line raw `fetch()` block with `api.post()` — auth header now automatic |
| 3 | `app/search.tsx` | Network ID extraction: `n.id` → `n.network_id ?? n.id` (both occurrences, replace_all) |
| 4 | `app/review/recording.tsx` | Transcript field order: `.text` read before `.transcript` (covered by fix 2) |
| 5 | `app/review/breakdown.tsx` | Added `selected_networks` param; filter platforms with `PLATFORMS_ORDER.filter(slug => selectedSlugs.includes(slug))` |
| 6 | `app/review/result.tsx` | Back button: `router.push('/(tabs)/home')` → `router.back()` |
| 7 | `app/(tabs)/reviews.tsx` | Complete rewrite: All/Published/Draft tabs, status badge colors, pull-to-refresh |
| 8 | `app/review/chat.tsx` | Draft continuation: fetch `GET /reviews/:id/chat/history` before `chat/start`; render history bubbles with "Previous conversation" divider; full-screen spinner during history fetch |
| 9 | `app/review/networks.tsx` | Removed fake demo network IDs (`google-demo`, `yelp-demo`) from both `.then` empty-check and `.catch`; replaced with `setNetworks(nets)` / `setNetworks([])`; added "No platforms found for this business" empty state UI |
| 10 | `app/review/result.tsx` | `handlePost` catch block: replaced silent "Copied" success with honest "Could not open platform" error alert that still copies text to clipboard |
| 11 | `app/search.tsx` | Added `ActiveNetwork` type + `FALLBACK_SLUGS` constant + `activeNetworkSlugsRef`; fetch `GET /networks` on mount (silent fallback to hardcoded slugs if it fails); replaced all three hardcoded `['google', 'yelp', ...]` arrays with `activeNetworkSlugsRef.current` |
| 12 | `app/review/breakdown.tsx` | Both `['facebook', 'yelp', 'google', 'trustpilot']` default/catch fallbacks changed to `[]` — never assume platforms without a real selection |
| 13 | `app/review/chat.tsx` + `app/(tabs)/home.tsx` | **BUG 1 — Breakdown missing address/rating.** home.tsx passes `rating` in draft nav params. chat.tsx adds `businessAddress` state (init from `params.address`); when `params.address` is missing and a `review_id` exists, fire-and-forget `GET /reviews/:id` to populate `businessAddress`; `handleSubmit` passes `address: businessAddress` and `review_text: generatedReview ?? ''` to breakdown. |
| 14 | `app/review/result.tsx` | **BUG 2 — Result shows last chat message instead of generated review.** Added `review_text` to `useLocalSearchParams` generic; `.then` handler now resolves `reviewText = params.review_text \|\| data.review_text \|\| ''` and applies it to both `setReview` and `setEditText` — nav param wins over DB fetch to prevent voice-transcribe race condition overwriting the approved review. |
| 15 | `app/review/result.tsx` + `app/review/enhance.tsx` | **BUG 3 — Enhance from result navigates back to result instead of chat.** result.tsx enhance chip passes `source: 'result'` in params. enhance.tsx `handleSubmit` checks `String(params.source) !== 'result'`; when source is `'result'`, pushes to `/review/chat` with `enhance_context` instead of calling `router.back()` + `setPendingEnhance` (which result.tsx can't consume). |
| 16 | `app/review/chat.tsx` | **BUG — handleRetry (rephrase) generates generic review with no context.** Old code called `chat/start` unconditionally, creating a fresh session the AI knew nothing about. New logic: reuse `sessionId` if live; only call `chat/start` when `sid` is null (session expired). The `chat/message` now embeds the current `generatedReview` text verbatim in the rephrase prompt so the AI always rephrases the actual review rather than hallucinating a new one. |
| 17 | `app/review/enhance.tsx` | **BUG — blank enhance_context sent when no tags selected.** Added `hasSelections` boolean (`emotion !== null \|\| aspects.size > 0 \|\| tone !== null \|\| goal !== null`). When false, `handleSubmit` calls `router.back()` without `setPendingEnhance` (branch 1) or navigates to chat without the `enhance_context` param (branch 2), so no empty message is sent to the AI. |
| 18 | `app/review/result.tsx` | **"Enhance with AI" skips enhance screen for old reviews.** Added `checkingHistory` state. Enhance chip `onPress` now calls `handleEnhanceTap`: fetches `GET /reviews/:id/chat/history`; if length > 0 (old review), navigates directly to `/review/chat` with existing params + resolved `business_name`; if length === 0 (new review), navigates to `/review/enhance` as before. Chip shows `<ActivityIndicator>` and is disabled while the check is in flight (<1 s). Falls back to enhance screen on any API error. |
| 19 | `app/review/chat.tsx` | **Added Regenerate button alongside Rephrase in the AI-Generated Review card.** New `regenerating` state; new `handleRegenerate` function: reuses existing `sessionId` (or starts a new session if expired) then calls `chat/approve` directly — no rephrase message sent. The approved text replaces the review and is PATCHed to the server. Rephrase and Regenerate buttons are mutually exclusive: each disables the other via cross-referenced `disabled` props. Regenerate uses `sync-outline` icon. |
| 20 | `app/review/chat.tsx` | **FIX — handleRegenerate requires active session.** Removed `chat/start` fallback. Added `Alert` to react-native imports. If `sessionId` is null, shows `Alert('Continue the conversation first', 'Send a message about what you want to add or change, then tap Regenerate to update the review.')` and returns early. If session is active, calls `chat/approve` directly using `sessionId`. Error catch now also shows `Alert('Error', 'Could not regenerate the review. Please try again.')`. |
| 21 | `app/review/chat.tsx` | **FIX — AI had no context at chat/start.** In `initChat`, before the `chat/start` call, parse `params.enhance_context` into `enhanceCtx` and build `contextNote` string (`"The user rated this experience N out of 5 stars. They felt X. They want a Y tone. Their goal is to Z. Key aspects: A, B."`). Pass it as `listing_context.context_note` so the AI has full user context from the very first message. |
| 22 | `app/review/result.tsx` | **FIX — overall rating was read-only.** Added `editableRating` state (init: `Number(params.rating) \|\| 4`; synced from API in useEffect). Replaced static `Ionicons` stars in `renderPlatformCard` with tappable `TouchableOpacity` stars that call `setEditableRating(s)` + `PATCH /reviews/:id { rating: s }`. Added "Tap to change rating" hint label. Also updated `sentiment` to derive from `editableRating` so the label stays in sync. |
| 23 | `app/review/chat.tsx` | **BUG — breakdown screen always empty.** `handleSubmit` was passing `network_ids` (UUIDs) but breakdown.tsx reads `selected_networks` (slug array). Added `buildSelectedSlugs()`: calls `GET /networks`, splits `params.network_ids` on commas, filters by `network_id`, maps to `slug`. `handleSubmit` made `async`; calls `buildSelectedSlugs()` and passes result as `selected_networks: JSON.stringify(selectedSlugs)` in the breakdown push. Falls back to `[]` on network error so breakdown skips gracefully. |
| 24 | `app/review/chat.tsx` | **FIX — breakdown showed original star rating, not AI-updated rating.** Added `approvedRating` state (`number \| null`, init `null`). In `handleApprove`, after extracting `reviewText`, call `setApprovedRating(data.rating ?? Number(params.rating))` so the AI-returned rating is captured. In `handleSubmit`, override `rating` in the breakdown push params with `String(approvedRating ?? params.rating)` instead of the stale `params.rating` from rate.tsx. |
| 25 | `app/review/networks.tsx` | **BUG — network toggles used `net.id` but API returns `network_id`.** Changed `Network` type from `{ id }` to `{ network_id }`. Updated `selectAll`, `key`, `Switch value`, `Switch onValueChange` to all use `net.network_id`. This means `selected` now holds real UUIDs instead of `undefined`. |
| 26 | `app/review/networks.tsx` | **BUG — `network_ids` was JSON-stringified array, but `buildSelectedSlugs` expected comma-separated string.** Changed nav param from `JSON.stringify([...selected])` to `[...selected].join(',')` so the value is a plain comma-separated UUID string that `.split(',')` can parse correctly. |
| 27 | `app/review/chat.tsx` | **ROBUSTNESS — `buildSelectedSlugs` now handles both formats.** Added `raw.startsWith('[')` branch: if `network_ids` is a legacy JSON array string, `JSON.parse` it; otherwise `.split(',')`. Removed three debug `console.log` lines added during investigation. `breakdown.tsx` debug logs also removed. |
| 28 | `utils/platformConfig.ts` | **FEATURE — business-type-aware breakdown categories.** Added `BUSINESS_TYPE_CATEGORIES` map (restaurant/cafe/fitness/gym/hotel/retail/entertainment/default) and `getCategoriesForBusiness(businessType)` helper that substring-matches the business type key and returns the appropriate category list. |
| 29 | `app/review/breakdown.tsx` | **FEATURE — breakdown now shows categories matching the business type, not the platform.** Imported `getCategoriesForBusiness`; derived `businessCategories` once from `params.business_type`; replaced `const subs = cfg.breakdownCategories` with `const subs = businessCategories` so every platform card shows the same relevant categories for that business. |

**reviews.tsx tab endpoints:**
- All → `GET /reviews`
- Published → `GET /reviews?status=posted`
- Draft → `GET /reviews?status=draft`

**Status badge colors:**

| Status | Background | Text |
|---|---|---|
| draft | `#2A3045` | `#8B9099` (grey) |
| pending | `#3A2E00` | `#FFB800` (amber) |
| posted | `#1B4332` | `#22C55E` (green) |
| failed | `#3A0000` | `#EF4444` (red) |

---

## 14. Demo Flow (June 10)

The exact journey to demonstrate:

1. Register new user → login
2. Home screen → tap "Share review"
3. Search "McDonald's Paris" → results appear
4. Tap result → save listing → network select
5. Select Yelp + Google → Next
6. Rate 4 stars → Next
7. Choose "Voice review" → record 30 seconds → End
8. AI transcribes → chat conversation → AI generates review
9. Submit review → see generated text
10. Tap "Post to Yelp" → text copied → Yelp opens → paste → done
11. Tap "Post to Google" → text copied → Google opens → paste → done
12. Thank you screen

Total demo time: ~3 minutes

---

## 15. Day-by-Day Build Plan

| Day | Screens to build |
|---|---|
| Day 5 | Scaffold + auth screen + home screen + search screen |
| Day 6 | Full review flow (networks → rate → type → voice → chat → result) |
| Day 7 | Photos + thankyou + history tab + Railway deploy |
