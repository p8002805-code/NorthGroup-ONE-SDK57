import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../theme/ThemeContext';
import { SPACING } from '../../../theme/spacing';

export default function PendingUploadDestination({ assets = [], label = '', upload }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const batch = assets.length > 1;

  return (
    <View style={styles.banner}>
      <View style={styles.icon}>
        <Ionicons name="document-text-outline" size={22} color={colors.accentDark} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>CHOOSE A SHAREPOINT DESTINATION</Text>
        <Text numberOfLines={1} style={styles.title}>{label || 'Form PDF'}</Text>
        <Text numberOfLines={2} style={styles.file}>
          {batch
            ? `${upload?.folderName || 'GNSS batch'} · ${assets.length} session PDFs`
            : assets[0]?.name || 'Generated PDF'}
        </Text>
        <Text style={styles.body}>Open a folder below, then upload this saved GNSS batch into that SharePoint location.</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: colors.warningBackground, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  copy: { flex: 1, minWidth: 0, marginLeft: 11 },
  eyebrow: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 1.05 },
  title: { color: colors.bodyText, fontSize: 14, fontWeight: '900', marginTop: 3 },
  file: { color: colors.supportingText, fontSize: 10, marginTop: 2 },
  body: { color: colors.supportingText, fontSize: 10, lineHeight: 15, marginTop: 4 },
});
