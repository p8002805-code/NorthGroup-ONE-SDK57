import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { isTrustedBomWebUrl } from '../../../services/security/trustedExternalUrl';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const BOM_RADAR_URL = 'https://www.bom.gov.au/weather-and-climate/rain-radar-and-weather-maps';
const BOM_RADAR_CLEANUP = `
  (function () {
    if (window.__northGroupRadarSetup) return true;
    window.__northGroupRadarSetup = true;
    var locationRequestKey = 'northGroupRadarLocationRequestedAt';
    var lastLocationRequest = Number(sessionStorage.getItem(locationRequestKey) || 0);
    var locationRequested = Date.now() - lastLocationRequest < 30000;
    var mapFound = false;
    var observer = null;

    function hide(element) {
      if (element) element.style.setProperty('display', 'none', 'important');
    }

    function normaliseText(element) {
      return ((element && (element.innerText || element.textContent)) || '')
        .replace(/\\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    function findControl(words) {
      return Array.from(document.querySelectorAll('button, a, [role="button"]')).find(function (element) {
        var text = normaliseText(element);
        return words.some(function (word) { return text === word || text.indexOf(word) !== -1; });
      });
    }

    function nearestSection(element) {
      if (!element) return null;
      return element.closest('section, article, main, [class*="map"], [class*="Map"]') || element.parentElement;
    }

    function tidyRadarPage() {
      document.documentElement.style.setProperty('scroll-behavior', 'auto');
      document.documentElement.style.setProperty('overflow-x', 'hidden');
      document.body.style.setProperty('overflow-x', 'hidden');

      var cookieText = Array.from(document.querySelectorAll('body *')).find(function (element) {
        var text = normaliseText(element);
        return text.indexOf('we use cookies on our site') !== -1 && element.children.length < 8;
      });
      if (cookieText) {
        var cookieBox = cookieText.closest('section, aside, div');
        var cookieButton = cookieBox && Array.from(cookieBox.querySelectorAll('button, [role="button"]')).find(function (button) {
          return normaliseText(button) === 'ok';
        });
        if (cookieButton) cookieButton.click();
        hide(cookieBox);
      }

      [
        'body > header',
        '[role="banner"]',
        'body > nav',
        '.breadcrumbs',
        '.breadcrumb',
        '[class*="feedback"]',
        '[id*="feedback"]',
        '[class*="cookie-banner"]',
        '[class*="cookieBanner"]',
        '[id*="cookie-banner"]',
        '[id*="cookieBanner"]'
      ].forEach(function (selector) {
        document.querySelectorAll(selector).forEach(hide);
      });

      if (!locationRequested) {
        var locationButton = findControl(['use location', 'use my location']);
        if (locationButton) {
          locationRequested = true;
          sessionStorage.setItem(locationRequestKey, String(Date.now()));
          locationButton.click();
        }
      }

      var mapElement = Array.from(document.querySelectorAll(
        'canvas, [class*="mapbox"], [class*="leaflet"], [class*="MapContainer"], [data-testid*="map"]'
      )).find(function (element) {
        var rect = element.getBoundingClientRect();
        return rect.width > 240 && rect.height > 180;
      });

      if (mapElement) {
        mapFound = true;
        if (observer) observer.disconnect();
        var mapSection = nearestSection(mapElement);
        mapSection.scrollIntoView({ block: 'start', inline: 'nearest' });
        window.scrollBy(0, -4);
        return;
      }

      if (!mapFound) {
        var radarHeading = Array.from(document.querySelectorAll('h1, h2, h3')).find(function (heading) {
          var text = normaliseText(heading);
          return text === 'weather map' || text.indexOf('live radar') !== -1;
        });
        if (radarHeading) {
          radarHeading.scrollIntoView({ block: 'start', inline: 'nearest' });
          window.scrollBy(0, -4);
        }
      }
    }

    tidyRadarPage();
    [250, 600, 1200, 2200, 4000, 7000].forEach(function (delay) {
      setTimeout(tidyRadarPage, delay);
    });
    observer = new MutationObserver(tidyRadarPage);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  })();
  true;
`;

