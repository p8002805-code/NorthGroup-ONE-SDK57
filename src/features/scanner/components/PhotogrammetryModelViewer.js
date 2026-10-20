import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BLACK = '#07090C';
const PANEL = '#15191F';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const MUTED = '#AEB7C2';
const VIEWER_ORIGIN = 'https://northgroup.local/';

const serialiseForInlineScript = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const formatDistance = (value) => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 10) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
};

const createModelHtml = (modelDataUri, title) => `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline'; connect-src data: blob:; img-src data: blob:; worker-src blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #282B2F; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      #canvas { display: block; width: 100%; height: 100%; touch-action: none; }
      #loading { position: absolute; inset: 0; display: grid; place-items: center; color: #FFFFFF; font-size: 14px; font-weight: 700; background: #282B2F; }
      #hint { position: absolute; left: 14px; right: 14px; top: 14px; text-align: center; color: #D5DADF; font-size: 11px; font-weight: 700; pointer-events: none; }
      #measure { position: absolute; left: 14px; right: 14px; bottom: 16px; display: none; padding: 11px 14px; border-radius: 12px; background: rgba(7,9,12,0.86); color: #FFFFFF; text-align: center; font-size: 12px; font-weight: 800; }
      #error { position: absolute; left: 18px; right: 18px; top: 40%; color: #FFFFFF; text-align: center; font-size: 13px; line-height: 20px; }
    </style>
    <script type="importmap">
      {"imports":{"three":"https://unpkg.com/three@0.180.0/build/three.module.js"}}
    </script>
  </head>
  <body>
    <div id="loading">Loading 3D model…</div>
    <div id="hint">Drag to orbit · pinch to zoom · two fingers to pan</div>
    <div id="measure"></div>
    <canvas id="canvas"></canvas>
    <script type="module">
      import * as THREE from 'three';
      import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
      import { GLTFLoader } from 'https://unpkg.com/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

      const source = ${serialiseForInlineScript(modelDataUri)};
      const title = ${serialiseForInlineScript(title || 'Feature model')};
      const canvas = document.getElementById('canvas');
      const loading = document.getElementById('loading');
      const error = document.getElementById('error');
      const measure = document.getElementById('measure');
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#282B2F');
      const camera = new THREE.PerspectiveCamera(42, 1, 0.001, 100000);
      camera.position.set(0, 0, 3);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 0.01;
      controls.maxDistance = 100000;
      controls.enablePan = true;
      const ambient = new THREE.HemisphereLight(0xFFFFFF, 0x38424B, 2.4);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xFFFFFF, 2.8);
      key.position.set(4, 7, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xC7DFFF, 1.2);
      fill.position.set(-5, 2, -4);
      scene.add(fill);
      const grid = new THREE.GridHelper(10, 20, 0x606872, 0x424850);
      grid.material.opacity = 0.22;
      grid.material.transparent = true;
      scene.add(grid);
      const loader = new GLTFLoader();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let model = null;
      let measureMode = false;
      let measurePoints = [];
      let measureObjects = [];

      const resize = () => {
        const width = Math.max(1, window.innerWidth);
        const height = Math.max(1, window.innerHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      window.addEventListener('resize', resize);
      resize();

      const send = (payload) => {
        window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
      };

      const clearMeasure = () => {
        measureObjects.forEach((object) => scene.remove(object));
        measureObjects = [];
        measurePoints = [];
        measure.style.display = 'none';
      };

      const addMeasurePoint = (point) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.004, (model?.userData?.radius || 1) * 0.012), 16, 12),
          new THREE.MeshBasicMaterial({ color: 0xD6A84F }),
        );
        marker.position.copy(point);
        scene.add(marker);
        measureObjects.push(marker);
      };

      const handleMeasure = (event) => {
        if (!measureMode || !model) return;
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObject(model, true);
        if (!hits.length) return;
        const point = hits[0].point.clone();
        measurePoints.push(point);
        addMeasurePoint(point);
        if (measurePoints.length < 2) {
          measure.textContent = 'Select the second point on the model';
          measure.style.display = 'block';
          return;
        }
        const distance = measurePoints[0].distanceTo(measurePoints[1]);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(measurePoints),
          new THREE.LineBasicMaterial({ color: 0xD6A84F, linewidth: 3 }),
        );
        scene.add(line);
        measureObjects.push(line);
        measure.textContent = 'Distance: ' + distance.toFixed(4) + ' model units · tap Measure for another';
        measure.style.display = 'block';
        send({ type: 'measurement', distance, title });
        measureMode = false;
        controls.enabled = true;
      };
      canvas.addEventListener('pointerup', handleMeasure);

      const frame = () => {
        requestAnimationFrame(frame);
        controls.update();
        renderer.render(scene, camera);
      };
      frame();

      window.startMeasure = () => {
        measureMode = true;
        clearMeasure();
        measure.textContent = 'Select the first point on the model';
        measure.style.display = 'block';
        controls.enabled = false;
        send({ type: 'measureStarted' });
      };
      window.resetModel = () => {
        if (!model) return;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        const centre = box.getCenter(new THREE.Vector3());
        controls.target.copy(centre);
        camera.position.copy(centre).add(new THREE.Vector3(0, size * 0.25, size * 1.6));
        camera.near = Math.max(size / 10000, 0.0001);
        camera.far = Math.max(size * 100, 1000);
        camera.updateProjectionMatrix();
        controls.update();
        grid.scale.setScalar(Math.max(size / 10, 0.1));
      };
      window.stopMeasure = () => {
        measureMode = false;
        controls.enabled = true;
        clearMeasure();
      };

      loader.load(source, (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        model.userData.radius = size;
        const centre = box.getCenter(new THREE.Vector3());
        model.position.sub(centre);
        scene.add(model);
        window.resetModel();
        loading.style.display = 'none';
        send({ type: 'loaded', title });
      }, undefined, (loadError) => {
        loading.style.display = 'none';
        const message = loadError?.message || 'The model could not be loaded.';
        const errorElement = document.createElement('div');
        errorElement.id = 'error';
        errorElement.textContent = message;
        document.body.appendChild(errorElement);
        send({ type: 'error', message });
      });
    </script>
  </body>
</html>`;

