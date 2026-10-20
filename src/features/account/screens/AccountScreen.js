import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
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
import { BUILD_INFO } from '../../../config/buildInfo';
import { normaliseProfile } from '../accountProfile';
import { useTheme } from '../../../theme/ThemeContext';
import { suggestedUserInitials } from '../../../utils/userInitials';
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

const EDITABLE_KEYS = [
  'firstName',
  'lastName',
  'initials',
  'role',
  'office',
  'phone',
  'vehicle',
  'vehicleRego',
  'signature',
  'signatureStyle',
  'themeId',
  'appearanceMode',
];

const cleanText = (value) => String(value || '').trim();

const fullNameFor = (profile) => (
  (cleanText(profile?.firstName) + ' ' + cleanText(profile?.lastName)).trim()
);

const suggestedInitials = (firstName, lastName) => (
  suggestedUserInitials({ firstName, lastName })
);

const sameValue = (left, right) => String(left || '') === String(right || '');

const getSignatureStyle = (id) => (
  SIGNATURE_STYLES.find((style) => style.id === id) || SIGNATURE_STYLES[0]
);

function MicrosoftMark({ size = 28, styles }) {
  const tileSize = Math.max(5, Math.floor((size - 3) / 2));

  return (
    <View style={[styles.microsoftMark, { width: size, height: size }]}>
      <View style={[styles.microsoftTile, { width: tileSize, height: tileSize, backgroundColor: '#F25022' }]} />
      <View style={[styles.microsoftTile, { width: tileSize, height: tileSize, backgroundColor: '#7FBA00' }]} />
      <View style={[styles.microsoftTile, { width: tileSize, height: tileSize, backgroundColor: '#00A4EF' }]} />
      <View style={[styles.microsoftTile, { width: tileSize, height: tileSize, backgroundColor: '#FFB900' }]} />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
  styles,
  colors,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholderText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
        selectionColor={colors.accent}
        style={styles.input}
      />
    </View>
  );
}

