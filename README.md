# ProVOC — Mobile App (`pv-app`)

React Native + Expo frontend for **ProVOC**, a voice-to-review assistant.  
Users record or type their experience with a business, an AI refines it into a polished review, and the app opens the relevant platform with the text pre-copied to the clipboard.

---

## Table of contents

1. [What the app does](#what-the-app-does)
2. [Tech stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Environment setup](#environment-setup)
5. [Running locally](#running-locally)
6. [Building for Android (EAS)](#building-for-android-eas)
7. [Project structure](#project-structure)
8. [API overview](#api-overview)
9. [Design system](#design-system)
10. [Known limitations](#known-limitations)

---

## What the app does

1. User searches for a business (Google Places) and selects it.
2. Selects which platforms to post on (Google, Yelp).
3. Rates the experience (1–5 stars).
4. Chooses a review type: **Regular**, **Smart** (AI-guided), or **Voice** (speech-to-text).
5. AI chat produces a polished review draft.
6. App copies the review text to clipboard and opens the platform's review page in a Chrome Custom Tab (Android) / SFSafariViewController (iOS).
7. User pastes and submits — all platforms use this clipboard flow (WebView-based auto-posting was abandoned due to platform restrictions).

---

## Tech stack

| Package | Purpose |
|---|---|
| React Native + Expo (SDK 54) | Framework |
| `expo-router` (file-based) | Navigation |
| NativeWind (Tailwind) | Styling |
| axios | HTTP client |
| `@react-native-async-storage/async-storage` | Token / user cache |
| `expo-av` | Audio recording |
| `expo-image-picker` | Photo selection |
| `expo-image-manipulator` | Resize before upload (max 1 200 px, 0.8 quality) |
| `react-native-inappbrowser-reborn` | Chrome Custom Tabs / SFSafariViewController for posting |
| `react-native-svg` | Donut chart on the Profile tab |
| `@expo/vector-icons` (Ionicons) | Icons throughout |

---

## Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`) — for production builds
- An Expo account (for EAS builds)
- Android device or emulator for testing (iOS requires a Mac)

---

## Environment setup

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=<your Google Places API (New) key>
```

> **Important:** this key must also be added as an EAS Secret before any cloud build:
> ```bash
> eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value <key>
> ```

The BFF base URL is hardcoded in `constants/api.ts`:

```typescript
export const API_BASE_URL = 'http://192.168.100.4:3001'  // update to your LAN IP or Railway URL
```

Change this to point at your running `pv-bff` instance (local LAN IP for Expo Go, Railway URL for EAS builds).

---

## Running locally

```bash
# Install dependencies
npm install

# Start Metro bundler
npx expo start

# Then press:
#   a  → open in Android emulator
#   s  → switch to Expo Go (scan QR with the Expo Go app)
```

> **Expo Go vs EAS build:** native modules (`react-native-inappbrowser-reborn`, `react-native-svg`) do not work in Expo Go. The Chrome Custom Tab posting flow and the profile donut chart require an EAS build or a local development build. In Expo Go, `InAppBrowser` resolves to `null` — the app falls back to `Linking.openURL` automatically.

After a code change, always do a full Metro restart with cache clear if behaviour seems stale:

```bash
npx expo start --clear
```

---

## Building for Android (EAS)

```bash
# Build a preview APK (free tier — queue can take 40–60 min)
eas build --platform android --profile preview

# Check build status
eas build:list
```

A rebuild is required when:

| Change type | Rebuild needed? |
|---|---|
| JS/TSX code changes | Yes |
| New npm package (especially native modules) | Yes |
| Backend-only change (pv-bff / pv-ai) | No |
| `EXPO_PUBLIC_*` env var change | Yes — baked in at build time |

---

## Project structure

```
app/
├── index.tsx               → redirect: auth or home based on token
├── auth.tsx                → login / register
├── search.tsx              → business search (Google Places + Zembra match)
├── (tabs)/
│   ├── _layout.tsx         → bottom tab bar
│   ├── home.tsx            → home screen + recommendations + draft list
│   ├── reviews.tsx         → review history (All / Posted / Draft tabs)
│   └── profile.tsx         → user profile + donut chart + preferences
└── review/
    ├── networks.tsx         → platform selection
    ├── rate.tsx             → star rating + review type (combined screen)
    ├── voice.tsx            → topic select + voice input
    ├── recording.tsx        → audio recording
    ├── chat.tsx             → AI chat conversation
    ├── enhance.tsx          → "Enhance with AI" modal
    ├── breakdown.tsx        → per-category ratings
    ├── result.tsx           → final review + posting
    └── photos.tsx           → photo upload

components/
├── BusinessCard.tsx
├── StarRating.tsx
├── PlatformToggle.tsx
├── ChipSelector.tsx
├── ChatBubble.tsx
├── ReviewCard.tsx
└── LoadingSpinner.tsx

utils/
└── withNetworkErrorRetry.ts  → shared retry helper (wraps single API call, retries once on network error)
```

---

## API overview

All API calls go through `pv-bff` only — never call `pv-ai` directly from the app.

Every request includes `Authorization: Bearer <token>` via an axios interceptor. The token is stored in AsyncStorage under `@provoc_token`.

Key endpoints used by the app:

| Action | Endpoint |
|---|---|
| Login / Register | `POST /auth/login`, `POST /auth/register` |
| Search businesses | `GET /listings/search?q=&lat=&lng=` |
| Save a listing | `POST /listings` |
| Create review draft | `POST /reviews` |
| Transcribe audio | `POST /reviews/:id/transcribe` (multipart, field: `audio`) |
| Start AI chat | `POST /reviews/:id/chat/start` |
| Send chat message | `POST /reviews/:id/chat/message` |
| Approve review | `POST /reviews/:id/chat/approve` |
| Get chat history | `GET /reviews/:id/chat/history` |
| Content filter | `POST /reviews/:id/chat/filter` |
| Get publish link | `GET /reviews/:id/publish-link?platform_id=<uuid>` |
| Update review | `PATCH /reviews/:id` |
| Upload photo | `POST /reviews/:id/media` (multipart, field: `photo`) |
| Get photos | `GET /reviews/:id/media` |
| Recommendations | `GET /recommendations` |
| User profile | `GET /auth/me`, `PATCH /users/me` |
| Preferences | `GET /users/me/preferences`, `PATCH /users/me/preferences` |
| Avatar | `PATCH /users/me/avatar` (base64 data URI) |

---

## Design system

| Token | Value |
|---|---|
| Background | `#0D0D0D` |
| Card background | `#1A1F2E` |
| Primary green | `#2D6A4F` |
| Green (hover/active) | `#40916C` |
| Text primary | `#FFFFFF` |
| Text secondary | `#8B9099` |
| Star colour | `#FFB800` |
| Error | `#EF4444` |
| Success | `#22C55E` |

Card `border-radius: 16px`. Button `border-radius: 12px`. Font: system default (SF Pro / Roboto).

---

## Known limitations

- **Posting** — all platforms (Google, Yelp) use clipboard + external browser. WebView auto-posting and Facebook/TripAdvisor/Trustpilot are permanently out of scope (confirmed via direct API testing — see `SESSION_SUMMARY.md`).
- **Photo upload** — wired to `POST /reviews/:id/media` and S3, but no backend presigned-upload endpoint exists yet; the current implementation streams through pv-bff. Large photos are resized to max 1 200 px before upload.
- **Recommendations** — only work when the Milvus/Zilliz backend is reachable. Returns `[]` gracefully otherwise.
- **Expo Go** — `InAppBrowser` resolves to `null`; the app falls back to `Linking.openURL`. The donut chart (`react-native-svg`) also won't render.
- **Avatar storage** — stored as a base64 string directly in Postgres. Fine for a demo with a handful of users; not production-scale.
- **Fine-tuned Whisper** — reverted to baseline (`USE_FINETUNED_WHISPER=false`) on Railway due to OOM on the current tier. Groq Whisper (`GROQ_WHISPER=true`) is the active path in production.
