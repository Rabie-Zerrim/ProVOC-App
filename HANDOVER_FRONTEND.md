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
WebView: react-native-webview 13.15.0 — Google auto-post screen
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

### Screen 17b: WebView Auto-Post (Google) — `app/review/webview-post.tsx`
**Design:** Dark header + full-screen WebView + status bar at bottom.

**Params received:**
- `review_url` — Google review deep link from publish-link API
- `review_text` — generated review text (pre-copied to clipboard as backup)
- `rating` — overall star rating (1–5 string)
- `food_rating`, `service_rating`, `atmosphere_rating` — optional sub-ratings (1–5 string, empty if not set)
- `business_name` — displayed in header
- `review_id` — used for PATCH /reviews/:id after success

**Elements:**
- Header: "Posting to Google..." + back arrow
- Full-screen WebView loading the Google review URL
- Status bar (bottom): animated indicator + current step text:
  - "Waiting for review form..." (polling)
  - "Filling review..." (found textarea, filling)
  - "Submitting..." (clicking Post button)
  - "Review posted!" (green ✓, auto-navigates home after 2s)
  - "Form not found — fill manually" (amber ⚠, timeout after 15 s)

**WebView injection logic:**
1. Poll every 500 ms for `textarea[jsname="YPqjbf"]` (max 30 attempts = 15 s)
2. Fill textarea using native prototype setter + `input`/`change` events so React detects the change
3. Click overall star: `div[aria-label="Rating stars"] div[role="radio"][data-rating="${rating}"]`
4. If food/service/atmosphere non-empty, click corresponding sub-rating stars
5. Wait 1 500 ms, find submit: `button[jsname="b3VHJd"]` or any `<button>` containing "Post"
6. Click submit, wait 2 s, `postMessage('submitted')`

**On submission:**
- PATCH /reviews/:id `{ status: 'published' }`
- Navigate to `/(tabs)/home` after 2 s delay
- `handled` guard prevents double-fire if injected JS runs on redirect pages

**Triggered from:** `result.tsx` — when platform slug is `'google'`, `handlePost` navigates here instead of calling `Linking.openURL`. Review text is also copied to clipboard silently as fallback in case auto-fill fails.

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
    ├── webview-post.tsx   → Google WebView auto-fill & submit
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
| 30 | `app/review/webview-post.tsx` (new) + `app/review/result.tsx` | **FEATURE — Google auto-post via WebView.** New screen `webview-post.tsx` opens the Google review URL in a WebView, polls for the review textarea (`jsname="YPqjbf"`), fills it via native prototype setter, clicks star ratings, clicks the Post button, and PATCHes the review status to `published` on success. `result.tsx` `handlePost` now forks on `platformSlug === 'google'`: navigates to `/review/webview-post` with review text, rating, and sub-ratings instead of calling `Linking.openURL`. Text is still copied to clipboard silently as a fallback. Dependency added: `react-native-webview@13.15.0`. |

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

## 14. Demo Flow (June 12 — updated)

> **Note:** Step 11 below was revised. Google blocks WebView authentication since 2021, so the WebView auto-fill approach was abandoned. Google posting now uses clipboard + `Linking.openURL` (external browser), same as all other platforms. User pastes the pre-copied review text manually.

The exact journey to demonstrate:

1. Register new user → login
2. Home screen → tap "Share review"
3. Search "McDonald's Paris" → results appear with business photos
4. Tap result → save listing → network select
5. Select Yelp + Google → Next
6. Rate 4 stars → Next
7. Choose "Voice review" → record 30 seconds → End
8. AI transcribes → chat conversation → AI generates review
9. Submit review → see generated text
10. Tap "Post to Yelp" → text copied → Yelp opens in browser → paste → done
11. Tap "Post to Google" → text copied → Google review page opens in browser → paste → done
12. Thank you screen

Total demo time: ~3 minutes

---

## 14b. Demo Flow (original — June 10)

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
11. Tap "Post to Google" → WebView opens Google review form → auto-fills text + stars → auto-submits → "Review posted!" → home
12. Thank you screen

Total demo time: ~3 minutes

---

## 15. Day-by-Day Build Plan

| Day | Screens to build |
|---|---|
| Day 5 | Scaffold + auth screen + home screen + search screen |
| Day 6 | Full review flow (networks → rate → type → voice → chat → result) |
| Day 7 | Photos + thankyou + history tab + Railway deploy |

---

## 16. Applied Fixes (2026-06-12)

| # | File | What changed |
|---|---|---|
| 31 | `app/search.tsx` | **Search params migrated to Google Places format.** `doSearch` now sends `q` + `lat` + `lng` instead of `name` + `address`. Coordinates always present — falls back to Tunis centre (`36.8065, 10.1815`) when GPS is unavailable or not yet resolved. |
| 32 | `app/search.tsx` | **Business photos load directly from `photo_reference`.** Added `photo_reference?: string` to `SearchResult` type. `doSearch` spreads `...entry` (preserving `photo_reference` when the backend sends it). `SearchResultItem` builds the photo URL directly without a separate API call: `https://places.googleapis.com/v1/{photo_reference}/media?maxWidthPx=400&key=...` (Google Places New API format). Falls back to `getBizPhoto` when `photo_reference` is absent. |
| 33 | `app/search.tsx` | **Removed `usePlacePhoto` hook.** The hook fired a `/place/details/json` round-trip per result row to fetch a `photo_reference`, then built the photo URL. That is now unnecessary because the backend already returns `photo_reference` in the search response. Import and all call sites removed. |
| 34 | `app/search.tsx` | **Network badge normalization.** `SearchResultItem` derives `networkLabel` from `item.network`: any key that starts with `"google"` (case-insensitive — covers `google`, `Google_1`, `google_2` etc.) displays as `"Google"`; all others get their first letter uppercased. Badge now shows `networkLabel` instead of the raw API key. |
| 35 | `app/review/networks.tsx` | **Same Google network label normalization applied.** Added `networkLabel(slug: string)` helper at module level (same logic as fix 34). Platform name in the toggle row changed from `{net.name}` to `{networkLabel(net.slug)}` so "google_1" / "Google_2" etc. all display as "Google". |
| 36 | `app/review/result.tsx` | **Google posting reverted to clipboard + `Linking.openURL`.** The WebView auto-fill approach (`webview-post.tsx`) was abandoned: Google has blocked WebView-based authentication since 2021, causing the sign-in step to fail silently. `handlePost` for `platformSlug === 'google'` now follows the same path as Yelp / Facebook / Trustpilot — copies review text to clipboard and opens the Google review URL in the device's default browser. Per-platform posted status is tracked locally so the button updates after the user returns. |
| 37 | `app/review/chat.tsx` | **`handleRegenerate` starts a fresh session with full history.** Previous implementation called `chat/approve` directly with `sessionId`, which failed silently when the Redis session had expired (5-min TTL). New logic: always calls `chat/start` to open a fresh session, passes the current `generatedReview` text as a prior-message so the AI has context, then immediately calls `chat/approve` on the new session. Falls back to an Alert when no generated review text exists to regenerate from. |
| 38 | `.env` | **`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` added.** Required for the Places New API photo endpoint (fix 32). Key is scoped to the Places API and must be included in Expo builds via `app.config.js` `extra` or left as an `EXPO_PUBLIC_` prefix so Expo injects it at build time. |