function SettingRow({ icon, title, description, value, onPress, styles, colors, right }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={'Edit ' + title}
    >
      <View style={styles.settingIcon}>
        <Text style={styles.settingIconText}>{icon}</Text>
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
        {value ? <Text style={styles.settingValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {right || <Text style={[styles.settingArrow, { color: colors.accent }]}>›</Text>}
    </Pressable>
  );
}

function EditorSection({ label, children, styles }) {
  return (
    <View style={styles.editorSection}>
      <Text style={styles.editorSectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ModalEditor({
  visible,
  title,
  subtitle,
  onCancel,
  onDone,
  saving = false,
  children,
  styles,
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const requestCancel = useCallback(() => {
    if (saving) return;
    Keyboard.dismiss();
    onCancel();
  }, [onCancel, saving]);
  const dismissWithGesture = useCallback(() => {
    if (saving) return;
    Animated.timing(translateY, {
      toValue: 460,
      duration: 180,
      useNativeDriver: true,
    }).start(requestCancel);
  }, [requestCancel, saving, translateY]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => (
      !saving && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
    ),
    onPanResponderMove: (_event, gesture) => {
      translateY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 80 || gesture.vy > 1.05) {
        dismissWithGesture();
        return;
      }
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [dismissWithGesture, saving, translateY]);

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [translateY, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={requestCancel}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={requestCancel}
          accessibilityRole="button"
          accessibilityLabel={'Cancel editing ' + title}
        />
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.editorSheet, { transform: [{ translateY }] }]}>
            <View style={styles.sheetDragArea} {...panResponder.panHandlers}>
              <View style={styles.sheetGrabber} />
            </View>
            <View style={styles.editorHeader}>
              <Pressable
                style={({ pressed }) => [styles.editorAction, pressed && styles.pressed]}
                onPress={requestCancel}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={'Cancel editing ' + title}
              >
                <Text style={styles.editorCancel}>Cancel</Text>
              </Pressable>
              <View style={styles.editorHeading}>
                <Text style={styles.editorTitle}>{title}</Text>
                <Text style={styles.editorSubtitle}>{subtitle}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.editorDone, pressed && styles.primaryPressed]}
                onPress={onDone}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={'Save changes to ' + title}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#061A2D" />
                  : <Text style={styles.editorDoneText}>Save</Text>}
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.editorContent}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  openDiagnostics,
}) {
  const { colors, systemScheme } = useTheme();
  const persistedProfile = useMemo(() => normaliseProfile(profile), [profile]);
  const [draft, setDraft] = useState(() => normaliseProfile(profile));
  const [activeEditor, setActiveEditor] = useState(null);
  const [editorBackup, setEditorBackup] = useState(null);
  const [saving, setSaving] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const accountEmail = cleanText(microsoftAccount?.email || draft.email);
  const fieldName = fullNameFor(draft);
  const heroName = fieldName || cleanText(microsoftAccount?.displayName) || 'Field profile';
  const heroMeta = [
    cleanText(draft.role) || 'Role not set',
    cleanText(draft.office) || 'Office not set',
  ].join(' · ');
  const initials = draft.initials || suggestedInitials(draft.firstName, draft.lastName) || 'NG';
  const selectedSignature = getSignatureStyle(draft.signatureStyle);
  const selectedColourMode = resolveColourMode(draft.appearanceMode, systemScheme);
  const selectedTheme = THEME_OPTIONS.find((option) => option.id === draft.themeId)
    || THEME_OPTIONS[0];
  const selectedMode = MODE_OPTIONS.find((option) => option.id === draft.appearanceMode)
    || MODE_OPTIONS[0];
  const vehicleSummary = draft.vehicle
    ? draft.vehicle + (draft.vehicleRego ? ' · ' + draft.vehicleRego : '')
    : 'No vehicle default set';
  const profileReady = Boolean(
    cleanText(draft.firstName)
      && cleanText(draft.lastName)
      && cleanText(draft.initials || initials)
      && cleanText(draft.office)
      && accountEmail,
  );
  const hasUnsavedChanges = EDITABLE_KEYS.some((key) => (
    !sameValue(draft[key], persistedProfile[key])
  ));

  useEffect(() => {
    setDraft(normaliseProfile(profile));
  }, [profile]);

  const setValue = (key, value) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };

      if (key === 'firstName' || key === 'lastName') {
        const previousName = fullNameFor(current);
        const nextName = fullNameFor(next);
        const previousInitials = suggestedInitials(current.firstName, current.lastName);

        if (!current.initials || current.initials === previousInitials) {
          next.initials = suggestedInitials(next.firstName, next.lastName);
        }
        if (!current.signature || current.signature === previousName) {
          next.signature = nextName;
        }
      }

      return next;
    });
  };

  const openEditor = (editor) => {
    setEditorBackup({ ...draft });
    setActiveEditor(editor);
  };

  const closeEditor = (commit) => {
    if (!commit && editorBackup) setDraft(editorBackup);
    setActiveEditor(null);
    setEditorBackup(null);
    Keyboard.dismiss();
  };

  const save = async (closeEditorOnSuccess = false) => {
    if (saving) return;

    const firstName = cleanText(draft.firstName);
    const lastName = cleanText(draft.lastName);
    const office = cleanText(draft.office);

    if (!firstName || !lastName || !office) {
      Alert.alert(
        'Complete your field profile',
        'First name, last name and office are needed for supported forms.',
      );
      openEditor('profile');
      return;
    }

    const cleanProfile = normaliseProfile({
      ...draft,
      firstName,
      lastName,
      initials: cleanText(draft.initials || suggestedInitials(firstName, lastName))
        .toUpperCase()
        .slice(0, 4),
      role: cleanText(draft.role),
      office,
      phone: cleanText(draft.phone),
      vehicle: cleanText(draft.vehicle),
      vehicleRego: cleanText(draft.vehicleRego).toUpperCase(),
      signature: cleanText(draft.signature) || firstName + ' ' + lastName,
      email: accountEmail || draft.email,
      signatureStyle: selectedSignature.id,
    });

    setSaving(true);
    try {
      await onSave(cleanProfile);
      setDraft(cleanProfile);
      Keyboard.dismiss();
      if (closeEditorOnSuccess) {
        setActiveEditor(null);
        setEditorBackup(null);
      } else {
        Alert.alert('Profile updated', 'Your field details will now pre-fill supported forms.');
      }
    } catch (error) {
      Alert.alert(
        'Could not save profile',
        error?.message || 'Please check your details and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveEditor = () => save(true);

  const discardChanges = () => {
    Alert.alert(
      'Discard changes?',
      'Your unsaved profile changes will be removed.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => setDraft({ ...persistedProfile }),
        },
      ],
    );
  };

  const requestBack = () => {
    if (!hasUnsavedChanges) {
      goBack();
      return;
    }

    Alert.alert(
      'Unsaved changes',
      'Save your profile changes before leaving?',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Leave without saving',
          style: 'destructive',
          onPress: () => {
            setDraft({ ...persistedProfile });
            goBack();
          },
        },
        { text: 'Save changes', onPress: () => save(false) },
      ],
    );
  };

  const refreshPhoto = async () => {
    try {
      await onRefreshProfilePhoto?.();
    } catch (error) {
      Alert.alert(
        'Profile photo unavailable',
        error?.message || 'Your Microsoft profile photo could not be refreshed.',
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

  const requestSignOut = () => {
    Alert.alert(
      'Sign out of Microsoft?',
      'You will need your NorthGroup work account to enter the app again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onMicrosoftSignOut },
      ],
    );
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="ACCOUNT"
        title="Profile Settings"
        onBack={requestBack}
        backOnly
        backCompact
        compact
        centred
        showTopo
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <ProfileAvatar
              uri={profilePhotoUri}
              revision={profilePhotoRevision}
              initials={initials}
              size={78}
              backgroundColor={colors.accent}
              textColor={colors.navy}
              borderColor={colors.accent}
              borderWidth={2}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>FIELD PROFILE</Text>
              <Text style={styles.heroName} numberOfLines={2}>{heroName}</Text>
              <Text style={styles.heroMeta} numberOfLines={2}>{heroMeta}</Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroFooter}>
            <View style={[styles.readyPill, profileReady ? styles.readyPillComplete : styles.readyPillNeedsWork]}>
              <View style={[styles.readyDot, profileReady ? styles.readyDotComplete : styles.readyDotNeedsWork]} />
              <Text style={[styles.readyText, profileReady ? styles.readyTextComplete : styles.readyTextNeedsWork]}>
                {profileReady ? 'READY FOR FIELD FORMS' : 'PROFILE NEEDS DETAILS'}
              </Text>
            </View>
            <Text style={styles.heroHint}>Edit the field details used on forms.</Text>
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>FIELD SETTINGS</Text>
        <View style={styles.card}>
          <SettingRow
            icon="✎"
            title="Field profile"
            description="Name, initials, role, office and phone"
            onPress={() => openEditor('profile')}
            styles={styles}
            colors={colors}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="▣"
            title="Vehicle defaults"
            description="Used to pre-fill vehicle and journey forms"
            value={vehicleSummary}
            onPress={() => openEditor('vehicle')}
            styles={styles}
            colors={colors}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="✍"
            title="Signature on forms"
            description="Choose the name and style used on completed PDFs"
            onPress={() => openEditor('signature')}
            right={(
              <Text style={[styles.signatureRowPreview, selectedSignature.textStyle]}>
                {draft.signature || fieldName || 'Your Name'}
              </Text>
            )}
            styles={styles}
            colors={colors}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="◐"
            title="Appearance"
            description="Colour style and light or dark mode"
            value={selectedTheme.shortLabel + ' · ' + selectedMode.label}
            onPress={() => openEditor('appearance')}
            styles={styles}
            colors={colors}
          />
        </View>

        <Text style={styles.sectionEyebrow}>APP</Text>
        <View style={styles.card}>
          <SettingRow
            icon="i"
            title="App & diagnostics"
            description="Build identity, active job and connection checks"
            value={`${BUILD_INFO.releaseId} · ${BUILD_INFO.runtime}`}
            onPress={openDiagnostics}
            styles={styles}
            colors={colors}
          />
        </View>

        <Text style={styles.sectionEyebrow}>MICROSOFT ACCOUNT</Text>
        <View style={styles.card}>
          <View style={styles.accountHeading}>
            <View style={styles.accountIcon}>
              <MicrosoftMark size={28} styles={styles} />
            </View>
            <View style={styles.accountHeadingCopy}>
              <Text style={styles.cardTitle}>Connected work account</Text>
              <View style={styles.connectedLine}>
                <View style={styles.connectedDot} />
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            </View>
          </View>
          <View style={styles.emailRow}>
            <Text style={styles.emailLabel}>SIGN-IN EMAIL</Text>
            <Text style={styles.emailValue} numberOfLines={1}>
              {accountEmail || 'Microsoft account email unavailable'}
            </Text>
            <Text style={styles.accountHint}>
              Managed by Microsoft and used to access NorthGroup services.
            </Text>
          </View>
          <View style={styles.accountActions}>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={refreshPhoto}
              disabled={profilePhotoLoading}
              accessibilityRole="button"
              accessibilityLabel="Refresh Microsoft profile photo"
            >
              {profilePhotoLoading ? (
                <ActivityIndicator size="small" color={colors.accentDark} />
              ) : (
                <Text style={styles.secondaryButtonText}>Refresh photo</Text>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={manageMicrosoftProfile}
              accessibilityRole="button"
              accessibilityLabel="Manage Microsoft profile"
            >
              <Text style={styles.secondaryButtonText}>Manage in Microsoft</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.smallNote}>
          Profile changes are saved to this Microsoft account and used as defaults on supported field forms.
        </Text>
        <Text style={styles.buildStamp} selectable>
          NorthGroup ONE · {BUILD_INFO.releaseId} · v{BUILD_INFO.version} ({BUILD_INFO.buildNumber})
        </Text>
        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
          onPress={requestSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out of Microsoft"
        >
          <Text style={styles.signOutText}>Sign out of Microsoft</Text>
        </Pressable>
      </ScrollView>

      {hasUnsavedChanges ? (
        <View style={styles.saveTray}>
          <View style={styles.saveTrayCopy}>
            <Text style={styles.saveTrayLabel}>UNSAVED CHANGES</Text>
            <Text style={styles.saveTrayHint}>Save when your profile is ready.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.discardButton, pressed && styles.pressed]}
            onPress={discardChanges}
            disabled={saving}
          >
            <Text style={styles.discardButtonText}>Discard</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              saving && styles.saveButtonDisabled,
              pressed && styles.primaryPressed,
            ]}
            onPress={() => save(false)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.navy} />
              : <Text style={styles.saveButtonText}>Save changes</Text>}
          </Pressable>
        </View>
      ) : null}

      <ModalEditor
        visible={activeEditor === 'profile'}
        title="Field profile"
        subtitle="Details shown on forms"
        onCancel={() => closeEditor(false)}
        onDone={saveEditor}
        saving={saving}
        styles={styles}
      >
        <Text style={styles.editorIntro}>
          Keep the details that identify you in the field. Your Microsoft sign-in email is managed separately.
        </Text>
        <View style={styles.fieldRow}>
          <View style={styles.fieldColumn}>
            <Field
              label="First name"
              value={draft.firstName}
              onChangeText={(value) => setValue('firstName', value)}
              placeholder="Patrick"
              styles={styles}
              colors={colors}
            />
          </View>
          <View style={styles.fieldColumn}>
            <Field
              label="Last name"
              value={draft.lastName}
              onChangeText={(value) => setValue('lastName', value)}
              placeholder="Carroll"
              styles={styles}
              colors={colors}
            />
          </View>
        </View>
        <EditorSection label="IDENTIFIER" styles={styles}>
          <View style={styles.initialsRow}>
            <TextInput
              value={draft.initials || ''}
              onChangeText={(value) => setValue('initials', value.toUpperCase().slice(0, 4))}
              placeholder={suggestedInitials(draft.firstName, draft.lastName) || 'PC'}
              placeholderTextColor={colors.placeholderText}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              selectionColor={colors.accent}
              style={[styles.input, styles.initialsInput]}
            />
            <Pressable
              style={({ pressed }) => [styles.autoButton, pressed && styles.pressed]}
              onPress={() => setValue('initials', suggestedInitials(draft.firstName, draft.lastName))}
              accessibilityRole="button"
              accessibilityLabel="Use automatic initials"
            >
              <Text style={styles.autoButtonText}>Use automatic</Text>
            </Pressable>
          </View>
          <Text style={styles.fieldHint}>Used for photo labels and compact field references.</Text>
        </EditorSection>
        <Field
          label="Role"
          value={draft.role}
          onChangeText={(value) => setValue('role', value)}
          placeholder="Surveyor"
          styles={styles}
          colors={colors}
        />
        <EditorSection label="OFFICE" styles={styles}>
          <View style={styles.choiceGrid}>
            {OFFICES.map((office) => {
              const selected = draft.office === office;
              return (
                <Pressable
                  key={office}
                  style={({ pressed }) => [
                    styles.choiceButton,
                    selected && styles.choiceButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setValue('office', office)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.choiceButtonText, selected && styles.choiceButtonTextSelected]}>
                    {office}
                  </Text>
                  {selected ? <Text style={styles.choiceTick}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </EditorSection>
        <Field
          label="Phone"
          value={draft.phone}
          onChangeText={(value) => setValue('phone', value)}
          placeholder="Optional"
          keyboardType="phone-pad"
          styles={styles}
          colors={colors}
        />
      </ModalEditor>

      <ModalEditor
        visible={activeEditor === 'vehicle'}
        title="Vehicle defaults"
        subtitle="Used by supported forms"
        onCancel={() => closeEditor(false)}
        onDone={saveEditor}
        saving={saving}
        styles={styles}
      >
        <Text style={styles.editorIntro}>
          These optional details are copied into vehicle and journey forms when they are blank.
        </Text>
        <Field
          label="Vehicle / make and model"
          value={draft.vehicle}
          onChangeText={(value) => setValue('vehicle', value)}
          placeholder="Toyota Hilux"
          styles={styles}
          colors={colors}
        />
        <Field
          label="Registration"
          value={draft.vehicleRego}
          onChangeText={(value) => setValue('vehicleRego', value.toUpperCase())}
          placeholder="123 ABC"
          autoCapitalize="characters"
          autoCorrect={false}
          styles={styles}
          colors={colors}
        />
        <View style={styles.infoCallout}>
          <Text style={styles.infoCalloutIcon}>i</Text>
          <Text style={styles.infoCalloutText}>
            The default job is managed from the Jobs page so job selection stays separate from personal settings.
          </Text>
        </View>
      </ModalEditor>

      <ModalEditor
        visible={activeEditor === 'signature'}
        title="Signature on forms"
        subtitle="Shown on completed PDFs"
        onCancel={() => closeEditor(false)}
        onDone={saveEditor}
        saving={saving}
        styles={styles}
      >
        <Text style={styles.editorIntro}>
          Choose the name and style that appear in the signature area of supported completed forms.
        </Text>
        <Field
          label="Name shown on forms"
          value={draft.signature}
          onChangeText={(value) => setValue('signature', value)}
          placeholder={fieldName || 'Your name'}
          autoCapitalize="words"
          styles={styles}
          colors={colors}
        />
        <EditorSection label="SIGNATURE STYLE" styles={styles}>
          <View style={styles.signatureGrid}>
            {SIGNATURE_STYLES.map((style) => {
              const selected = selectedSignature.id === style.id;
              return (
                <Pressable
                  key={style.id}
                  style={({ pressed }) => [
                    styles.signatureCard,
                    selected && styles.signatureCardSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setValue('signatureStyle', style.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={'Choose ' + style.label + ' signature style'}
                >
                  <Text style={styles.signatureCardLabel}>{style.label}</Text>
                  <Text style={[styles.signatureCardPreview, style.textStyle]} numberOfLines={1}>
                    {draft.signature || fieldName || 'Your Name'}
                  </Text>
                  <Text style={styles.signatureCardDescription}>{style.description}</Text>
                  {selected ? <Text style={styles.signatureCardTick}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </EditorSection>
        <View style={styles.signaturePreview}>
          <View style={styles.signaturePreviewHeading}>
            <Text style={styles.signaturePreviewLabel}>LIVE PREVIEW</Text>
            <Text style={styles.signaturePreviewStyle}>{selectedSignature.label}</Text>
          </View>
          <Text style={[styles.signaturePreviewName, selectedSignature.textStyle]} numberOfLines={1}>
            {draft.signature || fieldName || 'Your Name'}
          </Text>
        </View>
      </ModalEditor>

      <ModalEditor
        visible={activeEditor === 'appearance'}
        title="Appearance"
        subtitle="Your field workspace"
        onCancel={() => closeEditor(false)}
        onDone={saveEditor}
        saving={saving}
        styles={styles}
      >
        <Text style={styles.editorIntro}>
          Select a comfortable colour style for long field days. Your choice is applied when you save Profile Settings.
        </Text>
        <EditorSection label="LIGHT OR DARK MODE" styles={styles}>
          <View style={styles.modeGrid}>
            {MODE_OPTIONS.map((option) => {
              const selected = draft.appearanceMode === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.modeCard,
                    selected && styles.modeCardSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setValue('appearanceMode', option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.modeIcon, selected && styles.modeIconSelected]}>{option.icon}</Text>
                  <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{option.label}</Text>
                  {selected ? <Text style={styles.modeTick}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </EditorSection>
        <EditorSection label="COLOUR STYLE" styles={styles}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themeScroll}
          >
            {THEME_OPTIONS.map((option) => {
              const selected = draft.themeId === option.id;
              const preview = getThemePreview(option.id, selectedColourMode);
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.themeCard,
                    selected && styles.themeCardSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setValue('themeId', option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={'Choose ' + option.label + ' colour style'}
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
                  <Text style={styles.themeCardTitle} numberOfLines={1}>{option.shortLabel}</Text>
                  <Text style={styles.themeCardMood} numberOfLines={1}>{option.mood}</Text>
                  {selected ? <Text style={styles.themeCardTick}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </EditorSection>
      </ModalEditor>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  content: { padding: 16, paddingBottom: 34, gap: 14, backgroundColor: colors.pageBackground },
  heroCard: {
    backgroundColor: colors.headerSurface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroCopy: { flex: 1, marginLeft: 15 },
  heroEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 5 },
  heroName: { color: colors.white, fontSize: 23, lineHeight: 28, fontWeight: '900' },
  heroMeta: { color: 'rgba(255,255,255,0.74)', fontSize: 13, lineHeight: 18, marginTop: 4 },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 16 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  readyPill: { minHeight: 27, borderRadius: 999, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  readyPillComplete: { backgroundColor: 'rgba(48,209,88,0.18)' },
  readyPillNeedsWork: { backgroundColor: 'rgba(255,192,0,0.18)' },
  readyDot: { width: 7, height: 7, borderRadius: 7, marginRight: 6 },
  readyDotComplete: { backgroundColor: '#30D158' },
  readyDotNeedsWork: { backgroundColor: '#FFC000' },
  readyText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  readyTextComplete: { color: '#9AF5B2' },
  readyTextNeedsWork: { color: '#FFD77A' },
  heroHint: { color: 'rgba(255,255,255,0.62)', flex: 1, fontSize: 11, lineHeight: 15, textAlign: 'right' },
  sectionEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 3, marginLeft: 3 },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 17,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  settingRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  settingIconText: { color: colors.accentDark, fontSize: 18, fontWeight: '900' },
  settingCopy: { flex: 1, paddingRight: 10 },
  settingTitle: { color: colors.bodyText, fontSize: 15, fontWeight: '900' },
  settingDescription: { color: colors.supportingText, fontSize: 11, lineHeight: 16, marginTop: 3 },
  settingValue: { color: colors.accentDark, fontSize: 11, fontWeight: '800', marginTop: 3 },
  settingArrow: { fontSize: 29, lineHeight: 31, fontWeight: '300' },
  signatureRowPreview: { maxWidth: 104, color: colors.bodyText, fontSize: 15, textAlign: 'right' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 50 },
  accountHeading: { flexDirection: 'row', alignItems: 'center', paddingTop: 16 },
  accountIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: colors.raisedSurface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  microsoftMark: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  microsoftTile: { borderRadius: 1 },
  accountHeadingCopy: { flex: 1 },
  cardTitle: { color: colors.bodyText, fontSize: 15, fontWeight: '900' },
  connectedLine: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  connectedDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: colors.success, marginRight: 6 },
  connectedText: { color: colors.statusSuccessText, fontSize: 11, fontWeight: '800' },
  emailRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 15, paddingTop: 13 },
  emailLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  emailValue: { color: colors.bodyText, fontSize: 15, fontWeight: '800', marginTop: 5 },
  accountHint: { color: colors.supportingText, fontSize: 11, lineHeight: 16, marginTop: 4 },
  accountActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 13, paddingBottom: 16 },
  secondaryButton: { minHeight: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.accentDark, fontSize: 10, fontWeight: '900' },
  smallNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 },
  buildStamp: { color: colors.textMuted, fontSize: 9, lineHeight: 14, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },
  signOutButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  signOutText: { color: colors.statusDangerText, fontSize: 13, fontWeight: '900' },
  saveTray: { backgroundColor: colors.cardBackground, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 14 : 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveTrayCopy: { flex: 1, minWidth: 0 },
  saveTrayLabel: { color: colors.accentDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  saveTrayHint: { color: colors.supportingText, fontSize: 10, marginTop: 2 },
  discardButton: { minHeight: 39, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  discardButtonText: { color: colors.supportingText, fontSize: 11, fontWeight: '800' },
  saveButton: { minHeight: 41, borderRadius: 11, backgroundColor: colors.accent, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  saveButtonDisabled: { opacity: 0.62 },
  saveButtonText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  editorSheet: { maxHeight: '92%', minHeight: '48%', backgroundColor: colors.cardBackground, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 9, overflow: 'hidden' },
  sheetDragArea: { minHeight: 25, justifyContent: 'flex-start' },
  sheetGrabber: { width: 38, height: 4, borderRadius: 4, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: 5 },
  editorHeader: { minHeight: 65, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  editorAction: { minWidth: 70, minHeight: 38, justifyContent: 'center' },
  editorCancel: { color: colors.supportingText, fontSize: 13, fontWeight: '800' },
  editorHeading: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  editorTitle: { color: colors.bodyText, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  editorSubtitle: { color: colors.textMuted, fontSize: 10, marginTop: 3, textAlign: 'center' },
  editorDone: { minWidth: 70, minHeight: 36, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  editorDoneText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  editorContent: { padding: 18, paddingBottom: 36, gap: 18 },
  editorIntro: { color: colors.supportingText, fontSize: 13, lineHeight: 19 },
  editorSection: { gap: 9 },
  editorSectionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldColumn: { flex: 1 },
  field: { gap: 7 },
  fieldLabel: { color: colors.bodyText, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 50, borderRadius: 12, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 13, color: colors.inputText, fontSize: 16 },
  initialsRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  initialsInput: { flex: 1 },
  fieldHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 1 },
  autoButton: { minHeight: 50, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, justifyContent: 'center', alignItems: 'center' },
  autoButtonText: { color: colors.accentDark, fontSize: 11, fontWeight: '900' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceButton: { minHeight: 44, flexGrow: 1, flexBasis: '31%', borderRadius: 11, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  choiceButtonSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceButtonText: { color: colors.supportingText, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  choiceButtonTextSelected: { color: colors.accentDark, fontWeight: '900' },
  choiceTick: { color: colors.accentDark, fontSize: 14, fontWeight: '900', marginLeft: 5 },
  infoCallout: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.infoBackground, borderRadius: 12, padding: 12 },
  infoCalloutIcon: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.info, color: colors.white, fontSize: 12, fontWeight: '900', lineHeight: 19, textAlign: 'center', marginRight: 9 },
  infoCalloutText: { flex: 1, color: colors.statusInfoText, fontSize: 11, lineHeight: 16 },
  signatureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  signatureCard: { minHeight: 111, flexGrow: 1, flexBasis: '45%', borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface, padding: 11, position: 'relative' },
  signatureCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft, borderWidth: 2 },
  signatureCardLabel: { color: colors.bodyText, fontSize: 11, fontWeight: '900' },
  signatureCardPreview: { color: colors.bodyText, fontSize: 20, marginTop: 7 },
  signatureCardDescription: { color: colors.supportingText, fontSize: 9, lineHeight: 13, marginTop: 5 },
  signatureCardTick: { position: 'absolute', top: 9, right: 10, color: colors.accentDark, fontSize: 16, fontWeight: '900' },
  signaturePreview: { minHeight: 102, borderRadius: 14, borderWidth: 1, borderLeftWidth: 3, borderColor: colors.border, borderLeftColor: colors.accent, backgroundColor: colors.raisedSurface, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  signaturePreviewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signaturePreviewLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  signaturePreviewStyle: { color: colors.supportingText, fontSize: 10 },
  signaturePreviewName: { color: colors.bodyText, fontSize: 27, marginTop: 7 },
  modeGrid: { flexDirection: 'row', gap: 8 },
  modeCard: { flex: 1, minHeight: 82, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface, alignItems: 'center', justifyContent: 'center', padding: 8, position: 'relative' },
  modeCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeIcon: { color: colors.supportingText, fontSize: 22, fontWeight: '800' },
  modeIconSelected: { color: colors.accentDark },
  modeLabel: { color: colors.supportingText, fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  modeLabelSelected: { color: colors.bodyText },
  modeTick: { position: 'absolute', top: 7, right: 8, color: colors.accentDark, fontSize: 13, fontWeight: '900' },
  themeScroll: { gap: 10, paddingRight: 4 },
  themeCard: { width: 148, minHeight: 151, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface, padding: 8, position: 'relative' },
  themeCardSelected: { borderColor: colors.accent, borderWidth: 2 },
  themePreview: { height: 81, borderRadius: 9, overflow: 'hidden' },
  themePreviewHeader: { height: 25, padding: 6, justifyContent: 'flex-end' },
  themePreviewAccent: { height: 3, width: 36, borderRadius: 3 },
  themePreviewBody: { flex: 1, padding: 8, gap: 5, justifyContent: 'center' },
  themePreviewLine: { height: 5, width: '72%', borderRadius: 3, opacity: 0.9 },
  themePreviewLineShort: { height: 4, width: '48%', borderRadius: 3, opacity: 0.55 },
  themePreviewButton: { height: 10, width: 34, borderRadius: 4, marginTop: 3 },
  themeCardTitle: { color: colors.bodyText, fontSize: 12, fontWeight: '900', marginTop: 8 },
  themeCardMood: { color: colors.supportingText, fontSize: 9, marginTop: 3 },
  themeCardTick: { position: 'absolute', top: 10, right: 10, color: colors.accentDark, fontSize: 17, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  primaryPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
