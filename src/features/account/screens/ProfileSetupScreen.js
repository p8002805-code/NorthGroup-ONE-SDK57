import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '../../../theme/ThemeContext';
import {
  createLocalUserId,
  normaliseProfile,
} from '../accountProfile';

const OFFICES = ['Brisbane', 'Sunshine Coast', 'Gladstone'];
const EMAIL_DOMAIN = '@northgroup.com.au';

const emailLocalPart = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/@northgroup\.com\.au$/i, '')
    .replace(/@.*$/, '')
    .replace(/\s+/g, '');

const isProfileSetupReady = (profile) => (
  Boolean(
    profile.firstName
      && profile.lastName
      && profile.office
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
  )
);

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  styles,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholderText.color}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        style={styles.input}
      />
    </View>
  );
}

export default function ProfileSetupScreen({ profile, onComplete }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [draft, setDraft] = useState(() => normaliseProfile(profile));
  const [emailName, setEmailName] = useState(() => emailLocalPart(profile?.email));
  const [saving, setSaving] = useState(false);

  const suggestedInitials = (firstName, lastName) => (
    `${String(firstName || '').trim()[0] || ''}${String(lastName || '').trim()[0] || ''}`
      .toUpperCase()
  );

  const set = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const finishSetup = async () => {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    const clean = normaliseProfile({
      ...draft,
      userId: draft.userId || createLocalUserId(),
      identitySource: draft.identitySource || 'local',
      profileVersion: 1,
      firstName,
      lastName,
      initials: suggestedInitials(firstName, lastName),
      role: draft.role?.trim() || '',
      office: draft.office.trim(),
      email: emailName ? `${emailName}${EMAIL_DOMAIN}` : '',
      vehicle: draft.vehicle.trim(),
      vehicleRego: draft.vehicleRego.trim().toUpperCase(),
      signature: `${firstName} ${lastName}`.trim(),
    });

    if (!isProfileSetupReady(clean)) {
      Alert.alert(
        'Complete your profile',
        'Enter your first name, last name, office and NorthGroup work email.',
      );
      return;
    }

    setSaving(true);
    try {
      await onComplete(clean);
    } catch (error) {
      Alert.alert(
        'Could not save profile',
        error?.message || 'Please check your details and try again.',
      );
      setSaving(false);
    }
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <ImageBackground
        source={require('../../../../assets/topo-bg-vertical.png')}
        style={styles.hero}
        imageStyle={styles.heroBackground}
        resizeMode="cover"
      >
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Image
            source={require('../../../../assets/logo-transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.heroEyebrow}>WELCOME TO NORTHGROUP ONE</Text>
          <Text style={styles.heroTitle}>Create Your Profile</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroSubtitle}>
            One quick setup, then you’re ready for the field.
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progressStepActive}>
              <Text style={styles.progressNumberActive}>1</Text>
            </View>
            <View style={styles.progressLine} />
            <View style={styles.progressStep}>
              <Text style={styles.progressNumber}>2</Text>
            </View>
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabelActive}>YOUR PROFILE</Text>
            <Text style={styles.progressLabel}>CHOOSE A JOB</Text>
          </View>
        </View>
      </ImageBackground>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introCard}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>1</Text>
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>A quick one-time setup</Text>
            <Text style={styles.introText}>
              Complete your work profile, then choose your first job. You can update these details later in Profile Settings.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>YOUR DETAILS</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label="First Name"
                value={draft.firstName}
                onChangeText={(value) => set('firstName', value)}
                autoCapitalize="words"
                styles={styles}
              />
            </View>
            <View style={styles.half}>
              <Field
                label="Last Name"
                value={draft.lastName}
                onChangeText={(value) => set('lastName', value)}
                autoCapitalize="words"
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Office</Text>
            <View style={styles.officeRow}>
              {OFFICES.map((office) => {
                const selected = draft.office === office;
                return (
                  <Pressable
                    key={office}
                    style={({ pressed }) => [
                      styles.officeOption,
                      selected && styles.officeOptionSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => set('office', office)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.officeOptionText,
                        selected && styles.officeOptionTextSelected,
                      ]}
                    >
                      {office}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Work Email</Text>
            <View style={styles.emailInput}>
              <TextInput
                value={emailName}
                onChangeText={(value) => setEmailName(emailLocalPart(value))}
                placeholderTextColor={styles.placeholderText.color}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={styles.emailNameInput}
              />
              <Text style={styles.emailDomain}>{EMAIL_DOMAIN}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>WORK VEHICLE</Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalText}>OPTIONAL</Text>
            </View>
          </View>
          <Field
            label="Vehicle Make"
            value={draft.vehicle}
            onChangeText={(value) => set('vehicle', value)}
            placeholder="e.g. Toyota Hilux"
            autoCapitalize="words"
            styles={styles}
          />
          <Field
            label="Vehicle Rego"
            value={draft.vehicleRego}
            onChangeText={(value) => set('vehicleRego', value.toUpperCase())}
            placeholder="e.g. 123 ABC"
            autoCapitalize="characters"
            autoCorrect={false}
            styles={styles}
          />
          <Text style={styles.hint}>
            Add these now to pre-fill vehicle forms, or leave them blank and update them later in Profile Settings.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            (pressed || saving) && styles.continueButtonPressed,
          ]}
          onPress={finishSetup}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving Profile…' : 'Continue to Choose Your Job'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  hero: {
    minHeight: 310,
    backgroundColor: colors.navy,
    justifyContent: 'flex-end',
  },
  heroBackground: { opacity: 0.76 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,17,30,0.50)',
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 24,
  },
  logo: { width: 94, height: 62, marginBottom: 5 },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '800',
    marginTop: 7,
  },
  heroDivider: {
    width: 38,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginVertical: 11,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    textAlign: 'center',
  },
  progressRow: {
    width: 190,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  progressStepActive: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStep: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(4,25,43,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumberActive: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  progressNumber: { color: colors.white, fontSize: 12, fontWeight: '900' },
  progressLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  progressLabels: {
    width: 244,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  progressLabelActive: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  content: {
    padding: 18,
    gap: 14,
    paddingBottom: 38,
    marginTop: -1,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  stepBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  stepBadgeText: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  introCopy: { flex: 1 },
  introTitle: { color: colors.bodyText, fontSize: 16, fontWeight: '900' },
  introText: { color: colors.supportingText, fontSize: 13, lineHeight: 18, marginTop: 3 },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  section: {
    color: colors.bodyText,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionalBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.accentSoft,
  },
  optionalText: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
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
  emailInput: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    overflow: 'hidden',
  },
  emailNameInput: {
    flex: 1,
    minWidth: 70,
    height: 50,
    paddingLeft: 14,
    paddingRight: 4,
    color: colors.inputText,
    fontSize: 15,
  },
  emailDomain: {
    color: colors.supportingText,
    fontSize: 13,
    fontWeight: '700',
    paddingRight: 12,
  },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  officeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  officeOption: {
    minHeight: 43,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.raisedSurface,
    paddingHorizontal: 11,
  },
  officeOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  officeOptionText: {
    color: colors.supportingText,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  officeOptionTextSelected: { color: colors.bodyText, fontWeight: '900' },
  hint: { color: colors.supportingText, fontSize: 13, lineHeight: 19 },
  continueButton: {
    minHeight: 58,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
  },
  continueButtonPressed: { opacity: 0.8 },
  continueButtonText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  pressed: { opacity: 0.82 },
});