**Dependencies note:**
- `react-native-webview@13.15.0` was added during the WebView auto-fill attempt (fix 30 in section 13). The `webview-post.tsx` screen still exists in the repo but is no longer navigated to — `result.tsx` routes all platforms through `Linking.openURL`. The package can be removed if bundle size is a concern, but it is otherwise harmless.

---

## 17. Known Limitations & Architecture Decisions

### Review platform posting
All review platforms (Google, Yelp, Facebook, Tripadvisor, Trustpilot) use **clipboard + external browser** as the posting mechanism:
1. `GET /reviews/:id/publish-link?platform_id=<uuid>` returns the deep-link URL and review text.
2. Review text is copied to clipboard via `expo-clipboard`.
3. URL is opened in the device browser via `Linking.openURL`.
4. User pastes the text and submits manually.

This is **intentional, not a limitation** — Google, Yelp, and Facebook all actively block:
- WebView-based authentication (Google has blocked this since 2021 under the "Google Sign-In from embedded browsers" policy).
- Automated form submission via injected JavaScript (rate-limited and flagged as bot activity).

The clipboard + external browser approach is the industry standard used by Birdeye, Podium, and similar review management SaaS products.

### Account switching
Because posting opens the system browser (not a WebView), users can freely switch Google/Yelp accounts in the browser without the app interfering. A WebView would have trapped cookies and required explicit sign-out flows.

### Photo availability
`photo_reference` is only present in search results when the backend's Zembra/Google Places response includes it. For OSM nearby results (category chip search), `photo_reference` is never present — `getBizPhoto` fallback images are used instead.

### WebView screen (`app/review/webview-post.tsx`)
~~This file exists in the repo but is dead code as of 2026-06-12.~~ **Deleted as of 2026-06-13.** Google posting now uses Chrome Custom Tabs via `react-native-inappbrowser-reborn` (see section 18, fix 42). `react-native-webview` can be removed from `package.json` if not used elsewhere.

---

## 18. Applied Fixes (2026-06-13)

