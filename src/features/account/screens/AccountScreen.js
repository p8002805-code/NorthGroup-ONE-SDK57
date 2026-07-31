import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppHeader from '../../../components/AppHeader';
import ProfileAvatar from '../../../components/ProfileAvatar';
import { normaliseProfile } from '../accountProfile';
import { useTheme } from '../../../theme/ThemeContext';
import {
  MODE_OPTIONS,
  THEME_OPTIONS,
  getThemePreview,
  resolveColourMode,
} from '../../../theme/themePresets';

const OFFICES = ['Brisbane', 'Sunshine Coast', 'Gladstone'];

const SIGNATURE_STYLES = [
  {
    id: 'original',
    label: 'Original',
    description: 'Clean and professional',
    textStyle: { fontStyle: 'italic', fontWeight: '600' },
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Traditional handwritten look',
    textStyle: { fontFamily: 'Georgia', fontSize: 24, fontStyle: 'italic' },
  },
  {
    id: 'handwritten',
    label: 'Handwritten',
    description: 'Relaxed handwritten look',
    textStyle: { fontFamily: 'Noteworthy', fontSize: 24 },
  },
  {
    id: 'signature',
    label: 'Script',
    description: 'Formal script look',
    textStyle: { fontFamily: 'Snell Roundhand', fontSize: 30 },
  },
];

const getSignatureStyle = (id) => (
  SIGNATURE_STYLES.find((style) => style.id === id) || SIGNATURE_STYLES[0]
);

const lowercaseFirstCharacter = (value) => (
  String(value || '').replace(/^./, (character) => character.toLowerCase())
);

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  autoCapitalize,
  autoCorrect,
  styles,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholderText.color}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />
    </View>
  );
}

function SectionHeader({ title, complete, styles }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.section}>{title}</Text>
      <View style={[styles.status, complete ? styles.statusComplete : styles.statusIncomplete]}>
        <Text style={[styles.statusText, complete ? styles.statusTextComplete : styles.statusTextIncomplete]}>
          {complete ? 'COMPLETE' : 'INCOMPLETE'}
        </Text>
      </View>
    </View>
  );
}

