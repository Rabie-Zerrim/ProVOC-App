import { useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import api from '../../services/api'

type Status = 'loading' | 'filling' | 'submitting' | 'done' | 'timeout'

const STATUS_LABELS: Record<Status, string> = {
  loading:    'Waiting for review form...',
  filling:    'Filling review...',
  submitting: 'Submitting...',
  done:       'Review posted!',
  timeout:    'Review copied — tap text field → paste → Post',
}

// Runs BEFORE page scripts — hooks network APIs so we catch ChIJ Place IDs
// from Maps' internal API responses even before the page JS executes.
const earlyInterceptJS = `
(function() {
  window.__pvocIds = [];
  function scan(text) {
    if (typeof text !== 'string' || text.length < 10) return;
    var m = text.match(/"(ChIJ[A-Za-z0-9_-]{10,})"/);
    if (m) window.__pvocIds.push(m[1]);
  }

  // Hook JSON.parse
  var _p = JSON.parse;
  JSON.parse = function(t) { var r = _p.apply(this, arguments); scan(t); return r; };

  // Hook XHR
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, u) {
    this._pvUrl = String(u || '');
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() { try { scan(this.responseText); } catch(e) {} });
    return _send.apply(this, arguments);
  };

  // Hook fetch
  var _f = window.fetch;
  if (_f) {
    window.fetch = function() {
      var p = _f.apply(this, arguments);
      return p.then(function(r) {
        r.clone().text().then(scan).catch(function() {});
        return r;
      });
    };
  }
})();
true;
`

export default function WebViewPostScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const webviewRef = useRef<WebView>(null)
  const params = useLocalSearchParams<{
    review_url:        string
    review_text:       string
    rating:            string
    food_rating:       string
    service_rating:    string
    atmosphere_rating: string
    business_name:     string
    review_id:         string
  }>()

  const [webviewSource, setWebviewSource] = useState(params.review_url ?? 'https://maps.google.com')
  const [status, setStatus] = useState<Status>('loading')
  const [handled, setHandled] = useState(false)
  const placeIdCaptured = useRef(false)

  console.log('WebView URL:', webviewSource)

  const safeText = JSON.stringify(params.review_text ?? '')

  const injectedJS = `
(function() {
  var reviewText       = ${safeText};
  var rating           = '${params.rating ?? '4'}';
  var foodRating       = '${params.food_rating ?? ''}';
  var serviceRating    = '${params.service_rating ?? ''}';
  var atmosphereRating = '${params.atmosphere_rating ?? ''}';
  var href = window.location.href;
  var isWriteReviewPage = href.indexOf('writereview') !== -1 || href.indexOf('/local/write') !== -1;
  var isMapsPage = !isWriteReviewPage && (href.indexOf('google.com/maps') !== -1 || href.indexOf('maps.google.com') !== -1);

  function qs(selector, root) {
    root = root || document;
    var el = root.querySelector(selector);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        var found = qs(selector, all[i].shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  function fillForm(textarea) {
    window.ReactNativeWebView.postMessage('filling');
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, reviewText);
    textarea.dispatchEvent(new Event('input',  { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    var overallStar = qs('div[aria-label="Rating stars"] div[role="radio"][data-rating="' + rating + '"]');
    if (overallStar) overallStar.click();
    if (foodRating) {
      var fs = qs('div[aria-label="Food rating stars"] div[role="radio"][data-rating="' + foodRating + '"]');
      if (fs) fs.click();
    }
    if (serviceRating) {
      var ss = qs('div[aria-label="Service rating stars"] div[role="radio"][data-rating="' + serviceRating + '"]');
      if (ss) ss.click();
    }
    if (atmosphereRating) {
      var as = qs('div[aria-label="Atmosphere rating stars"] div[role="radio"][data-rating="' + atmosphereRating + '"]');
      if (as) as.click();
    }

    setTimeout(function() {
      window.ReactNativeWebView.postMessage('submitting');
      var submitBtn = qs('button[jsname="b3VHJd"]');
      if (!submitBtn) {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].textContent.trim().indexOf('Post') !== -1) { submitBtn = btns[i]; break; }
        }
      }
      if (submitBtn) {
        submitBtn.click();
        setTimeout(function() { window.ReactNativeWebView.postMessage('submitted'); }, 2000);
      } else {
        window.ReactNativeWebView.postMessage('timeout:no-submit-btn');
      }
    }, 1500);
  }

  // ── UNIVERSAL FILL ──
  // Try auto-fill in every frame. Also set up a focusin listener so that if the user
  // taps the textarea (which lives in a closed shadow DOM we can't query-select into),
  // we catch the tap via the event's composedPath and fill from there.
  var filled = false;

  function fillIfReviewTextarea(el) {
    if (!el || filled) return;
    if (el.tagName !== 'TEXTAREA') return;
    filled = true;
    fillForm(el);
  }

  // composedPath()[0] reaches into closed shadow DOM elements when called from
  // within the event handler — this is the only way to get a reference to a
  // closed-shadow-root element.
  document.addEventListener('focusin', function(e) {
    if (filled) return;
    var deep = e.composedPath ? e.composedPath()[0] : e.target;
    fillIfReviewTextarea(deep);
  }, true);

  // Also poll for auto-fill in case the textarea is in an open shadow root
  var fillAttempts = 0;
  function tryFill() {
    fillAttempts++;
    if (fillAttempts > 30) {
      window.ReactNativeWebView.postMessage(
        'timeout:textareas=' + document.querySelectorAll('textarea').length +
        ',url=' + window.location.pathname.slice(0, 30)
      );
      return;
    }
    var textarea = qs('textarea[jsname="YPqjbf"]');
    if (textarea) { fillIfReviewTextarea(textarea); return; }
    setTimeout(tryFill, 500);
  }
  tryFill();

  if (isMapsPage) {
    // ── PLACE ID MODE ──
    // Maps uses closed shadow DOM — we can't reach the review modal directly.
    // earlyInterceptJS (runs before page scripts) already hooks JSON.parse / XHR / fetch
    // and stores any ChIJ Place IDs it finds in window.__pvocIds.
    // Here we:
    //   1. Poll __pvocIds for Place IDs captured during page load
    //   2. Click "Write a review" to trigger the Maps API call that includes the Place ID
    //   3. Navigate to writereview?placeid=ChIJ... once found
    var sent = false;

    function reportPlaceId(id) {
      if (sent) return;
      sent = true;
      window.ReactNativeWebView.postMessage(
        'write-review-url:https://search.google.com/local/writereview?placeid=' + encodeURIComponent(id)
      );
    }

    // Poll the array populated by the early interceptor
    function checkIds() {
      if (sent) return;
      if (window.__pvocIds && window.__pvocIds.length > 0) {
        reportPlaceId(window.__pvocIds[0]);
        return;
      }
      // Also scan existing script-tag bodies as a fallback
      var scripts = document.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
        var m = (scripts[i].textContent || '').match(/"(ChIJ[A-Za-z0-9_-]{10,})"/);
        if (m) { reportPlaceId(m[1]); return; }
      }
      setTimeout(checkIds, 500);
    }
    checkIds();

    // Click "Write a review" to trigger the Maps API call that returns the Place ID
    // (the API call response is scanned by earlyInterceptJS hooks above)
    var buttonClicked = false;
    var btnAttempts = 0;
    function tryClick() {
      if (sent) return;
      btnAttempts++;
      if (btnAttempts > 30) return;
      var btn = qs('button[aria-label="Write a review"]') || qs('button[data-value="Write a review"]');
      if (btn && !buttonClicked) { buttonClicked = true; btn.click(); return; }
      if (!buttonClicked) setTimeout(tryClick, 500);
    }
    setTimeout(tryClick, 1000);
  }
})();
true;
`

  const handleMessage = async (event: { nativeEvent: { data: string } }) => {
    const msg = event.nativeEvent.data

    if (msg === 'filling') {
      setStatus('filling')
    } else if (msg === 'submitting') {
      setStatus('submitting')
    } else if (msg === 'submitted') {
      if (handled) return
      setHandled(true)
      setStatus('done')
      if (params.review_id) {
        api.patch(`/reviews/${params.review_id}`, { status: 'published' }).catch(() => {})
      }
      setTimeout(() => router.replace('/(tabs)/home'), 2000)
    } else if (msg.startsWith('write-review-url:')) {
      const url = msg.replace('write-review-url:', '')
      console.log('Write-review URL extracted:', url)
      if (!placeIdCaptured.current) {
        placeIdCaptured.current = true
        setWebviewSource(url)
      }
    } else if (msg.startsWith('timeout')) {
      console.log('WebView timeout diagnostic:', msg)
      if (!handled) setStatus('timeout')
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Posting to Google...</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Paste guide banner — shown when auto-fill times out (closed shadow DOM) */}
      {status === 'timeout' && (
        <View style={styles.pasteBanner}>
          <Ionicons name="clipboard-outline" size={16} color="#FFB800" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pasteBannerText}>
              Tap the text field → long-press → Paste → tap Post
            </Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={async () => {
                await Clipboard.setStringAsync(params.review_text ?? '')
                Alert.alert('Copied!', 'Review text copied to clipboard.')
              }}
            >
              <Ionicons name="copy-outline" size={13} color="#FFB800" />
              <Text style={styles.copyBtnText}>Copy review text again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: webviewSource }}
        injectedJavaScriptBeforeContentLoaded={earlyInterceptJS}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
        injectedJavaScript={injectedJS}
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#2D6A4F" size="large" />
            <Text style={styles.loadingText}>Loading Google review form...</Text>
          </View>
        )}
        onShouldStartLoadWithRequest={(req) => {
          if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
            console.log('Blocked non-http URL:', req.url.slice(0, 80))
            return false
          }
          return true
        }}
        onLoadStart={() => console.log('WebView loading started')}
        onLoadEnd={() => console.log('WebView loading ended')}
        onError={(e) => console.log('WebView error:', e.nativeEvent)}
        onHttpError={(e) => console.log('WebView HTTP error:', e.nativeEvent)}
      />

      {/* Status bar */}
      <View style={[styles.statusBar, { paddingBottom: insets.bottom + 8 }]}>
        {status === 'done' ? (
          <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
        ) : status === 'timeout' ? (
          <Ionicons name="alert-circle-outline" size={18} color="#FFB800" />
        ) : (
          <ActivityIndicator size="small" color="#2D6A4F" />
        )}
        <Text
          style={[
            styles.statusText,
            status === 'done'    && styles.statusDone,
            status === 'timeout' && styles.statusTimeout,
          ]}
        >
          {STATUS_LABELS[status]}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1A1F2E',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#252B3B', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  webview: { flex: 1 },

  pasteBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#2A2000', borderBottomWidth: 1, borderBottomColor: '#FFB80044',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  pasteBannerText: { color: '#FFB800', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#3A2E00', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FFB80055',
  },
  copyBtnText: { color: '#FFB800', fontSize: 12, fontWeight: '700' },

  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  loadingText: { color: '#8B9099', fontSize: 14 },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1F2E', paddingHorizontal: 20, paddingTop: 12,
  },
  statusText:    { color: '#8B9099', fontSize: 13, fontWeight: '500' },
  statusDone:    { color: '#22C55E', fontWeight: '700' },
  statusTimeout: { color: '#FFB800' },
})