| # | File | What changed |
|---|---|---|
| 39 | `app/(tabs)/home.tsx` | **FEATURE — "Recommended For You" section.** Added `recommendations` state + `useEffect` that calls `GET /recommendations` (pv-bff) on mount. Renders a horizontal scroll section above the CTA card, hidden when the array is empty (cold start / no data). |
| 40 | `hooks/usePlaceRating.ts` (new) | **New hook — live Google rating per Place ID.** Calls `https://places.googleapis.com/v1/places/{placeId}?fields=rating&key=...` (Google Places New API). Only fires for valid `ChIJ…` Place IDs. Returns `number \| null`. Same guard pattern as `usePlacePhoto`. |
| 41 | `app/(tabs)/home.tsx` | **`RecommendationCard` component — full review flow tap.** Each recommendation card calls `usePlaceRating(rec.business_id)` to display a live Google rating. `onPress` is async: first calls `POST /listings` with `external_listing_id: rec.business_id` to create/retrieve a BFF listing record, then navigates to `/review/networks` with the returned BFF UUID as `listing_id`. Falls back to `Alert` on error. This exactly mirrors the search flow — Google Place ID never passed directly as `listing_id`. `useRouter()` is called inside the component so it has access to the `rating` value from the hook. |
| 42 | `app/review/result.tsx` + `app/review/webview-post.tsx` (deleted) | **FEATURE — Google posting via Chrome Custom Tab (InAppBrowser).** Replaced `Linking.openURL` (external browser) with `react-native-inappbrowser-reborn`. `handleGooglePost(url, reviewText)`: copies review text to clipboard, then opens the Google review URL inside ProVOC using a Chrome Custom Tab (stays within the app, uses the device's signed-in Google account). `handleMarkAsPosted()`: PATCHes `/reviews/:id` `{ status: 'published' }` when user manually confirms posting. Falls back to `Linking.openURL` if `InAppBrowser.isAvailable()` returns false (e.g. iOS without Safari). `webview-post.tsx` deleted. |
| 43 | `.gitignore` | **`.env` added to `.gitignore`.** The `.env` file contained `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` and was previously tracked by git. It is now excluded. Developers must create `.env` locally from `.env.example` (or manually). EAS builds must inject the key via EAS Secrets or `eas.json` `env` block. |

**Dependencies added (2026-06-13):**
- `react-native-inappbrowser-reborn` — Chrome Custom Tabs (Android) / SFSafariViewController (iOS). Required for Google posting fix 42.

**Dependencies now unused:**
- `react-native-webview@13.15.0` — added for the original WebView auto-post attempt (fix 30). Can be removed from `package.json` since `webview-post.tsx` was deleted.

---

## 19. APK Build Notes

### When a rebuild is required

| Change type | Rebuild needed? |
|---|---|
| Frontend JS/TSX code changes (new features, bug fixes, UI) | **Yes** — Metro bundles must be recompiled into the APK |
| New npm package added | **Yes** — native modules require a new native build |
| Backend-only change (pv-bff or pv-ai on Railway) | **No** — the app connects to the same API URL; no rebuild |
| `.env` / EAS Secret change | **Yes** — `EXPO_PUBLIC_*` vars are baked in at build time |

### All 2026-06-12 and 2026-06-13 frontend changes require a new APK

Changes requiring rebuild (in order of implementation):
- Search: `q` + `lat`/`lng` params, `photo_reference` direct URL, network badge normalization
- Networks: Google label normalization
- Home: Recommended For You section, `usePlaceRating` hook
- Result: Chrome Custom Tab posting (`react-native-inappbrowser-reborn` native module)

### Building with EAS

```bash
# Free tier — queue can take 40–60+ minutes
eas build --platform android --profile preview

# Check build status
eas build:list
```

Set `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` in EAS Secrets before building:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value <key>
```

### Latest APK
[paste new URL here after EAS build completes]

---

## 20. Applied Fixes (2026-06-17)

| # | File | What changed |
|---|---|---|
| 44 | `app/search.tsx` | **FIX — multi-network lookup restored via `/zembra/match`.** `saveAllPlatforms` and the OSM branch in `handleSelect` previously called `GET /listings/search?networks[]=...` to fetch secondary-platform matches (Yelp, Trustpilot, etc.) alongside the primary Google Places result. This silently broke when pv-bff's `/listings/search` was migrated to Google Places API only (pv-bff `HANDOVER_BFF.md` commit `63454d0`, "replace Zembra search with Google Places API") — the endpoint now only accepts `q`/`lat`/`lng` and ignores `networks[]`, so every result showed only "Google" regardless of other platform presence. Replaced both call sites with `GET /zembra/match?name={name}&address={address}` (pv-bff's dedicated Zembra-lookup endpoint). Response shape changed from `{ data: { [slug]: {...} } }` to `{ networks: { google?: {...}, yelp?: {...} } }` — updated all downstream parsing accordingly. Since the new endpoint only returns `url`/`rating`/`reviewCount` per network (no `id`/`name`/`formattedAddress`), secondary-platform `POST /listings` saves now use a synthetic `external_listing_id`: `zembra-${slug}-${businessId}` (or `zembra-${slug}-osm-${osmId}` in the OSM branch before a real `businessId` exists), paired with the real `external_url` from the Zembra response. pv-bff's `getPublishLink()` fallback logic (see `HANDOVER_BFF.md`) specifically handles this synthetic-ID convention to still build correct deep links. Removed the now-dead `primarySlug` variable and `entry.name`/`entry.formattedAddress` fallback reads (fields the new endpoint doesn't return) — business name/address are always taken from the original search input now, not echoed back from the network-match response. |
| 45 | `app/search.tsx` + `app/review/result.tsx` | **FIX — double-tap bug on search results and history items.** Symptom: tapping a search result or history item required two taps — the first appeared to do nothing (no loading state, no navigation, no error), the second triggered `handleSelect`/`handleHistorySelect` normally. Root cause: `search.tsx`'s search `TextInput` has `autoFocus`, so the keyboard is open immediately on screen mount/re-focus; the results and history `FlatList`s had no `keyboardShouldPersistTaps` prop, defaulting to React Native's `'never'` — the first tap on any touchable inside those lists only dismissed the keyboard instead of firing `onPress`. Added `keyboardShouldPersistTaps="handled"` to both `FlatList`s. Same pattern found and fixed in `result.tsx`: its inline review-text editor has `autoFocus` and shares a `ScrollView` with the save checkmark, "Enhance with AI" chip, and platform "Tap to share" cards — added the same prop to that `ScrollView`. `chat.tsx`'s two `autoFocus` inputs (edit-review textarea, chat message input) were checked and confirmed **not** affected — both sit in plain sibling `View`s outside the message `FlatList`, not sharing a scrollable container, so no gesture-responder conflict exists there. |

**Verification (2026-06-17):**
- `npx tsc --noEmit` → 0 errors after both fixes.
- Manually tested on device via Expo dev client: search → tap result → networks screen now shows Google + Yelp together when Zembra has a real match for both (confirmed with Shake Shack Madison Square Park, a US business with both Google and Yelp presence — most Tunisia-based test businesses only show Google, since Yelp's Tunisia coverage is essentially nonexistent; this is expected, not a bug).
- Double-tap fix confirmed: single tap now works correctly on both search results and history items.

---

## 21. Applied Fixes + Open Issue (2026-06-17, late session)

| # | File | What changed |
|---|---|---|
| 46 | `app/search.tsx` | **FIX — `handleSelect`/`handleHistorySelect` double-invocation race.** Confirmed via Railway deploy logs that a single tap on a search result could log "ZEMBRA MATCH RESULT" twice, back to back — meaning `handleSelect`'s full async body (including `saveAllPlatforms`) ran twice concurrently for one tap. The existing `if (saving) return` state-based guard was insufficient: `TouchableOpacity`'s `onPress` can fire twice in rapid succession on some devices, and since `setSaving()` is asynchronous, both near-simultaneous invocations could read `saving` as `false` before the first call's `setSaving(true)` had actually committed and re-rendered. Added a synchronous `useRef<boolean>` guard (`isSelectingRef`) checked and set immediately at the very top of `handleSelect`, before any async work — refs update instantly with no render-cycle delay, closing the race that state alone couldn't. `handleHistorySelect` got its own separate `isHistorySelectingRef` (not shared, since they guard unrelated actions) — deliberately **not** reset after navigation, since resetting synchronously would reopen the same race for a function with no async work to naturally serialize against; the stale `true` becomes harmless once the screen unmounts via navigation. This bug was responsible for some of the duplicate-Google-listing data found and cleaned up earlier in this same session (see pv-bff's `HANDOVER_BFF.md` and the cleanup scripts `check_shake_shack.js` / `cleanup_duplicate_google_networks.js` / `cleanup_duplicate_google_listings.js`) — though note: this race was ultimately **not** the primary cause of the one remaining unresolved case (see Open Issue below); it's a real, separate bug that's now fixed regardless. |
| 47 | `app/search.tsx` + `app/review/chat.tsx` + `utils/withNetworkErrorRetry.ts` (new) | **FIX — network-error retry on `handleSelect`'s primary listing saves.** New shared file `utils/withNetworkErrorRetry.ts`: extracted from `chat.tsx`'s existing helper (added earlier today for the `chat/start` network-error issue) into a reusable module; `chat.tsx` now imports it instead of defining its own local copy. Wrapped all primary `POST /listings` calls inside `handleSelect` (OSM-branch Zembra-match save, OSM-branch raw-OSM fallback save, and the plain Google/Yelp branch's primary save) with `withNetworkErrorRetry`: on a genuine transient network error (`err.response` undefined — axios's "Network Error", no HTTP response at all received), waits ~800ms and retries the exact same call once before giving up. Real 4xx/5xx server responses are **not** retried and propagate immediately as before. `saveAllPlatforms`'s individual `Promise.allSettled` secondary-platform calls were deliberately left unwrapped — they already fail gracefully/independently per platform. Also added a permanent `Alert.alert('Could not save this business', 'Please try again.')` fallback in `handleSelect`'s outer catch block for the case where the error isn't recoverable via the existing `existingId`-from-response-body pattern. Previously, any error not matching that exact shape was silently swallowed — the saving overlay would briefly appear then disappear with zero feedback, looking like the tap "did nothing." This was the proximate cause of multiple confusing "I have to tap it twice" reports investigated this session — the user's first tap was genuinely failing silently; pressing again just retried the whole flow from scratch. |

### Open issue — one business reproducibly fails its first save attempt

One specific test business ("Shake Shack" / Levazım, Vadi Cad Zorlu Center, Beşiktaş/İstanbul, Türkiye — business_id `6f618e46-357e-4052-b886-1f19209110cc` in the current Railway DB) consistently fails `handleSelect`'s primary `POST /listings` call on the first attempt with `err.message === 'Network Error'` and `err.response === undefined` (confirmed via temporary diagnostic logging) — even **after** the network-error-retry fix (Fix 47) was deployed and confirmed working in general. A second, separate tap always succeeds.

This is **not** explained by the double-invocation race (Fix 46, ruled out via ~50-second gap between the two ZEMBRA MATCH RESULT log lines — far too long to be a rapid-`onPress` double-fire) and **not** explained by request payload size (the `POST /listings` body for this business is identical in shape/size to working businesses — confirmed via direct code read; the unusually long Google Places `photo_reference` value is **not** included in this request body).

Hypotheses not yet tested:
- Something Railway-edge or geography-specific (this is the only tested business with a Turkish address/non-US, non-Tunisia location) — worth testing with a fresh, never-before-saved Turkish or other unusual-locale business to see if the issue is systematic rather than tied to this specific business_id's history.
- This business_id's row may carry some residual corruption from being part of multiple duplicate-listing cleanup operations earlier in this same session (see pv-bff's cleanup scripts) — worth testing whether a completely fresh business at the same real-world location (forcing a new business_id) behaves differently than re-selecting this specific already-existing business_id.
- Worth checking Railway's actual request logs (not just deploy logs) for this specific failing request to see if it's being rejected at the edge/proxy layer before reaching the NestJS app at all, which would explain why no response body is ever formed.

Flagged for investigation in a future session — not resolved as of 2026-06-17.

---

## 22. SESSION 2026-06-19 — PROFILE FEATURE SET, POSTING FLOW FIXES, AI CHAT FIXES, AND DASHBOARD RELOCATION

### 1. Profile screen — three placeholder features made real

`app/(tabs)/profile.tsx` previously had three non-functional pieces, all now backend-connected:
- **Avatar**: `PATCH /users/me/avatar` with a base64 data URI (via `expo-image-picker`'s `base64: true` option). Previously AsyncStorage-only, never synced to the server.
- **Edit name/email**: new inline edit UI (tap pencil → two fields → Save/Cancel), `PATCH /users/me`, 409 conflict shows inline "email already in use" error.
- **Platform preferences**: `GET`/`PATCH /users/me/preferences` (via `withNetworkErrorRetry`). `preferred_networks` is the ENABLED-platforms list (confirmed final semantics — an inclusion list, not exclusion). Previously AsyncStorage-only.
- **Password change** (new): inline form (current/new/confirm), `PATCH /users/me/password`, 401 shows "Current password is incorrect" on the specific field.

### 2. Avatar persistence bug — root cause + cross-file fix

Avatar showed correctly on Profile but not after a fresh login, and not on Home. Root cause: `/auth/login` and `/auth/register` return a minimal user object without `avatar_data`; only `/auth/me` includes it.
- `app/auth.tsx`: now calls `GET /auth/me` (via `withNetworkErrorRetry`) right after login/register to cache the full profile; falls back to the minimal shape if that call fails.
- `app/(tabs)/profile.tsx`: broadened the `fetchMe()` trigger condition to also fire when `avatar_data` is `undefined` (not just when `display_name` is missing).
- `app/(tabs)/home.tsx`: was reading avatar from a separate, never-updated AsyncStorage-only path — fixed to prefer `user.avatar_data`, matching Profile's pattern.

### 3. Login/register keyboard overlay fix

`app/auth.tsx`: `KeyboardAvoidingView`'s `behavior` prop was `undefined` on Android (only set for iOS), hiding fields behind the keyboard. Fixed to `'height'` for Android.

### 4. Dashboard — added to Reviews tab, then relocated to Profile

Status badge icons (`checkmark-circle`/`time-outline`/`create-outline`/`close-circle`) + slightly larger badges added to `app/(tabs)/reviews.tsx` — this stays on Reviews.

A donut chart (new dependency: `react-native-svg` — requires an APK rebuild to take effect on a built app) + legend + totals, plus a "Your Ratings" category-breakdown card, were added to the Reviews tab but pushed the review list down to ~1 visible item per scroll — both were relocated entirely to the Profile tab instead, replacing the old 4-card stat row there. Reviews tab today = status tabs + star filter + full-height review list + icon badges only.

### 5. Category ratings now actually saved and displayed

`app/review/breakdown.tsx`: star ratings were captured but never persisted. Now flattens platform-nested ratings into a flat category map (averaged across platform cards) and sends `PATCH /reviews/:id { category_ratings }` via `withNetworkErrorRetry`, non-blocking on failure. Displayed via Profile's "Your Ratings" card, sourced from `GET /reviews/category-breakdown`. (Backend fields/endpoints documented in `HANDOVER_BFF.md`.)

### 6. Selected-networks persistence

Fixes: reopening an old review from the Reviews tab always showed every platform the listing had, not just the originally selected ones. `app/review/result.tsx` now fires a one-time `PATCH` on first live-flow load persisting the actually-filtered network slugs; filtering logic prefers the persisted value (`review.selected_networks`) over the nav param, falling back to "all networks" only when neither was ever set (e.g. pre-feature reviews). Backend field documented in `HANDOVER_BFF.md`.

### 7. Google/Yelp posting flow fixes

- `handleMarkAsPosted`: `PATCH` status value changed from `'published'` to `'posted'` (matches the value `STATUS_COLORS`/dashboard actually use — `'published'` was a vestigial, never-reachable value from an earlier abandoned automatic-posting design). Wrapped in `withNetworkErrorRetry`; now shows a visible Alert on failure instead of silently swallowing it.
- **Real bug found and fixed**: `InAppBrowser` can resolve to `null` entirely in Expo Go (the native module isn't linked there at all) — calling `.isAvailable()` on it threw synchronously, which was being silently caught by the function's outer catch, killing the "did you post?" confirmation dialog every single time on Expo Go. Fixed with a dedicated nested try/catch specifically around the availability check, so any internal `InAppBrowser` failure now safely falls through to the working `Linking.openURL` path instead of crashing out before the dialog can show.
- `handleGooglePost` renamed to `openPlatformPostFlow` (the logic was already fully generic) — Yelp's posting branch now shares this exact same Custom-Tab-attempt + confirmation-dialog flow instead of its own plain `Linking.openURL` implementation with no Custom Tab attempt at all.
- Google's non-Custom-Tab fallback branch was missing the confirmation dialog the Custom Tab branch had (only existed inside the `InAppBrowser.isAvailable()` branch) — added so both branches end the same way.

### 8. AI chat screen fixes (`app/review/chat.tsx`)

- `handleRetry` (rephrase) and `handleRegenerate` both had silent-failure paths (AI returns empty/falsy text → reverts to the previous version with zero user feedback). Added `Alert.alert` on both the empty-result branch and the catch block (where missing).
- Real root cause found for "rephrase/regenerate doesn't incorporate new messages": `handleRetry` previously only ever rephrased the static `generatedReview` text, completely blind to anything typed afterward in chat. Now tracks `lastGeneratedMessageCountRef` (updated at every generate/rephrase/regenerate success point) and folds in any new user messages since the last generation into the rephrase instruction. (Separately — and more significantly — a pv-bff bug where `previous_messages` was silently never forwarded to pv-ai at all was also found and fixed; see `HANDOVER_BFF.md` and `HANDOVER_AI.md`. Both fixes were needed together for regenerate to genuinely incorporate new context end-to-end, confirmed via live testing.)
- Input bar: added an always-visible mic button (direct nav to `/review/recording`, same target as the existing `tapToSpeak` button). The old conditional mic-toggle button became visibly redundant (duplicated on screen once a review was generated) and was removed; other `voiceMode`-dependent behaviors (`tapToSpeak` visibility, send button icon/color) were left untouched.

### 9. Recording screen fixes (`app/review/recording.tsx`)

- `POST /reviews` and `POST /reviews/:id/transcribe` wrapped in `withNetworkErrorRetry`.
- Added a visible "Uploading and transcribing... this can take up to 3 minutes" message during upload (previously a bare spinner with no context).
- Transcribe timeout raised from 120s to 180s — Railway logs showed real transcription taking 130-135s on the baseline Whisper model in production; the old timeout was producing false "server unreachable" errors on requests that were actually succeeding server-side.
- `utils/withNetworkErrorRetry.ts` gained an optional `retryOnTimeout` param (default `true`; every other existing call site unaffected by the default). The transcribe call opts out (`retryOnTimeout: false`), since a timeout there means "still working, just slow," not "failed" — retrying would silently double an already-long wait to ~6 minutes worst case.

### 10. New duplicate-review guard on search

`app/search.tsx`'s `handleSelect`: after a listing save resolves, now calls `GET /reviews/recent-check?business_id=...` (soft, non-blocking) — if the business was reviewed in the last 24h, shows a "Review again?" confirmation before proceeding to network select. (Backend endpoint documented in `HANDOVER_BFF.md`.)

### Known open issue, unchanged

The previously-logged Shake Shack/Istanbul reproducible save failure (section 21) was not revisited this session and remains unresolved.

### Note: new native dependency requiring an APK rebuild

`react-native-svg` was added this session (for the donut chart, now on the Profile tab). Any APK build predating this dependency will not show the chart correctly until rebuilt — Expo Go/dev client picks it up without a rebuild.

---

## 24. SESSION 2026-06-24 — MERGE EDIT PROFILE + CHANGE PASSWORD INTO ONE MODAL

### Change: two modals → one unified "Edit Profile" modal (`app/(tabs)/profile.tsx`)

The two modals introduced in session 23 (Edit Profile with name/email, Change Password with 3 fields) have been merged into a single "Edit Profile" modal with all five fields and a visual divider between the profile section and the optional password-change section.

**Modal layout (top to bottom):**
1. Title: "Edit Profile"
2. Display name input
3. Email input
4. Inline error for 409 ("Email already in use.") — shown under email
5. Divider + "CHANGE PASSWORD" section label
6. Current password input
7. Inline error for 401 ("Current password is incorrect.") — shown under current password
8. New password input
9. Confirm new password input
10. Inline error for mismatch / length / generic — shown under confirm
11. Cancel / Save buttons

**Save logic (`handleSave`):**
- Password fields are optional — only validated/sent if any of the three are non-empty
- Client-side validation (length ≥ 8, new === confirm) runs before any API call
- If profile fields changed: `PATCH /users/me` with `{ display_name?, email? }` — JWT via `api` interceptor, 409 → email error
- If password fields filled: `PATCH /users/me/password` with `{ current_password, new_password }` — 401 → current-password error
- Both calls can run in the same Save: profile call runs first; if it throws, password call is skipped. 409 and 401 are distinguishable by status code so the right inline error is always shown.
- Password-change success shows Alert ("Password changed"); profile-only save closes silently (same UX as before).
- Nothing changed → close modal without any API call.

**Removed:** separate "Change password" row/section from the profile screen, `startEditingPassword` / `cancelEditingPassword` / `handleSavePassword` functions, `editingPassword` and `savingPassword` state vars. Consolidated `savingProfile` + `savingPassword` into single `saving` flag.

**Modal UX:** `KeyboardAvoidingView` wraps the modal (behavior: 'padding' on iOS, 'height' on Android); `ScrollView` inside the card with `maxHeight: '88%'` so all fields are reachable on small screens.

**PATCH /users/me verification:** call at `profile.tsx:223` sends `{ display_name?, email? }` (only changed fields). Auth header is attached automatically by the `api` axios interceptor in `services/api.ts:7-10` (`Authorization: Bearer <token>` from `@provoc_token`). 409 handling is correct. No changes needed.

`tsc --noEmit` clean. No new dependencies.

---

## 23. SESSION 2026-06-24 — PROFILE EDIT FLOWS CONVERTED TO MODAL POPUPS

### Change: inline edit UI → Modal overlays (`app/(tabs)/profile.tsx`)

Both profile-edit flows were previously inline (expanding fields in place). Both are now React Native `Modal` components with a semi-transparent dark backdrop (`rgba(0,0,0,0.6)`) and a centered dark-card overlay matching the app's dark theme.

**Edit Profile modal** (triggered by the pencil icon on the user card):
- Title: "Edit Profile"
- Fields: `display_name`, `email`
- Inline error on 409 conflict: "Email already in use."
- Save calls `PATCH /users/me`, closes modal on success, updates displayed name/email
- Cancel closes modal and discards changes
- Logout button is now always visible (was conditionally hidden while the inline form was open)

**Change Password modal** (triggered by the "Change password" row):
- Title: "Change Password"
- Fields: current password, new password, confirm new password
- Inline error on 401: "Current password is incorrect." (shown beneath current-password field)
- Inline error for mismatch / length: shown beneath confirm field (client-side, no API call)
- Save validates new === confirm first, then calls `PATCH /users/me/password`, closes modal on success
- Cancel closes modal and clears all fields

**No backend changes.** API calls, error-handling logic, and state variables are identical to the prior inline implementation — only the JSX rendering changed.

**Styles added** (`modalBackdrop`, `modalCard`, `modalTitle`, `modalInput`, `modalError`, `modalActions`, `modalCancelBtn`, `modalCancelText`, `modalSaveBtn`, `modalSaveText`). Old inline-edit styles (`profileInput`, `profileError`, `profileEditActions`, `profileCancelBtn`, `profileCancelText`, `profileSaveBtn`, `profileSaveText`) removed.

`tsc --noEmit` clean after the change. No new dependencies.

---

## 27. SESSION 2026-06-24 — FIX REPHRASE CONTEXT LOSS ON SECOND+ CALL

### Bug fixed: `app/review/chat.tsx` — `handleRetry` session revival path

**Root cause:** `handleRetry` sets `setSessionId(null)` after every successful rephrase. On the next rephrase, `sid` is therefore `null`, triggering the revival path that calls `chat/start` to get a new session. That `chat/start` call was sending only `{ listing_context: { business_name, networks: [] }, language: 'en' }` — no `context_note`, no `previous_messages`. The AI started each second+ rephrase with a completely blank session and no knowledge of the conversation that had taken place.

**Fix:** The `chat/start` call inside `handleRetry`'s `if (!sid)` block now sends the same body as `handleRegenerate` already did:

```js
{
  listing_context: {
    business_name: params.business_name,
    networks: [],
    context_note: contextNote,
  },
  previous_messages: messages.map(m => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.text,
  })),
  language: 'en',
}
```

`contextNote` is the same computed string (rating, emotion, tone, goal, aspects) used by `initChat` and `handleRegenerate`. `previous_messages` gives the model full conversation history so each rephrase is meaningfully distinct from the last. `tsc --noEmit` clean. No other logic changed.

---

## 26. SESSION 2026-06-24 — FIX REPHRASE/REGENERATE REVERT BUG IN CHAT

### Bug fixed: `app/review/chat.tsx` — `handleRetry` and `handleRegenerate`

**Root cause:** Both functions ended their `if (newText)` block with a bare `await api.patch(...)` that had no inner try-catch. If that PATCH call failed (network hiccup, timeout, any server error), execution fell through to the outer catch block, which called `setGeneratedReview(prev)` and showed a "Could not rephrase" / "Could not regenerate" alert — even though the AI had already returned valid text and `setGeneratedReview(newText)` had already run. The UI reverted to the old review and the user saw an error despite a successful rephrase.

**Fix:** In both functions, wrapped the `PATCH /reviews/:id` call in its own inner try-catch that does not revert the UI on failure. The outer catch now only fires for actual AI failures (`chat/message`, `chat/start`, `chat/approve`) and logs the full error (`status`, `data`, `message`) via `console.error` so failures are diagnosable in Metro logs.

```js
// inside the if (newText) block, in both handleRetry and handleRegenerate:
try {
  await api.patch(`/reviews/${reviewId}`, { review_text: newText, rating: approveData.rating })
} catch {
  console.warn('Failed to persist review text after rephrase/regenerate')
  // UI already correct — don't revert
}