export default function WeatherRadarScreen({ goBack }) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const initialLoadCompleteRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reload = () => {
    initialLoadCompleteRef.current = false;
    setFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ImageBackground
        source={require('../../../../assets/topo-bg.png')}
        resizeMode="cover"
        imageStyle={styles.headerImage}
        style={[styles.header, { paddingTop: insets.top + 4 }]}
      >
        <View style={styles.headerShade} />
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to Weather"
          >
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>Weather</Text>
          </Pressable>
          <View pointerEvents="none" style={styles.titleWrap}>
            <Text style={styles.title}>Rain Radar</Text>
            <Text style={styles.source}>BOM</Text>
          </View>
          <Pressable
            onPress={reload}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Refresh radar"
          >
            <Text style={styles.refreshText}>↻</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <View style={styles.map}>
        <WebView
          ref={webViewRef}
          source={{ uri: BOM_RADAR_URL }}
          onLoadStart={() => {
            if (!initialLoadCompleteRef.current) setLoading(true);
            setFailed(false);
          }}
          onLoadEnd={() => {
            initialLoadCompleteRef.current = true;
            setLoading(false);
          }}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          onHttpError={() => {
            setLoading(false);
            setFailed(true);
          }}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          originWhitelist={['https://*.bom.gov.au/*']}
          onShouldStartLoadWithRequest={({ url }) => isTrustedBomWebUrl(url)}
          allowsBackForwardNavigationGestures={false}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          mixedContentMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          allowsLinkPreview={false}
          injectedJavaScript={BOM_RADAR_CLEANUP}
          onLoad={() => webViewRef.current?.injectJavaScript(BOM_RADAR_CLEANUP)}
          style={styles.webView}
        />

        {loading && !failed ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={styles.loadingText}>Loading BOM radar…</Text>
          </View>
        ) : null}

        {failed ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorIcon}>◉</Text>
            <Text style={styles.errorTitle}>Radar could not load</Text>
            <Text style={styles.errorDetail}>
              Check the internet connection, then try again or open the radar directly in BOM.
            </Text>
            <Pressable onPress={reload} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(BOM_RADAR_URL)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>OPEN IN BOM</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Text style={styles.footerText}>Official Bureau of Meteorology radar • Internet required</Text>
        <Pressable onPress={() => Linking.openURL(BOM_RADAR_URL)}>
          <Text style={styles.footerLink}>Open in BOM</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: NAVY },
  header: { paddingHorizontal: 14, paddingBottom: 9, backgroundColor: NAVY, overflow: 'hidden' },
  headerImage: { opacity: 0.38 },
  headerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,26,45,0.56)' },
  headerRow: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 108, height: 40, flexDirection: 'row', alignItems: 'center' },
  backChevron: { color: GOLD, fontSize: 34, fontWeight: '300', lineHeight: 36, marginRight: 2, marginTop: -2 },
  backText: { color: GOLD, fontSize: 15, fontWeight: '800' },
  titleWrap: { position: 'absolute', left: 108, right: 108, top: 3, bottom: 3, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.2 },
  source: { color: 'rgba(255,255,255,0.64)', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 1 },
  refreshButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  refreshText: { color: '#FFFFFF', fontSize: 25, fontWeight: '600', lineHeight: 28 },
  map: { flex: 1, backgroundColor: '#E8EEF2' },
  webView: { flex: 1, backgroundColor: '#E8EEF2' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: NAVY_2 },
  loadingText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginTop: 12 },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, backgroundColor: NAVY_2 },
  errorIcon: { color: GOLD, fontSize: 34 },
  errorTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 12 },
  errorDetail: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, marginBottom: 22 },
  primaryButton: { minWidth: 190, borderRadius: 20, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, backgroundColor: GOLD },
  primaryButtonText: { color: NAVY, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  secondaryButton: { minWidth: 190, borderRadius: 20, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginTop: 10 },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  footer: { minHeight: 45, paddingTop: 9, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: NAVY },
  footerText: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 9, marginRight: 10 },
  footerLink: { color: GOLD, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
