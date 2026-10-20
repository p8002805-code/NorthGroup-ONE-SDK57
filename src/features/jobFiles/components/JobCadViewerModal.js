import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

const CAD_VIEWER_ORIGIN = 'https://northgroup-cad.local/';

export default function JobCadViewerModal({ preview, onClose, onOpenSharePoint, onShare }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDxf = preview?.kind === 'dxf';
  const canRender = isDxf && preview?.html && !preview?.error;

  return (
    <Modal visible={Boolean(preview)} animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>{preview?.item?.name || 'CAD viewer'}</Text>
            <Text style={styles.subtitle}>{isDxf ? '2D DXF PREVIEW' : 'DWG FILE'}</Text>
          </View>
          <Pressable onPress={() => preview?.item && onShare(preview.item)} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons name="share-outline" size={21} color={colors.white} />
          </Pressable>
        </View>

        {canRender ? (
          <WebView
            source={{ html: preview.html, baseUrl: CAD_VIEWER_ORIGIN }}
            originWhitelist={[CAD_VIEWER_ORIGIN]}
            javaScriptEnabled
            domStorageEnabled={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            javaScriptCanOpenWindowsAutomatically={false}
            mixedContentMode="never"
            setSupportMultipleWindows={false}
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            allowsLinkPreview={false}
            onShouldStartLoadWithRequest={({ url }) => url === CAD_VIEWER_ORIGIN}
            style={styles.viewer}
          />
        ) : (
          <View style={styles.fallback}>
            <View style={styles.cadIcon}>
              <Ionicons name="construct-outline" size={38} color={colors.accentDark} />
            </View>
            <Text style={styles.fallbackTitle}>{isDxf ? 'DXF preview unavailable' : 'DWG needs a compatible viewer'}</Text>
            <Text style={styles.fallbackBody}>
              {preview?.error || (isDxf
                ? 'This drawing uses entities that are not supported by the mobile viewer.'
                : 'Expo Go cannot safely render proprietary DWG data. Open it in SharePoint or send it to a CAD app installed on this device.')}
            </Text>
            <Pressable onPress={() => preview?.item && onOpenSharePoint(preview.item)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Ionicons name="open-outline" size={18} color={colors.navy} />
              <Text style={styles.primaryText}>Open in SharePoint</Text>
            </Pressable>
            <Pressable onPress={() => preview?.item && onShare(preview.item)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Ionicons name="share-outline" size={18} color={colors.accentDark} />
              <Text style={styles.secondaryText}>Open in another app</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: '#09131d' },
  header: { minHeight: 70, paddingHorizontal: 9, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  title: { color: colors.white, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 3 },
  viewer: { flex: 1, backgroundColor: '#09131d' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: colors.pageBackground },
  cadIcon: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.warningBackground },
  fallbackTitle: { color: colors.bodyText, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: SPACING.lg },
  fallbackBody: { maxWidth: 420, color: colors.supportingText, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: SPACING.xl },
  primaryButton: { minWidth: 230, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.md, backgroundColor: colors.accent },
  primaryText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  secondaryButton: { minWidth: 230, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  secondaryText: { color: colors.accentDark, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.65 },
});