// outer catch now typed and logs before reverting:
} catch (err: any) {
  console.error('Rephrase/Regenerate failed:', err?.response?.status, err?.response?.data, err?.message)
  setGeneratedReview(prev)
  Alert.alert(...)
}
```

No other logic changed. `tsc --noEmit` clean.

---

## 25. SESSION 2026-06-24 — DUPLICATE REVIEW FIXES (FRONTEND)

These two changes complement the backend idempotency guard added in `HANDOVER_BFF.md §31`. Together, all three layers close the duplicate-review bug.

### Fix 1 — `chat.tsx`: persist `review_id` into route params after creation

`initChat()` creates a new review when `params.review_id` is absent (i.e. every fresh mount of `chat.tsx` coming from the Regular Review or Smart Review path). The existing `setReviewId(rid)` call updated React state, but React state is destroyed when the screen unmounts. In expo-router, pressing Back on `chat.tsx` pops it off the stack; navigating forward again from `type.tsx` pushes a new instance with no `review_id` in params — so `initChat()` ran again and called `POST /reviews` again.

**Fix:** after `POST /reviews` succeeds and `setReviewId(rid)` is called, `router.setParams({ review_id: rid })` is now also called. This writes `review_id` into the current screen's navigation params (the `expo-router` route state) without navigating. When the user presses Back and then pushes the same route again, expo-router restores the params from the stack — `params.review_id` is now populated on the new mount, so `initChat()` skips the `POST /reviews` call entirely.

**File changed:** [app/review/chat.tsx](app/review/chat.tsx) — inside `initChat()`, line after `setReviewId(rid)`:

```typescript
rid = data.review_id ?? data.id
setReviewId(rid)
router.setParams({ review_id: rid })   // ← added
```

### Fix 2 — `chat.tsx` + `recording.tsx`: remove `withNetworkErrorRetry` from `POST /reviews`

`POST /reviews` in both files was wrapped in `withNetworkErrorRetry`. That wrapper retries once on any error where `e?.response === undefined` (a network error with no HTTP response). Since `POST /reviews` is not strictly idempotent (even with the backend guard, a retry that races before the first insert commits could create a second row), the retry added an unreliable path to duplicates without meaningful benefit — transient network failures on `POST /reviews` are better surfaced as an error to the user than silently retried.

`withNetworkErrorRetry` is retained on every other call where it already exists (`chat/start`, `transcribe`, etc.).

**Files changed:**

| File | Change |
|---|---|
| [app/review/chat.tsx](app/review/chat.tsx) | `initChat()`: `POST /reviews` call unwrapped from `withNetworkErrorRetry` |
| [app/review/recording.tsx](app/review/recording.tsx) | `stopAndTranscribe()`: `POST /reviews` call unwrapped from `withNetworkErrorRetry` |

### Combined effect

With all three layers in place:
- If the user navigates Back from `chat.tsx` and re-enters, `params.review_id` is now set → `initChat()` skips `POST /reviews` → backend never sees a second create call.
- If a network hiccup occurs on `POST /reviews`, the call fails once rather than silently retrying.
- If the client somehow does send two `POST /reviews` calls for the same `(user_id, listing_id)` pair (e.g. through some other code path), the backend returns the existing draft instead of creating a new row.

---

## Session update — 2026-06-28

### Restitution 2 pptx updated (ProVOC_Restitution2_updated.pptx)
- Slide 1: supervisor name fixed (Mourad Abssi)
- Slide 5: Facebook removed from platform list
- Slide 19: DeepSeek → Groq Llama 3.3 70B (text panel only)
- Slide 22: all progress stats updated to current state
- Slide 23: next steps rewritten to real perspectives
- Slide 25: conclusion future work updated
- Slide 31: 162→165 tests

### Known diagram issues in pptx (manual fix needed)
- Slides 18 and 20: diagram images are swapped — need manual swap in PowerPoint
- Slides 18, 19, 20: sequence diagrams show wrong architecture:
  WebSocket (not used), YOLO (not implemented), Review Requirements Service 
  (does not exist), Faster-Whisper streaming (not implemented)
  → Presenter should explain verbally that diagrams were drawn at design phase

### Photo upload — current state
- photos.tsx screen exists in flow but images go nowhere (no backend endpoint)
- review_medias table exists in schema with s3_key field
- Planned: POST /reviews/:id/media + S3 integration + display in review history
- For now: skip photos screen in flow or leave as-is

---

## Session update — 2026-06-29

### app/review/photos.tsx — S3 photo upload wired up

State changed from `string[]` (local URIs) to `UploadedPhoto[]` (`{ media_id, url, uri }`) plus a `Set<string>` tracking which URIs are currently uploading.

**Upload flow:**
- `expo-image-manipulator` (newly installed, SDK-54 compatible, works in Expo Go) resizes each image to max 1200px width, compress 0.8, JPEG before upload
- Optimistic thumbnail appears immediately using the original local URI; a semi-transparent spinner overlay covers it while the upload is in flight
- `POST /reviews/:id/media` sent as `multipart/form-data`, field name `photo`, 30-second timeout override on the axios call
- On success: placeholder updated with real `{ media_id, url }` from response
- On failure: placeholder removed, Alert shown
- Multiple images from the picker all fire concurrently (no `await` in `forEach`), each tracked independently in the `uploading` Set

**Delete:** calls `DELETE /reviews/:id/media/:mediaId` first; if `media_id` is empty (still uploading), removes the placeholder locally with no API call.

**Next/Skip button:** disabled (`opacity: 0.4`, `disabled={true}`) while any upload is in flight. Label is "Next" when at least one photo is uploaded, "Skip" otherwise.

**`review_id`** comes from route params (already present — passed by `result.tsx` via `{ ...params }`).

### app/(tabs)/reviews.tsx — photo thumbnails in review history

New `ReviewPhoto` component defined at module level (so hooks are valid):
- Calls `GET /reviews/:id/media` on mount
- Handles both `data` (plain array) and `data.data` (wrapped) response shapes
- Stores the first item's `url` in state; returns `null` silently on error or empty array
- Renders a 60×60 rounded thumbnail (`borderRadius: 8`, `backgroundColor: '#2A3045'` as placeholder background)

Card layout change: existing card content wrapped in a `cardRow` (`flexDirection: 'row', gap: 12`), card content in a `flex: 1` `cardContent` view, `<ReviewPhoto>` as the right-side element. Cards with no media look identical to before (component returns null). No existing styles were modified — three new styles added: `cardRow`, `cardContent`, `cardThumb`.

### app/review/chat.tsx — context carried into session revival

`handleRetry`'s session-revival branch (`if (!sid)`) now sends the same rich `chat/start` body that `handleRegenerate` and `initChat` already used:
- `listing_context.context_note` (rating, emotion, tone, goal, aspects string)
- `previous_messages` (full conversation history mapped to `{ role: 'assistant'|'user', content }`)

Previously that branch sent a minimal body with no context, causing the AI to start each second+ rephrase from scratch.

Silent PATCH failure on rephrase/regenerate: the `PATCH /reviews/:id` call that persists the new review text after a successful AI response is now in its own inner try/catch that does not revert the UI on failure. The outer catch (which reverts and shows an alert) now only fires for genuine AI failures (`chat/message`, `chat/start`, `chat/approve`). Outer catch logs `err?.response?.status`, `err?.response?.data`, `err?.message` via `console.error` before reverting.

### npx tsc --noEmit → 0 errors after all three changes.

---

## Session update — 2026-06-29 (fixes)

- breakdown.tsx: pre-populates category ratings from GET /reviews/:id on mount
- photos.tsx: fetches existing media from GET /reviews/:id/media on mount,
  refreshMedia() called after each upload so server is source of truth
- reviews.tsx: Published tab label → Posted, displayStatus remaps
  published → posted for any stale records

---

## Session update — 2026-06-29

### Photo upload wired (implemented)
- app/review/photos.tsx: wired to POST /reviews/:id/media
  multipart/form-data field photo, optimistic thumbnails with upload spinner,
  concurrent uploads, DELETE on remove, Next/Skip logic
  expo-image-manipulator resize to 1200px width, compress 0.8 JPEG before upload

### Review history photos (implemented)
- app/(tabs)/reviews.tsx: ReviewPhoto component fetches GET /reviews/:id/media
  on mount, shows first photo as thumbnail on review card
  Silent fallback if no media

### Content filter in chat (implemented)
- app/review/chat.tsx: content filter called before approve
  POST /reviews/:id/chat/filter
  Blocks on approved:false
  Two-button alert on tone_aggressive warning
  Fails open on error
- Also: context_note + previous_messages added to chat/start
  Silent patch fail on rephrase/regenerate
  Better error logging

---

## Session update — 2026-06-29 (UI overhaul)

### Screen flow changes
- rate.tsx and type.tsx combined into one screen — stars at top, 
  3 review type cards animate in after selecting rating
- type.tsx deleted — unreachable dead code removed
- Screen order confirmed: networks → rate → voice/chat → photos → 
  breakdown → result → thankyou
- Continue draft from home: goes to chat with review_id + listing_id
- History edit flow: reviews tab → breakdown (source=reviews) → 
  result (source=reviews) → reviews tab

### Home screen (home.tsx)
- Location modal: React Native Modal popup, dark overlay, pink pin icon,
  "Allow your location", green button, "Maybe Later" text, 
  shows once via @provoc_loc_asked AsyncStorage key
- Inline placeholder card in Nearby when no location granted
- Nearby: horizontal scroll photo cards with name + distance badge
- CTA card: dark green, row layout, text left + green arrow button right
- AI disclaimer text moved outside card as small grey text
- Hamburger menu icon replaces notification bell
- Draft list API call fixed: /reviews?status=draft&limit=10
  (was using undocumented statuses= plural param)

### Profile screen (profile.tsx)
- Removed "Your Ratings" star breakdown section entirely
- Removed /reviews/stats API call
- Donut chart shows only 3 segments: Draft / Pending / Posted
- posted count merges posted + published so no data lost
- "Published" label gone entirely

### Reviews history (reviews.tsx)
- Review cards: show ★ rating number + date on one line
- Breakdown categories shown below: "Service ★4 · Food ★3" capped at 4
- Removed 5-star icon row from cards
- Published status remapped to Posted in display
- Tapping review card → breakdown screen (source=reviews)

### Breakdown screen (breakdown.tsx)
- When source=reviews: fetches GET /reviews/:id to get selected_networks
  and category_ratings, only shows platforms used for that review,
  pre-fills from DB only (0 if no ratings saved before)
- Save button: PATCHes /reviews/:id with category_ratings,
  on success navigates to result screen (source=reviews)
- Normal creation flow unchanged

### Result screen (result.tsx)
- Photos section: loads GET /reviews/:id/media on mount, read-only grid,
  fullscreen preview with left/right navigation
- When source=reviews: Submit shows "Done", PATCHes review text,
  navigates back to reviews history tab
- Normal creation flow (→ thankyou) unchanged

### Photos screen (photos.tsx)
- OR separator + "Open camera & take photos" green button
- Thumbnails tappable → fullscreen preview with left/right + Replace Photo
- On mount: fetches existing media from GET /reviews/:id/media
- After upload: refreshes from server (source of truth)

### Voice screen (voice.tsx)
- Bottom bar: dark pill "Ask anything..." with keypad-outline icon left
  and send icon right
- Green pill "Tap to speak" with pulse/radio icon

### Cleanup
- Removed 9 debug console.log statements from search.tsx, chat.tsx, result.tsx
- Kept intentional console.warn/console.error diagnostics in chat.tsx
