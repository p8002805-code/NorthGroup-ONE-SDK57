import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppHeader from '../components/AppHeader';
import AppSectionHeader from '../components/AppSectionHeader';
import CurrentJobCard from '../components/CurrentJobCard';
import LoadingOverlay from '../components/LoadingOverlay';
import {
  ChoiceRow,
  FormInput,
  FormSection,
  PrimaryButton,
  useOperationalStyles,
} from '../components/OperationalFormComponents';
import { emptyS506, S506_RISK_ITEMS } from '../data/operationalForms';
import { exportOperationalPdf } from '../export/exportOperationalPdf';
import { applyProfileDefaults as applyAccountProfileDefaults } from '../features/account/accountProfile';
import { jobStorageKey } from '../features/jobs/jobContext';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

const STORAGE_KEY = 's506_form';
const today = () => new Date().toLocaleDateString('en-AU');
const GUIDANCE_ITEMS = [
  'Arrange a buddy contact and agree on expected contact or arrival times.',
  'Ensure the driver and buddy contact can keep their phones charged.',
  'Agree on the response if contact cannot be established within one hour.',
  'Complete this S-506 and a vehicle S-501 before departure.',
  'Repeat the planning process for the return journey.',
];

export default function S506FormScreen({
  goBack,
  profile,
  activeJob,
  onFormStatusChange,
  backLabel = 'Forms',
}) {
  const { colors } = useTheme();
  const styles = useOperationalStyles();
  const localStyles = useMemo(() => createStyles(colors), [colors]);
  const [form, setForm] = useState(emptyS506());
  const [guidance, setGuidance] = useState(false);
  const [exporting, setExporting] = useState(false);

  const applyProfileDefaults = (current) => (
    profile
      ? applyAccountProfileDefaults(current, profile, 's506', activeJob)
      : current
  );

  useEffect(() => {
    AsyncStorage.getItem(jobStorageKey(STORAGE_KEY, activeJob))
      .then((saved) => {
        const current = saved
          ? { ...emptyS506(), ...JSON.parse(saved) }
          : emptyS506();
        setForm(applyProfileDefaults(current));
      })
      .catch(() => {});
  }, [profile, activeJob]);

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setRisk = (key, value) => {
    setForm((current) => ({
      ...current,
      risks: { ...current.risks, [key]: value },
    }));
  };

  const save = async () => {
    await AsyncStorage.setItem(
      jobStorageKey(STORAGE_KEY, activeJob),
      JSON.stringify(form),
    );
    await onFormStatusChange?.('s506', 'draft', { date: form.date });
    Alert.alert('S-506 saved', `Saved under job ${activeJob?.number}.`);
  };

  const clear = () => {
    Alert.alert(
      'Clear S-506?',
      'This will clear the journey details and reset every review option to Yes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const next = applyProfileDefaults(emptyS506());
            setForm(next);
            await AsyncStorage.removeItem(jobStorageKey(STORAGE_KEY, activeJob));
            await onFormStatusChange?.('s506', 'none');
          },
        },
      ],
    );
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await AsyncStorage.setItem(
        jobStorageKey(STORAGE_KEY, activeJob),
        JSON.stringify(form),
      );
      const result = await exportOperationalPdf(
        form,
        's506',
        () => setExporting(false),
      );
      if (result?.exported) {
        await onFormStatusChange?.('s506', 'complete', { date: form.date });
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="S-506 REV3"
        title="Journey Management"
        subtitle="Plan and record long-distance travel"
        onBack={goBack}
        backLabel={backLabel}
        showTopo
        compact
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <CurrentJobCard job={activeJob || form.jobSnapshot} />

        <Pressable
          style={({ pressed }) => [
            styles.infoButton,
            pressed && localStyles.pressed,
          ]}
          onPress={() => setGuidance(true)}
          accessibilityRole="button"
          accessibilityLabel="Open journey guidance"
        >
          <View>
            <Text style={styles.infoButtonTitle}>Journey Guidance</Text>
            <Text style={styles.infoButtonHint}>
              When a plan is required and what to arrange
            </Text>
          </View>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </Pressable>

        <FormSection
          title="Journey Details"
          hint="Complete before departure. Tap Date to use today."
        >
          <Pressable onPress={() => set('date', today())}>
            <View pointerEvents="none">
              <FormInput
                label="Date"
                value={form.date}
                onChangeText={(value) => set('date', value)}
                placeholder="Tap to use today"
              />
            </View>
          </Pressable>
          <FormInput
            label="Vehicle Registration"
            value={form.vehicleRegistration}
            onChangeText={(value) => set('vehicleRegistration', value.toUpperCase())}
            placeholder="Registration"
            autoCapitalize="characters"
          />
          <FormInput
            label="Job Number"
            value={form.jobNumber}
            onChangeText={(value) => set('jobNumber', value.toUpperCase())}
            placeholder="Job number"
          />
          <FormInput
            label="Driver(s)"
            value={form.drivers}
            onChangeText={(value) => set('drivers', value)}
            placeholder="Driver names"
          />
          <FormInput
            label="Buddy Contact"
            value={form.buddyContact}
            onChangeText={(value) => set('buddyContact', value)}
            placeholder="Name and phone number"
          />
          <FormInput
            label="Purpose of Travel"
            value={form.purpose}
            onChangeText={(value) => set('purpose', value)}
            placeholder="Purpose"
          />
          <FormInput
            label="Kilometres - One Way"
            value={form.kilometresOneWay}
            onChangeText={(value) => set('kilometresOneWay', value)}
            placeholder="Distance"
            keyboardType="numeric"
          />
          <FormInput
            label="Destination"
            value={form.destination}
            onChangeText={(value) => set('destination', value)}
            placeholder="Destination"
          />
          <FormInput
            label="Driver + Passenger Initials"
            value={form.travellers}
            onChangeText={(value) => set('travellers', value.toUpperCase())}
            placeholder="Initials"
            autoCapitalize="characters"
          />
          <FormInput
            label="Departure From"
            value={form.departureFrom}
            onChangeText={(value) => set('departureFrom', value)}
            placeholder="Starting location"
          />
          <FormInput
            label="Expected Departure Time"
            value={form.expectedDepartureTime}
            onChangeText={(value) => set('expectedDepartureTime', value)}
            placeholder="e.g. 06:30"
          />
          <FormInput
            label="Expected Arrival Time"
            value={form.expectedArrivalTime}
            onChangeText={(value) => set('expectedArrivalTime', value)}
            placeholder="e.g. 09:00"
          />
        </FormSection>

        <AppSectionHeader
          title="Journey Review"
          subtitle="Options begin as Yes. Check each response and change it where required."
          style={styles.standaloneSection}
        />

        {S506_RISK_ITEMS.map((item) => {
          const response = form.risks[item];
          const needsAttention = response === 'No';
          return (
            <View
              style={[
                styles.checklistItem,
                needsAttention && styles.issueChecklistItem,
              ]}
              key={item}
            >
              <Text style={styles.checklistTitle}>{item}</Text>
              <ChoiceRow
                value={response}
                options={['Yes', 'No', 'N/A']}
                onChange={(value) => setRisk(item, value)}
                accessibilityLabel={item}
              />
            </View>
          );
        })}

        <FormSection
          title="Other Conditions"
          hint="Record weather, health, contact or response arrangements that need attention."
        >
          <FormInput
            label="Other / Arrangements"
            value={form.other}
            onChangeText={(value) => set('other', value)}
            placeholder="Additional information"
            multiline
          />
          <View style={styles.buttonRow}>
            <View style={styles.half}>
              <PrimaryButton label="Save Draft" onPress={save} />
            </View>
            <View style={styles.half}>
              <PrimaryButton label="Clear" danger onPress={clear} />
            </View>
          </View>
          <PrimaryButton label="Export Completed PDF" onPress={exportPdf} />
        </FormSection>
      </ScrollView>

      <Modal
        visible={guidance}
        transparent
        animationType="fade"
        onRequestClose={() => setGuidance(false)}
      >
        <View style={localStyles.modalShade}>
          <View style={localStyles.modalCard}>
            <View style={localStyles.modalHandle} />
            <Text style={localStyles.modalEyebrow}>S-506 REV3</Text>
            <Text style={localStyles.modalTitle}>Journey Guidance</Text>
            <ScrollView
              style={localStyles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={localStyles.modalIntro}>
                A Journey Management Plan is required when travelling more than
                150 km from or to the normal place of work.
              </Text>
              {GUIDANCE_ITEMS.map((line) => (
                <View key={line} style={localStyles.guidanceRow}>
                  <View style={localStyles.guidanceTick}>
                    <Text style={localStyles.guidanceTickText}>✓</Text>
                  </View>
                  <Text style={localStyles.guidanceText}>{line}</Text>
                </View>
              ))}
            </ScrollView>
            <PrimaryButton
              label="Close Guidance"
              onPress={() => setGuidance(false)}
            />
          </View>
        </View>
      </Modal>

      {exporting ? <LoadingOverlay text="Preparing PDF…" /> : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  pressed: {
    opacity: 0.78,
  },
  modalShade: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: colors.scrim,
  },
  modalCard: {
    maxHeight: '84%',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  modalHandle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.borderStrong,
  },
  modalEyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  modalTitle: {
    color: colors.bodyText,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 3,
  },
  modalScroll: {
    marginVertical: SPACING.lg,
  },
  modalIntro: {
    color: colors.supportingText,
    fontSize: 13,
    lineHeight: 20,
  },
  guidanceRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  guidanceTick: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderRadius: 12,
    backgroundColor: colors.warningBackground,
  },
  guidanceTickText: {
    color: colors.accentDark,
    fontWeight: '900',
  },
  guidanceText: {
    flex: 1,
    color: colors.bodyText,
    fontSize: 12,
    lineHeight: 19,
  },
});
