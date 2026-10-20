import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppHeader from '../components/AppHeader';
import AppSectionHeader from '../components/AppSectionHeader';
import CurrentJobCard from '../components/CurrentJobCard';
import FormActionBar from '../components/FormActionBar';
import LoadingOverlay from '../components/LoadingOverlay';
import {
  ChoiceRow,
  FormInput,
  FormSection,
  useOperationalStyles,
} from '../components/OperationalFormComponents';
import { emptyS501 } from '../data/operationalForms';
import {
  exportOperationalPdf,
  prepareOperationalPdf,
} from '../export/exportOperationalPdf';
import {
  applyProfileDefaults as applyAccountProfileDefaults,
  profileInitials,
} from '../features/account/accountProfile';
import { jobStorageKey } from '../features/jobs/jobContext';
import { useTheme } from '../theme/ThemeContext';
import { operationalFormForToday, stampOperationalForm } from '../utils/dailyFormReset';

const STORAGE_KEY = 's501_form';
const today = () => new Date().toLocaleDateString('en-AU');

export default function S501FormScreen({
  goBack,
  profile,
  activeJob,
  onFormStatusChange,
  openJobFiles,
  backLabel = 'Forms',
}) {
  const { colors } = useTheme();
  const styles = useOperationalStyles();
  const [form, setForm] = useState(emptyS501());
  const [exporting, setExporting] = useState(false);
  const [preparingUpload, setPreparingUpload] = useState(false);

  const applyProfileDefaults = (current) => (
    profile
      ? applyAccountProfileDefaults(current, profile, 's501', activeJob)
      : current
  );

  useEffect(() => {
    AsyncStorage.getItem(jobStorageKey(STORAGE_KEY, activeJob))
      .then((saved) => {
        const parsed = saved ? { ...emptyS501(), ...JSON.parse(saved) } : null;
        const current = parsed && operationalFormForToday(parsed) ? parsed : emptyS501();
        if (parsed && !operationalFormForToday(parsed)) {
          AsyncStorage.removeItem(jobStorageKey(STORAGE_KEY, activeJob));
          onFormStatusChange?.('s501', 'none');
        }
        setForm(applyProfileDefaults(current));
      })
      .catch(() => {});
  }, [profile, activeJob]);

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateCheck = (index, patch) => {
    setForm((current) => ({
      ...current,
      checks: current.checks.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  };

  const save = async () => {
    const next = stampOperationalForm(applyProfileDefaults(form));
    setForm(next);
    await AsyncStorage.setItem(
      jobStorageKey(STORAGE_KEY, activeJob),
      JSON.stringify(next),
    );
    await onFormStatusChange?.('s501', 'draft', { date: next.date });
    Alert.alert('S-501 saved', `Saved under job ${activeJob?.number}.`);
  };

  const clear = () => {
    Alert.alert(
      'Clear S-501?',
      'This will reset every checklist item to OK.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const next = applyProfileDefaults(emptyS501());
            setForm(next);
            await AsyncStorage.removeItem(jobStorageKey(STORAGE_KEY, activeJob));
            await onFormStatusChange?.('s501', 'none');
          },
        },
      ],
    );
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const next = stampOperationalForm(applyProfileDefaults(form));
      setForm(next);
      await AsyncStorage.setItem(
        jobStorageKey(STORAGE_KEY, activeJob),
        JSON.stringify(next),
      );
      const result = await exportOperationalPdf(
        next,
        's501',
        () => setExporting(false),
        profileInitials(profile),
      );
      if (result?.exported) {
        await onFormStatusChange?.('s501', 'complete', { date: form.date });
      }
    } finally {
      setExporting(false);
    }
  };

  const uploadPdf = async () => {
    if (preparingUpload) return;

    setPreparingUpload(true);
    try {
      const next = stampOperationalForm(applyProfileDefaults(form));
      setForm(next);
      await AsyncStorage.setItem(
        jobStorageKey(STORAGE_KEY, activeJob),
        JSON.stringify(next),
      );
      const result = await prepareOperationalPdf(next, 's501', profileInitials(profile));
      if (!result?.exportUri) return;

      await onFormStatusChange?.('s501', 'complete', { date: form.date });
      openJobFiles?.({
        formLabel: 'S-501 Vehicle Pre-Start Checklist',
        pendingUpload: {
          uri: result.exportUri,
          name: result.exportName,
          mimeType: 'application/pdf',
        },
      });
    } finally {
      setPreparingUpload(false);
    }
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="S-501 REV3"
        title="Vehicle Pre-Start"
        subtitle="Light vehicle inspection checklist"
        onBack={goBack}
        backLabel={backLabel}
        showTopo
        compact
      />

      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <CurrentJobCard job={activeJob || form.jobSnapshot} />

        <FormSection
          title="Vehicle Details"
          hint="Tap Date to use today. Checklist items begin as OK and can be changed."
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
            label="Vehicle Make"
            value={form.vehicleMake}
            onChangeText={(value) => set('vehicleMake', value)}
            placeholder="Toyota, Mitsubishi, Ford, Nissan…"
          />
          <FormInput
            label="Registration"
            value={form.registration}
            onChangeText={(value) => set('registration', value.toUpperCase())}
            placeholder="Vehicle registration"
            autoCapitalize="characters"
          />
          <FormInput
            label="Odometer"
            value={form.odometer}
            onChangeText={(value) => set('odometer', value)}
            placeholder="Odometer reading"
            keyboardType="numeric"
          />
        </FormSection>

        <AppSectionHeader
          title="Before Start-Up"
          subtitle="Record any damaged or missing item before export."
          style={styles.standaloneSection}
        />

        {form.checks.map((item, index) => {
          const hasIssue = item.status && item.status !== 'OK';
          return (
            <View
              style={[
                styles.checklistItem,
                hasIssue && styles.issueChecklistItem,
              ]}
              key={item.id}
            >
              <Text style={styles.checklistTitle}>
                {index + 1}. {item.label}
              </Text>
              <ChoiceRow
                value={item.status}
                options={['OK', 'Damaged', 'Missing']}
                onChange={(status) => updateCheck(index, { status })}
                accessibilityLabel={item.label}
              />
              {hasIssue || item.remarks ? (
                <View style={{ marginTop: 10 }}>
                  <FormInput
                    label="Remarks / Fault"
                    value={item.remarks}
                    onChangeText={(remarks) => updateCheck(index, { remarks })}
                    placeholder="Describe the issue"
                    multiline
                  />
                </View>
              ) : null}
            </View>
          );
        })}

        <FormSection
          title="Completion"
          hint="Confirm who completed the vehicle inspection."
        >
          <FormInput
            label="Completed By"
            value={form.completedBy}
            onChangeText={(value) => set('completedBy', value)}
            placeholder="Full name"
          />
          <FormActionBar
            onSave={save}
            onClear={clear}
            onExport={exportPdf}
            onUpload={uploadPdf}
            uploading={preparingUpload}
            subtitle="Keep a draft, export the checklist, or save it to SharePoint."
          />
        </FormSection>
      </ScrollView>

      {exporting ? <LoadingOverlay text="Preparing PDF…" /> : null}
    </View>
  );
}