export default function AccountScreen({
  profile,
  onSave,
  goBack,
  microsoftAccount,
  onMicrosoftSignOut,
  profilePhotoUri,
  profilePhotoRevision,
  profilePhotoLoading = false,
  onRefreshProfilePhoto,
}) {
  const { colors, systemScheme } = useTheme();
  const [draft, setDraft] = useState(() => normaliseProfile(profile));
  const [showOfficeOptions, setShowOfficeOptions] = useState(false);
  const [showSignatureOptions, setShowSignatureOptions] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const initials = `${draft.firstName?.[0] || ''}${draft.lastName?.[0] || ''}`.toUpperCase() || 'NG';
  const personalComplete = Boolean(draft.firstName?.trim() && draft.lastName?.trim());
  const signatureName = `${String(draft.firstName || '').trim()} ${String(draft.lastName || '').trim()}`.trim() || 'Your Name';
  const selectedSignature = getSignatureStyle(draft.signatureStyle);
  const selectedColourMode = resolveColourMode(draft.appearanceMode, systemScheme);

  useEffect(() => {
    setDraft(normaliseProfile(profile));
  }, [profile]);

  const save = async () => {
    if (!personalComplete) {
      Alert.alert('Name required', 'Enter the employee first and last name.');
      return;
    }

    const clean = normaliseProfile({
      ...draft,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: lowercaseFirstCharacter(draft.email).trim(),
      vehicle: draft.vehicle?.trim() || '',
      vehicleRego: draft.vehicleRego?.trim().toUpperCase() || '',
      defaultJob: draft.defaultJob?.trim() || '',
      defaultJobName: draft.defaultJobName?.trim() || '',
      signature: signatureName,
      signatureStyle: selectedSignature.id,
    });

    await onSave(clean);
    setDraft(clean);
    Keyboard.dismiss();
    Alert.alert('Profile saved', 'Your details will now pre-fill supported forms.');
  };

  const refreshPhoto = async () => {
    try {
      await onRefreshProfilePhoto?.();
    } catch (photoError) {
      Alert.alert(
        'Profile photo unavailable',
        photoError?.message || 'Your Microsoft profile photo could not be refreshed.',
      );
    }
  };

  const manageMicrosoftProfile = () => {
    Linking.openURL('https://www.microsoft365.com/profile/').catch(() => {
      Alert.alert(
        'Unable to open Microsoft',
        'Open Microsoft 365 in your browser to manage your profile photo.',
      );
    });
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="ACCOUNT"
        title="Profile Settings"
        subtitle="Personal details, work defaults and signature"
        onBack={goBack}
        backLabel="Dashboard"
        showTopo
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.microsoftHeading}>
            <View style={styles.microsoftBadge}>
              <View style={[styles.microsoftTile, { backgroundColor: "#F25022" }]} />
              <View style={[styles.microsoftTile, { backgroundColor: "#7FBA00" }]} />
              <View style={[styles.microsoftTile, { backgroundColor: "#00A4EF" }]} />
              <View style={[styles.microsoftTile, { backgroundColor: "#FFB900" }]} />
            </View>
            <View style={styles.microsoftCopy}>
              <Text style={styles.section}>MICROSOFT WORK ACCOUNT</Text>
              <Text style={styles.microsoftStatus}>CONNECTED</Text>
            </View>
          </View>
          <View style={styles.profilePhotoRow}>
            <ProfileAvatar
              uri={profilePhotoUri}
              revision={profilePhotoRevision}
              initials={initials}
              size={72}
              backgroundColor={colors.accent}
              textColor={colors.navy}
              borderColor={colors.border}
              borderWidth={2}
            />
            <View style={styles.profilePhotoCopy}>
              <Text style={styles.profilePhotoTitle}>Profile photo</Text>
              <Text style={styles.profilePhotoDetail}>
                Synced with your Microsoft account
              </Text>
              <View style={styles.profilePhotoActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.profilePhotoAction,
                    pressed && styles.pressed,
                  ]}
                  onPress={refreshPhoto}
                  disabled={profilePhotoLoading}
                >
                  {profilePhotoLoading ? (
                    <ActivityIndicator size="small" color={colors.accentDark} />
                  ) : (
                    <Text style={styles.profilePhotoActionText}>Refresh photo</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.profilePhotoAction,
                    pressed && styles.pressed,
                  ]}
                  onPress={manageMicrosoftProfile}
                >
                  <Text style={styles.profilePhotoActionText}>Manage in Microsoft</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <Text style={styles.microsoftName}>
            {microsoftAccount?.displayName ||
              `${draft.firstName} ${draft.lastName}`.trim()}
          </Text>
          <Text style={styles.microsoftEmail}>
            {microsoftAccount?.email || draft.email}
          </Text>
          <Text style={styles.hint}>
            This verified NorthGroup identity is used for Microsoft 365 access.
            Profile details below can still be completed for field forms.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of Microsoft"
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
            onPress={() => {
              Alert.alert(
                "Sign out of Microsoft?",
                "You will need your NorthGroup work account to enter the app again.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: onMicrosoftSignOut,
                  },
                ],
              );
            }}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <SectionHeader title="PERSONAL INFORMATION" complete={personalComplete} styles={styles} />
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="First Name" value={draft.firstName} onChangeText={(value) => set('firstName', value)} styles={styles} />
            </View>
            <View style={styles.half}>
              <Field label="Last Name" value={draft.lastName} onChangeText={(value) => set('lastName', value)} styles={styles} />
            </View>
          </View>
          <Field
            label="Initials"
            value={draft.initials || initials}
            onChangeText={(value) => set('initials', value.toUpperCase().slice(0, 4))}
            placeholder="e.g. PC"
            autoCapitalize="characters"
            autoCorrect={false}
            styles={styles}
          />
          <Field label="Role" value={draft.role} onChangeText={(value) => set('role', value)} placeholder="Surveyor" styles={styles} />

          <View style={styles.field}>
            <Text style={styles.label}>Office</Text>
            <Pressable
              style={({ pressed }) => [styles.select, pressed && styles.pressed]}
              onPress={() => setShowOfficeOptions((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel="Select office"
            >
              <Text style={[styles.selectValue, !draft.office && styles.selectPlaceholder]}>
                {draft.office || 'Select office'}
              </Text>
              <Text style={styles.selectArrow}>{showOfficeOptions ? '▲' : '▼'}</Text>
            </Pressable>
            {showOfficeOptions ? (
              <View style={styles.officeOptions}>
                {OFFICES.map((office) => (
                  <Pressable
                    key={office}
                    style={[styles.officeOption, draft.office === office && styles.officeOptionSelected]}
                    onPress={() => {
                      set('office', office);
                      setShowOfficeOptions(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draft.office === office }}
                  >
                    <Text style={[styles.officeOptionText, draft.office === office && styles.officeOptionTextSelected]}>
                      {office}
                    </Text>
                    {draft.office === office ? <Text style={styles.officeTick}>✓</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <Field
            label="Email"
            value={draft.email}
            onChangeText={(value) => set('email', lowercaseFirstCharacter(value))}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            styles={styles}
          />
          <Field label="Phone" value={draft.phone} onChangeText={(value) => set('phone', value)} keyboardType="phone-pad" styles={styles} />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>WORK DEFAULTS</Text>
          <Field label="Vehicle Make" value={draft.vehicle} onChangeText={(value) => set('vehicle', value)} placeholder="e.g. Toyota Hilux" styles={styles} />
          <Field label="Vehicle Rego" value={draft.vehicleRego} onChangeText={(value) => set('vehicleRego', value.toUpperCase())} placeholder="e.g. 123 ABC" autoCapitalize="characters" styles={styles} />
          <Text style={styles.hint}>These details are used to pre-fill supported field forms.</Text>
        </View>

        <View style={styles.card}>
          <SectionHeader title="SIGNATURE" complete={personalComplete} styles={styles} />
          <Text style={styles.signatureHint}>Your first and last name will be used automatically. Choose the style shown on completed forms.</Text>

          <Pressable
            style={({ pressed }) => [styles.signatureSelect, pressed && styles.pressed]}
            onPress={() => setShowSignatureOptions((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Choose signature style"
            accessibilityState={{ expanded: showSignatureOptions }}
          >
            <View style={styles.signatureSelectContent}>
              <Text style={styles.selectorLabel}>CHOOSE YOUR STYLE</Text>
              <Text style={[styles.selectorValue, selectedSignature.textStyle]} numberOfLines={1}>
                {selectedSignature.label}
              </Text>
            </View>
            <Text style={styles.chevron}>{showSignatureOptions ? '⌃' : '⌄'}</Text>
          </Pressable>

          {showSignatureOptions ? (
            <View style={styles.signatureOptions}>
              {SIGNATURE_STYLES.map((style, index) => {
                const isSelected = style.id === selectedSignature.id;
                return (
                  <Pressable
                    key={style.id}
                    style={({ pressed }) => [
                      styles.signatureOption,
                      isSelected && styles.signatureOptionSelected,
                      index === SIGNATURE_STYLES.length - 1 && styles.signatureOptionLast,
                      pressed && styles.signatureOptionPressed,
                    ]}
                    onPress={() => {
                      set('signatureStyle', style.id);
                      setShowSignatureOptions(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Choose ${style.label} signature style`}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionLabel}>{style.label}</Text>
                      <Text style={[styles.optionPreview, style.textStyle]} numberOfLines={1}>
                        {signatureName}
                      </Text>
                      <Text style={styles.optionDescription}>{style.description}</Text>
                    </View>
                    {isSelected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.signaturePreviewCard}>
            <View style={styles.previewHeading}>
              <Text style={styles.previewLabel}>PREVIEW</Text>
              <Text style={styles.previewStyle}>{selectedSignature.label}</Text>
            </View>
            <Text style={[styles.previewName, selectedSignature.textStyle]} numberOfLines={1}>
              {signatureName}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader title="APPEARANCE" complete={Boolean(draft.themeId)} styles={styles} />
          <Text style={styles.signatureHint}>
            Choose the colour style that feels best for your workday. Your selection is applied after you save Profile Settings.
          </Text>

          <Text style={styles.selectorLabel}>LIGHT OR DARK MODE</Text>
          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((option) => {
              const isSelected = draft.appearanceMode === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.modeOption,
                    isSelected && styles.modeOptionSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => set('appearanceMode', option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.modeIcon, isSelected && styles.modeIconSelected]}>{option.icon}</Text>
                  <Text style={[styles.modeText, isSelected && styles.modeTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.selectorLabel}>CHOOSE A COLOUR STYLE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themeOptions}
          >
            {THEME_OPTIONS.map((option) => {
              const isSelected = draft.themeId === option.id;
              const preview = getThemePreview(option.id, selectedColourMode);
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.themeOption,
                    isSelected && styles.themeOptionSelected,
                    pressed && styles.themeOptionPressed,
                  ]}
                  onPress={() => set('themeId', option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Choose ${option.label} colour style`}
                >
                  <View style={[styles.themePreview, { backgroundColor: preview.background }]}>
                    <View style={[styles.themePreviewHeader, { backgroundColor: preview.header }]}>
                      <View style={[styles.themePreviewAccent, { backgroundColor: preview.accent }]} />
                    </View>
                    <View style={styles.themePreviewBody}>
                      <View style={[styles.themePreviewLine, { backgroundColor: preview.text }]} />
                      <View style={[styles.themePreviewLineShort, { backgroundColor: preview.supportingText }]} />
                      <View style={[styles.themePreviewButton, { backgroundColor: preview.accent }]} />
                    </View>
                  </View>
                  <View style={styles.themeOptionCopy}>
                    <Text style={styles.themeOptionLabel} numberOfLines={1}>{option.shortLabel}</Text>
                    <Text style={styles.themeOptionMood} numberOfLines={1}>{option.mood}</Text>
                  </View>
                  {isSelected ? <Text style={styles.themeCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.appearanceSummary, { borderLeftColor: colors.accent }]}>
            <Text style={styles.appearanceSummaryLabel}>CURRENT SELECTION</Text>
            <Text style={styles.appearanceSummaryTitle}>
              {THEME_OPTIONS.find((option) => option.id === draft.themeId)?.label || 'NorthGroup Standard'}
            </Text>
            <Text style={styles.appearanceSummaryText}>
              {draft.appearanceMode === 'system'
                ? 'Follows your iPhone appearance setting'
                : `${draft.appearanceMode === 'dark' ? 'Dark' : 'Light'} mode`}
            </Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.save, pressed && styles.savePressed]} onPress={save}>
          <Text style={styles.saveText}>Save Profile</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  content: { padding: 18, gap: 14, paddingBottom: 34 },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 18,
    gap: 13,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  microsoftHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  microsoftBadge: {
    width: 28,
    height: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  microsoftTile: { width: 13, height: 13 },
  microsoftCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  microsoftStatus: {
    color: colors.statusSuccessText,
    backgroundColor: colors.successBackground,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  microsoftName: { color: colors.bodyText, fontSize: 18, fontWeight: "900" },
  microsoftEmail: { color: colors.supportingText, fontSize: 14, marginTop: -8 },
  profilePhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  profilePhotoCopy: { flex: 1, marginLeft: 14 },
  profilePhotoTitle: { color: colors.bodyText, fontSize: 15, fontWeight: '900' },
  profilePhotoDetail: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  profilePhotoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 9,
  },
  profilePhotoAction: {
    minHeight: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  profilePhotoActionText: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
  },
  signOut: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { color: colors.bodyText, fontSize: 14, fontWeight: "900" },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  section: { flex: 1, color: colors.bodyText, fontSize: 13, letterSpacing: 1.5, fontWeight: '900' },
  status: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusComplete: { backgroundColor: colors.successBackground },
  statusIncomplete: { backgroundColor: colors.dangerBackground },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  statusTextComplete: { color: colors.statusSuccessText },
  statusTextIncomplete: { color: colors.statusDangerText },
  field: { gap: 7 },
  label: { color: colors.bodyText, fontWeight: '800', fontSize: 15 },
  input: {
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    color: colors.inputText,
    fontSize: 16,
  },
  placeholderText: { color: colors.placeholderText },
  select: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
  },
  selectValue: { flex: 1, color: colors.inputText, fontSize: 16 },
  selectPlaceholder: { color: colors.placeholderText },
  selectArrow: { color: colors.accent, fontSize: 11, fontWeight: '900', marginLeft: 12 },
  officeOptions: {
    overflow: 'hidden',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cardBackground,
  },
  officeOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inputBorder,
  },
  officeOptionSelected: { backgroundColor: colors.accentSoft },
  officeOptionText: { flex: 1, color: colors.bodyText, fontSize: 15, fontWeight: '700' },
  officeOptionTextSelected: { color: colors.accentDark, fontWeight: '900' },
  officeTick: { color: colors.accent, fontSize: 17, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  hint: { color: colors.supportingText, lineHeight: 19, fontSize: 13 },
  signatureHint: { color: colors.supportingText, lineHeight: 19, fontSize: 13 },
  signatureSelect: {
    minHeight: 68,
    borderRadius: 11,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signatureSelectContent: { flex: 1, paddingRight: 10 },
  selectorLabel: { color: colors.supportingText, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  selectorValue: { color: colors.bodyText, marginTop: 4, fontSize: 16 },
  chevron: { color: colors.accent, fontSize: 24, fontWeight: '800', lineHeight: 26 },
  signatureOptions: {
    backgroundColor: colors.raisedSurface,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 11,
    overflow: 'hidden',
    marginTop: -3,
  },
  signatureOption: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inputBorder,
  },
  signatureOptionSelected: { backgroundColor: colors.accentSoft },
  signatureOptionPressed: { opacity: 0.78 },
  signatureOptionLast: { borderBottomWidth: 0 },
  optionCopy: { flex: 1 },
  optionLabel: { color: colors.bodyText, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  optionPreview: { color: colors.bodyText, marginTop: 2, fontSize: 20 },
  optionDescription: { color: colors.supportingText, fontSize: 11, marginTop: 2 },
  check: { color: colors.accent, fontSize: 21, fontWeight: '900', paddingLeft: 10 },
  signaturePreviewCard: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.raisedSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  previewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLabel: { color: colors.supportingText, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  previewStyle: { color: colors.supportingText, fontSize: 11 },
  previewName: { color: colors.bodyText, fontSize: 25, marginTop: 6 },
  modeRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  modeOption: {
    flex: 1,
    minWidth: 92,
    minHeight: 62,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  modeOptionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeIcon: { color: colors.supportingText, fontSize: 19, fontWeight: '800' },
  modeIconSelected: { color: colors.accentDark },
  modeText: { color: colors.supportingText, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  modeTextSelected: { color: colors.bodyText },
  themeOptions: { gap: 10, paddingVertical: 3, paddingRight: 4 },
  themeOption: {
    width: 142,
    minHeight: 148,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
    padding: 8,
  },
  themeOptionSelected: { borderColor: colors.accent, borderWidth: 2 },
  themeOptionPressed: { opacity: 0.78 },
  themePreview: { height: 78, borderRadius: 8, overflow: 'hidden' },
  themePreviewHeader: { height: 24, padding: 6, justifyContent: 'flex-end' },
  themePreviewAccent: { height: 3, width: 34, borderRadius: 3 },
  themePreviewBody: { flex: 1, padding: 8, gap: 5, justifyContent: 'center' },
  themePreviewLine: { height: 5, width: '72%', borderRadius: 3, opacity: 0.9 },
  themePreviewLineShort: { height: 4, width: '48%', borderRadius: 3, opacity: 0.55 },
  themePreviewButton: { height: 10, width: 34, borderRadius: 4, marginTop: 3 },
  themeOptionCopy: { paddingTop: 8, paddingRight: 4 },
  themeOptionLabel: { color: colors.bodyText, fontSize: 12, fontWeight: '900' },
  themeOptionMood: { color: colors.supportingText, fontSize: 9, marginTop: 3 },
  themeCheck: { position: 'absolute', top: 10, right: 10, color: colors.accent, fontSize: 17, fontWeight: '900' },
  appearanceSummary: {
    borderLeftWidth: 3,
    backgroundColor: colors.raisedSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  appearanceSummaryLabel: { color: colors.supportingText, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  appearanceSummaryTitle: { color: colors.bodyText, fontSize: 14, fontWeight: '900', marginTop: 3 },
  appearanceSummaryText: { color: colors.supportingText, fontSize: 11, marginTop: 2 },
  pressed: { opacity: 0.82 },
  save: {
    backgroundColor: colors.accent,
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  savePressed: { opacity: 0.82 },
  saveText: { color: colors.navy, fontSize: 17, fontWeight: '900' },
});