export default function PhotogrammetryModelViewer({
  visible,
  scan,
  onClose,
  onShare,
  onSaveMeasurement,
}) {
  const insets = useSafeAreaInsets();
  const [modelDataUri, setModelDataUri] = useState('');
  const [loading, setLoading] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!visible || !scan?.modelUri) {
      setModelDataUri('');
      return undefined;
    }

    setLoading(true);
    FileSystem.readAsStringAsync(scan.modelUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
      .then((base64) => {
        if (active) setModelDataUri(`data:model/gltf-binary;base64,${base64}`);
      })
      .catch(() => {
        if (active) {
          Alert.alert('Model unavailable', 'NorthGroup One could not read the downloaded model.');
          onClose?.();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onClose, scan?.modelUri, visible]);

  const html = useMemo(() => (
    modelDataUri ? createModelHtml(modelDataUri, scan?.featureId || 'Feature model') : ''
  ), [modelDataUri, scan?.featureId]);

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data || '{}');
      if (message.type !== 'measurement') return;
      const distance = Number(message.distance);
      if (!Number.isFinite(distance)) return;
      Alert.alert(
        '3D measurement',
        `${formatDistance(distance)} model units. Set a known reference scale before treating this as a real-world distance.`,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Save',
            onPress: () => onSaveMeasurement?.({
              id: `${scan?.id || 'scan'}-model-measurement-${Date.now()}`,
              frameIndex: 0,
              frameName: '3D model',
              distancePx: distance,
              value: Number(distance.toFixed(4)),
              unit: 'model units',
              calibrated: false,
              createdAt: new Date().toISOString(),
            }),
          },
        ],
      );
    } catch {
      // Ignore malformed messages from the embedded viewer.
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.page}>
        <StatusBar barStyle="light-content" backgroundColor={BLACK} />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={28} color={WHITE} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PHOTOGRAMMETRY MODEL</Text>
            <Text style={styles.title} numberOfLines={1}>{scan?.featureId || 'Feature model'}</Text>
          </View>
          <Pressable onPress={onShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={20} color={WHITE} />
          </Pressable>
        </View>

        <View style={styles.viewer}>
          {loading || !html ? (
            <View style={styles.loadingView}>
              <ActivityIndicator size="large" color={GOLD} />
              <Text style={styles.loadingText}>Preparing 3D model…</Text>
            </View>
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={[VIEWER_ORIGIN]}
              source={{ html, baseUrl: VIEWER_ORIGIN }}
              javaScriptEnabled
              domStorageEnabled={false}
              allowFileAccess={false}
              allowFileAccessFromFileURLs={false}
              allowUniversalAccessFromFileURLs={false}
              javaScriptCanOpenWindowsAutomatically={false}
              setSupportMultipleWindows={false}
              mixedContentMode="never"
              sharedCookiesEnabled={false}
              thirdPartyCookiesEnabled={false}
              allowsLinkPreview={false}
              onShouldStartLoadWithRequest={({ url }) => url === VIEWER_ORIGIN}
              onMessage={handleMessage}
              onError={() => Alert.alert('Viewer unavailable', 'The 3D model viewer could not be loaded.')}
              style={styles.webView}
            />
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.footerText}>
            Drag to orbit · pinch to zoom · two fingers to pan. Measurements are model units until a known reference is applied.
          </Text>
          <View style={styles.footerActions}>
            <Pressable
              onPress={() => webViewRef.current?.injectJavaScript('window.resetModel?.(); true;')}
              style={styles.footerAction}
            >
              <Ionicons name="refresh-outline" size={17} color={WHITE} />
              <Text style={styles.footerActionText}>RESET</Text>
            </Pressable>
            <Pressable
              onPress={() => webViewRef.current?.injectJavaScript('window.startMeasure?.(); true;')}
              style={[styles.footerAction, styles.measureAction]}
            >
              <Ionicons name="resize-outline" size={17} color="#111111" />
              <Text style={styles.measureActionText}>MEASURE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BLACK },
  header: {
    minHeight: 94,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 23, 28, 0.98)',
  },
  headerButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: PANEL,
  },
  headerCopy: { flex: 1, paddingHorizontal: 12 },
  eyebrow: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: WHITE, fontSize: 19, fontWeight: '900', marginTop: 3 },
  shareButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: PANEL,
  },
  viewer: { flex: 1, backgroundColor: '#282B2F' },
  webView: { flex: 1, backgroundColor: '#282B2F' },
  loadingView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: MUTED, fontSize: 13, fontWeight: '700', marginTop: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: BLACK },
  footerText: { color: MUTED, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  footerAction: {
    minWidth: 104,
    minHeight: 38,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 20,
    backgroundColor: PANEL,
  },
  footerActionText: { color: WHITE, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  measureAction: { backgroundColor: GOLD },
  measureActionText: { color: '#111111', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
});
