import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import styles from '../styles/styles';
import {
  Field,
  HazardBlock,
} from '../components/FormFields';
import CollapseSection from '../components/CollapseSection';
import { S500_PPE_ITEMS } from '../constants/s500PpeItems';
import {
  S500_BASE_HAZARD_COUNT,
  S500_HAZARD_ROWS,
  S500_MAX_HAZARD_COUNT,
} from '../constants/s500HazardRows';
import { S500_ACTIVITY_PRESETS } from '../constants/s500ActivityPresets';
import PpeToggleRow from '../components/PpeToggleRow';
import SwipeDeleteRow from '../components/SwipeDeleteRow';
import NorthGroupBrandButton from '../components/NorthGroupBrandButton';
import FormActionBar from '../components/FormActionBar';
import LoadingOverlay from '../components/LoadingOverlay';
import {
  applyProfileDefaults,
  profileFullName,
  profileInitials,
} from '../features/account/accountProfile';
import { prepareS500Pdf } from '../export/exportS500Pdf';

const getTodayDate = () => {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  return `${day}/${month}/${year}`;
};

const isHazardPopulated = (form, row) => !!(
  String(form[row.hazardKey] || '').trim() ||
  String(form[row.controlKey] || '').trim() ||
  form[row.pKey] || form[row.cKey] || form[row.rKey]
);

const YesNoSelector = ({ label, value, onChange, disabled = false }) => (
  <View style={[s500UiStyles.selectorGroup, disabled && s500UiStyles.selectorGroupDisabled]}>
    <Text style={s500UiStyles.controlLabel}>{label}</Text>
    <View style={s500UiStyles.selectorRow}>
      {[
        { label: 'YES', value: true },
        { label: 'NO', value: false },
      ].map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            style={[
              s500UiStyles.selectorButton,
              selected && s500UiStyles.selectorButtonSelected,
            ]}
          >
            <Text
              style={[
                s500UiStyles.selectorButtonText,
                selected && s500UiStyles.selectorButtonTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export default function S500FormScreen({
  s500,
  setS500,
  saveS500,
  clearS500,
  exportS500Pdf,
  emailS500Pdf,
  setScreen,
  openJobFiles,
  onFormStatusChange,
  accountProfile,
  activeJob,
  backLabel = 'Forms',
  goBack,
}) {
  const insets = useSafeAreaInsets();
  const [showHazards, setShowHazards] = useState(false);
  const [showPpe, setShowPpe] = useState(false);
  const [showActivityOptions, setShowActivityOptions] = useState(false);
  const [hazardDeleteOpen, setHazardDeleteOpen] = useState(false);
  const [focusedHazardNumber, setFocusedHazardNumber] = useState(null);
  const [guidedSection, setGuidedSection] = useState(null);
  const [preparingUpload, setPreparingUpload] = useState(false);
  const scrollRef = useRef(null);
  const sectionY = useRef({ date: 0, wms: 0, activity: 0, hazards: 0, ppe: 0 });
  const hazardRowY = useRef({});
  const pendingHazardScroll = useRef(null);
  const guidedClearTimer = useRef(null);

  const deletedHazardRows = Array.isArray(s500.deletedHazardRows) ? s500.deletedHazardRows : [];
  const customPpeItems = Array.isArray(s500.customPpeItems) ? s500.customPpeItems : [];
  const highestUsedHazard = S500_HAZARD_ROWS.reduce((highest, row, index) => (
    isHazardPopulated(s500, row) ? index + 1 : highest
  ), 0);
  const visibleHazardCount = Math.min(
    S500_MAX_HAZARD_COUNT,
    Math.max(
      S500_BASE_HAZARD_COUNT,
      Number(s500.hazardRowCount) || 0,
      highestUsedHazard
    )
  );
  const visibleHazardRows = S500_HAZARD_ROWS
    .slice(0, visibleHazardCount)
    .filter((row) => !deletedHazardRows.includes(row.number));
  const filledHazards = visibleHazardRows.filter((row) => isHazardPopulated(s500, row)).length;
  const visiblePpeItems = S500_PPE_ITEMS;
  const selectedPpe = visiblePpeItems.filter((item) => !!s500[item.key]).length +
    customPpeItems.filter((item) => item.selected && String(item.label || '').trim()).length;

  useEffect(() => {
    if (!accountProfile) return;
    setS500((current) => applyProfileDefaults(current, accountProfile, 's500', activeJob));
  }, [accountProfile, activeJob, setS500]);

  useEffect(() => () => {
    if (guidedClearTimer.current) clearTimeout(guidedClearTimer.current);
  }, []);

  const setDateToToday = () => {
    setS500({
      ...s500,
      date: getTodayDate(),
    });
    snapToSection('wms');
  };

  const handleDateChange = (value) => {
    setS500({
      ...s500,
      date: value,
    });

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(value || '').trim())) {
      snapToSection('wms');
    }
  };

  const markGuidedSection = (section) => {
    setGuidedSection(section);
    if (guidedClearTimer.current) clearTimeout(guidedClearTimer.current);
    guidedClearTimer.current = setTimeout(() => {
      setGuidedSection(null);
    }, 1200);
  };

  const updateWmsRequired = (value) => {
    setS500({
      ...s500,
      wmsRequired: value,
      wmsSigned: value ? s500.wmsSigned : null,
    });

    if (value === false || (value === true && (s500.wmsSigned === true || s500.wmsSigned === false))) {
      setTimeout(() => openActivityStep(), 120);
    } else {
      snapToSection('wms');
    }
  };

  const updateWmsSigned = (value) => {
    if (s500.wmsRequired !== true) return;

    setS500({
      ...s500,
      wmsSigned: value,
    });
    setTimeout(() => openActivityStep(), 120);
  };

  const openActivityStep = () => {
    setShowActivityOptions(true);
    snapToSection('activity');
  };

  const applyActivityPreset = (preset) => {
    const updatedForm = {
      ...s500,
      activity: preset.label,
      wmsRequired: s500.wmsRequired,
      wmsSigned: s500.wmsSigned,
      hazardRowCount: S500_BASE_HAZARD_COUNT,
      deletedHazardRows: [],
    };

    S500_HAZARD_ROWS.forEach((row, index) => {
      const hazard = preset.hazards[index];

      updatedForm[row.hazardKey] = hazard ? hazard.hazard : '';
      updatedForm[row.controlKey] = hazard ? hazard.control : '';
      updatedForm[row.pKey] = '';
      updatedForm[row.cKey] = '';
      updatedForm[row.rKey] = '';
      updatedForm[row.includeKey] = null;
    });

    setS500(updatedForm);
    setShowActivityOptions(false);
    setShowHazards(true);

    const firstPresetRow = S500_HAZARD_ROWS.find((row, index) => preset.hazards[index]);
    if (firstPresetRow) {
      setFocusedHazardNumber(firstPresetRow.number);
      pendingHazardScroll.current = firstPresetRow.number;
      markGuidedSection('hazards');
      setTimeout(() => {
        const rowPosition = hazardRowY.current[firstPresetRow.number];
        if (typeof rowPosition === 'number') {
          scrollToY(sectionY.current.hazards + 86 + rowPosition);
          pendingHazardScroll.current = null;
        } else {
          scrollToY(sectionY.current.hazards);
        }
      }, 120);
    } else {
      scrollToY(sectionY.current.hazards);
    }
  };

  const addHazardRow = () => {
    if (deletedHazardRows.length) {
      const [restoreNumber, ...remainingDeleted] = deletedHazardRows;
      setS500((current) => ({ ...current, deletedHazardRows: remainingDeleted }));
      return;
    }

    if (visibleHazardCount >= S500_MAX_HAZARD_COUNT) return;

    setS500((current) => ({
      ...current,
      hazardRowCount: visibleHazardCount + 1,
    }));
  };

  const deleteHazardRow = (row) => {
    setS500((current) => ({
      ...current,
      [row.hazardKey]: '',
      [row.controlKey]: '',
      [row.pKey]: '',
      [row.cKey]: '',
      [row.rKey]: '',
      [row.includeKey]: null,
      deletedHazardRows: Array.from(new Set([
        ...(Array.isArray(current.deletedHazardRows) ? current.deletedHazardRows : []),
        row.number,
      ])),
    }));
  };

  const addCustomPpe = () => {
    if (customPpeItems.length >= 5) return;

    setS500((current) => ({
      ...current,
      customPpeItems: [
        ...(Array.isArray(current.customPpeItems) ? current.customPpeItems : []),
        { id: `custom-ppe-${Date.now()}`, label: '', selected: true },
      ],
    }));
  };

  const updateCustomPpe = (id, values) => {
    setS500((current) => ({
      ...current,
      customPpeItems: (Array.isArray(current.customPpeItems) ? current.customPpeItems : [])
        .map((item) => (item.id === id ? { ...item, ...values } : item)),
    }));
  };

  const populatedHazards = visibleHazardRows.filter((row) => isHazardPopulated(s500, row));
  const pendingHazardDecisions = populatedHazards.filter((row) => s500[row.includeKey] !== true && s500[row.includeKey] !== false);
  const incompleteYesHazards = populatedHazards.filter((row) => (
    s500[row.includeKey] === true && (
      !String(s500[row.hazardKey] || '').trim() ||
      !String(s500[row.controlKey] || '').trim() ||
      !s500[row.pKey] ||
      !s500[row.cKey] ||
      !s500[row.rKey]
    )
  ));
  const firstPendingHazard = pendingHazardDecisions[0];
  const firstIncompleteYesHazard = incompleteYesHazards[0];

  const completionIssue = !s500.date
    ? { message: 'Set the form date before exporting.', section: 'date' }
    : !s500.jobNumber
      ? { message: 'Select a job number before exporting.', section: 'top' }
      : s500.wmsRequired !== true && s500.wmsRequired !== false
        ? { message: 'Select YES or NO for WMS Required before exporting.', section: 'wms' }
        : s500.wmsRequired === true && s500.wmsSigned !== true && s500.wmsSigned !== false
          ? { message: 'Select YES or NO for WMS Signed before exporting.', section: 'wms' }
          : !s500.activity
            ? { message: 'Select an activity before exporting.', section: 'activity' }
            : populatedHazards.length === 0
              ? { message: 'Add or select an activity with hazards before exporting.', section: 'hazards' }
              : pendingHazardDecisions.length > 0
                ? { message: `Select YES or NO for every hazard. ${pendingHazardDecisions.length} hazard${pendingHazardDecisions.length === 1 ? '' : 's'} still need review.`, section: 'hazards', hazardNumber: firstPendingHazard?.number }
                : incompleteYesHazards.length > 0
                  ? { message: `Complete the hazard, control measure and PCR for every YES hazard. ${incompleteYesHazards.length} hazard${incompleteYesHazards.length === 1 ? '' : 's'} still need attention.`, section: 'hazards', hazardNumber: firstIncompleteYesHazard?.number }
                  : selectedPpe === 0
                    ? { message: 'Select at least one required PPE item before exporting.', section: 'ppe' }
                    : !profileFullName(accountProfile)
                      ? { message: 'A signed-in user name is required before exporting.', section: 'top' }
                      : null;

  const formComplete = !completionIssue;
  const setupComplete = !!(
    s500.date &&
    s500.jobNumber &&
    (s500.wmsRequired === true || s500.wmsRequired === false) &&
    (s500.wmsRequired !== true || s500.wmsSigned === true || s500.wmsSigned === false) &&
    s500.activity
  );
  const hazardsComplete = populatedHazards.length > 0 && pendingHazardDecisions.length === 0 && incompleteYesHazards.length === 0;
  const ppeComplete = selectedPpe > 0;
  const displayJob = activeJob || s500.jobSnapshot || { number: s500.jobNumber };

  const scrollToY = (y) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 14), animated: true });
    }, 180);
  };

  const snapToSection = (section, extraOffset = 0) => {
    markGuidedSection(section);
    const sectionPosition = section === 'date'
      ? sectionY.current.date
      : sectionY.current[section] || 0;
    scrollToY(sectionPosition + extraOffset);
  };

  const scrollToHazard = (hazardNumber) => {
    markGuidedSection('hazards');
    if (!hazardNumber) {
      setShowHazards(true);
      scrollToY(sectionY.current.hazards);
      return;
    }

    setFocusedHazardNumber(null);
    setTimeout(() => setFocusedHazardNumber(hazardNumber), 0);
    pendingHazardScroll.current = hazardNumber;
    setShowHazards(true);

    const rowPosition = hazardRowY.current[hazardNumber];
    if (typeof rowPosition === 'number') {
      scrollToY(sectionY.current.hazards + 86 + rowPosition);
      pendingHazardScroll.current = null;
    }
  };

  const nextHazardNeedingReview = (currentNumber, form) => {
    const currentIndex = visibleHazardRows.findIndex((row) => row.number === currentNumber);
    if (currentIndex < 0) return null;

    return visibleHazardRows.slice(currentIndex + 1).find((row) => {
      if (!isHazardPopulated(form, row)) return false;

      const decision = form[row.includeKey];
      if (decision !== true && decision !== false) return true;

      return decision === true && (
        !String(form[row.hazardKey] || '').trim() ||
        !String(form[row.controlKey] || '').trim() ||
        !form[row.pKey] ||
        !form[row.cKey] ||
        !form[row.rKey]
      );
    }) || null;
  };

  const scrollToNextHazard = (hazardNumber) => {
    if (!hazardNumber) return;

    markGuidedSection('hazards');
    setFocusedHazardNumber(null);
    pendingHazardScroll.current = hazardNumber;
    setShowHazards(true);

    setTimeout(() => {
      const rowPosition = hazardRowY.current[hazardNumber];
      if (typeof rowPosition === 'number') {
        scrollToY(sectionY.current.hazards + 86 + rowPosition);
        pendingHazardScroll.current = null;
      }
    }, 0);
  };

  const handleHazardComplete = ({ number, data }) => {
    const nextHazard = nextHazardNeedingReview(number, data);
    if (nextHazard) {
      scrollToNextHazard(nextHazard.number);
      return;
    }

    const hasOutstandingHazard = visibleHazardRows.some((row) => {
      if (!isHazardPopulated(data, row)) return false;

      const decision = data[row.includeKey];
      return decision !== true && decision !== false || (
        decision === true && (
          !String(data[row.hazardKey] || '').trim() ||
          !String(data[row.controlKey] || '').trim() ||
          !data[row.pKey] ||
          !data[row.cKey] ||
          !data[row.rKey]
        )
      );
    });

    if (!hasOutstandingHazard && selectedPpe === 0) {
      setShowHazards(false);
      setShowPpe(true);
      setTimeout(() => snapToSection('ppe'), 120);
    }
  };

  const handleHazardOpen = ({ number }) => {
    scrollToHazard(number);
  };

  const snapToNextIncomplete = () => {
    if (!s500.date) {
      snapToSection('date');
      return;
    }

    if (s500.wmsRequired !== true && s500.wmsRequired !== false) {
      snapToSection('wms');
      return;
    }

    if (s500.wmsRequired === true && s500.wmsSigned !== true && s500.wmsSigned !== false) {
      snapToSection('wms');
      return;
    }

    if (!s500.activity) {
      openActivityStep();
      return;
    }

    if (populatedHazards.length === 0) {
      setShowHazards(true);
      snapToSection('hazards');
      return;
    }

    if (firstPendingHazard) {
      scrollToHazard(firstPendingHazard.number);
      return;
    }

    if (firstIncompleteYesHazard) {
      scrollToHazard(firstIncompleteYesHazard.number);
      return;
    }

    if (selectedPpe === 0) {
      setShowPpe(true);
      snapToSection('ppe');
    }
  };

  const showCompletionIssue = (showAlert = true) => {
    if (!completionIssue) return true;

    if (completionIssue.section === 'date') {
      snapToSection('date');
    } else if (completionIssue.section === 'activity') {
      openActivityStep();
    } else if (completionIssue.section === 'hazards') {
      scrollToHazard(completionIssue.hazardNumber);
    } else if (completionIssue.section === 'ppe') {
      setShowPpe(true);
      snapToSection('ppe');
    } else if (completionIssue.section === 'wms') {
      snapToSection('wms');
    } else {
      snapToSection('date');
    }

    if (showAlert) alert(completionIssue.message);
    return false;
  };

  const exportValidated = () => { if (showCompletionIssue()) exportS500Pdf(); };
  const emailValidated = () => { if (showCompletionIssue()) emailS500Pdf(); };

  const uploadValidated = async () => {
    if (!showCompletionIssue() || preparingUpload) return;

    setPreparingUpload(true);
    try {
      const result = await prepareS500Pdf(s500, profileInitials(accountProfile));
      if (!result?.exportUri) return;

      await onFormStatusChange?.('s500', 'complete', { date: s500.date });
      openJobFiles?.({
        formLabel: 'S-500 Pre-Start Risk Assessment',
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
    <ImageBackground
      source={require('../../assets/topo-bg-vertical.png')}
      style={styles.container}
      imageStyle={s500UiStyles.pageTopoImage}
    >
      <View pointerEvents="none" style={s500UiStyles.pageShade} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View
        style={[s500UiStyles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View pointerEvents="none" style={s500UiStyles.heroShade} />
        <View style={s500UiStyles.heroTopRow}>
          <NorthGroupBrandButton
            onPress={goBack}
            style={s500UiStyles.heroButton}
            accessibilityLabel={`NorthGroup One, return to ${backLabel}`}
            accessibilityHint={`Returns to ${backLabel}`}
          />
          <Text style={s500UiStyles.heroCode}>S-500</Text>
          <TouchableOpacity
            onPress={clearS500}
            activeOpacity={0.76}
            accessibilityRole="button"
            accessibilityLabel="Clear Pre-Start form"
            style={[s500UiStyles.heroButton, s500UiStyles.heroButtonRight]}
          >
            <Text style={s500UiStyles.heroClearText}>Clear</Text>
          </TouchableOpacity>
        </View>
        <View style={s500UiStyles.heroTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s500UiStyles.heroEyebrow}>FIELD SAFETY</Text>
            <Text style={s500UiStyles.heroTitle}>Pre-Start Risk Assessment</Text>
          </View>
          <View style={[s500UiStyles.statusPill, formComplete ? s500UiStyles.statusPillComplete : s500UiStyles.statusPillIncomplete]}>
            <View style={[s500UiStyles.statusDot, { backgroundColor: formComplete ? '#42C878' : '#E75858' }]} />
            <Text style={s500UiStyles.statusText}>{formComplete ? 'COMPLETE' : 'INCOMPLETE'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s500UiStyles.jobBanner}
          onPress={snapToNextIncomplete}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel="Go to the next incomplete Pre-Start item"
        >
          <View style={s500UiStyles.jobRule} />
          <View style={{ flex: 1 }}>
            <Text style={s500UiStyles.jobLabel}>CURRENT JOB</Text>
            <Text style={s500UiStyles.jobNumber}>{displayJob?.number || 'No job selected'}</Text>
            {displayJob?.name ? <Text style={s500UiStyles.jobName} numberOfLines={1}>{displayJob.name}</Text> : null}
          </View>
          <View style={s500UiStyles.jobLock}>
            <Ionicons name="checkmark" size={18} color="#D6A84F" />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, s500UiStyles.scroll]}
        contentContainerStyle={[
          styles.scrollContent,
          s500UiStyles.scrollContent,
          { paddingBottom: Math.max(60, insets.bottom + 32) },
        ]}
        scrollEnabled={!hazardDeleteOpen}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View
          onLayout={({ nativeEvent }) => { sectionY.current.date = nativeEvent.layout.y; }}
          style={[
            s500UiStyles.setupRow,
            guidedSection === 'date' && s500UiStyles.guidedTarget,
          ]}
        >
          <View style={s500UiStyles.dateColumn}>
            {s500.date ? (
              <Field
                label="Date"
                value={s500.date}
                onChangeText={handleDateChange}
                placeholder="DD/MM/YYYY"
                containerStyle={s500UiStyles.dateFieldWrap}
                labelStyle={s500UiStyles.controlLabel}
                inputStyle={s500UiStyles.dateInput}
              />
            ) : (
              <TouchableOpacity onPress={setDateToToday} activeOpacity={0.8}>
                <View pointerEvents="none">
                  <Field
                    label="Date"
                    value={s500.date}
                    onChangeText={handleDateChange}
                    placeholder="Set today"
                    containerStyle={s500UiStyles.dateFieldWrap}
                    labelStyle={s500UiStyles.controlLabel}
                    inputStyle={s500UiStyles.dateInput}
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={s500UiStyles.matrixButton}
            onPress={() => setScreen('s500RiskGuide')}
            activeOpacity={0.82}
          >
            <View style={s500UiStyles.matrixIcon}>
              <Ionicons name="grid-outline" size={20} color="#061A2D" />
            </View>
            <View style={s500UiStyles.matrixCopy}>
              <Text style={s500UiStyles.matrixEyebrow}>RISK REFERENCE</Text>
              <Text style={s500UiStyles.matrixTitle}>VIEW RISK MATRIX</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#061A2D" />
          </TouchableOpacity>
        </View>

        <View style={s500UiStyles.progressRow}>
          {[
            { label: 'SETUP', complete: setupComplete },
            { label: 'HAZARDS', complete: hazardsComplete, onPress: () => scrollToHazard() },
            { label: 'PPE', complete: ppeComplete, onPress: () => { setShowPpe(true); scrollToY(sectionY.current.ppe); } },
            { label: 'READY', complete: formComplete, onPress: () => showCompletionIssue(false) },
          ].map((step, index) => (
            <TouchableOpacity key={step.label} disabled={!step.onPress} onPress={step.onPress} style={s500UiStyles.progressStep}>
              <View style={[s500UiStyles.progressDot, step.complete && s500UiStyles.progressDotComplete]}>
                {step.complete ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={s500UiStyles.progressDotText}>{index + 1}</Text>
                )}
              </View>
              <Text style={[s500UiStyles.progressLabel, step.complete && s500UiStyles.progressLabelComplete]}>{step.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          onLayout={({ nativeEvent }) => { sectionY.current.wms = nativeEvent.layout.y; }}
          style={[
            s500UiStyles.wmsRow,
            guidedSection === 'wms' && s500UiStyles.guidedTarget,
          ]}
        >
          <YesNoSelector label="WMS Required" value={s500.wmsRequired} onChange={updateWmsRequired} />
          <YesNoSelector label="WMS Signed" value={s500.wmsSigned} onChange={updateWmsSigned} disabled={s500.wmsRequired !== true} />
        </View>

        <View
          onLayout={({ nativeEvent }) => { sectionY.current.activity = nativeEvent.layout.y; }}
          style={guidedSection === 'activity' && s500UiStyles.guidedTarget}
        >
          <Text style={s500UiStyles.controlLabel}>Activity</Text>

          <TouchableOpacity
            style={[styles.dropdownButton, s500UiStyles.activityButton]}
            onPress={() => setShowActivityOptions(!showActivityOptions)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ expanded: showActivityOptions }}
          >
            <Text style={[styles.dropdownButtonText, s500UiStyles.activityButtonText]}>
              {s500.activity || 'Select activity'}
            </Text>

            <Ionicons
              name={showActivityOptions ? 'chevron-up' : 'chevron-down'}
              size={21}
              color="#D6A84F"
            />
          </TouchableOpacity>

          {showActivityOptions && (
            <View style={[styles.dropdownList, s500UiStyles.activityList]}>
              {S500_ACTIVITY_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.dropdownItem, s500UiStyles.activityItem]}
                  onPress={() => applyActivityPreset(preset)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownItemText, s500UiStyles.activityItemText]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>


        <View
          onLayout={({ nativeEvent }) => { sectionY.current.hazards = nativeEvent.layout.y; }}
          style={guidedSection === 'hazards' && s500UiStyles.guidedTarget}
        >
          <CollapseSection
            title="Hazards & Controls"
            subtitle={`${filledHazards} of ${visibleHazardCount} hazard rows filled`}
            open={showHazards}
            tone="dark"
            onToggle={() => {
              setShowHazards(!showHazards);
              if (showHazards) setFocusedHazardNumber(null);
            }}
          >
          {visibleHazardRows.map((row) => (
            <View
              key={row.number}
              onLayout={({ nativeEvent }) => {
                hazardRowY.current[row.number] = nativeEvent.layout.y;
                if (pendingHazardScroll.current === row.number) {
                  scrollToY(sectionY.current.hazards + 86 + nativeEvent.layout.y);
                  pendingHazardScroll.current = null;
                }
              }}
            >
              <SwipeDeleteRow
                onDelete={() => deleteHazardRow(row)}
                onOpenChange={setHazardDeleteOpen}
              >
                <HazardBlock
                  number={row.number}
                  data={s500}
                  setData={setS500}
                  hazardKey={row.hazardKey}
                  controlKey={row.controlKey}
                  pKey={row.pKey}
                  cKey={row.cKey}
                  rKey={row.rKey}
                  includeKey={row.includeKey}
                  initiallyOpen={Number(row.number) > S500_BASE_HAZARD_COUNT && Number(row.number) === visibleHazardCount && !isHazardPopulated(s500, row)}
                  forceOpen={focusedHazardNumber === row.number}
                  onComplete={handleHazardComplete}
                  onOpen={handleHazardOpen}
                  onOpenRiskMatrix={() => setScreen('s500RiskGuide')}
                />
              </SwipeDeleteRow>
            </View>
          ))}

          {deletedHazardRows.length || visibleHazardCount < S500_MAX_HAZARD_COUNT ? (
            <TouchableOpacity
              accessibilityLabel="Add another hazard"
              onPress={addHazardRow}
              activeOpacity={0.8}
              style={s500UiStyles.addButton}
            >
              <Ionicons name="add" size={27} color="#061A2D" />
            </TouchableOpacity>
          ) : null}
          </CollapseSection>
        </View>

        <View
          onLayout={({ nativeEvent }) => { sectionY.current.ppe = nativeEvent.layout.y; }}
          style={guidedSection === 'ppe' && s500UiStyles.guidedTarget}
        >
          <CollapseSection
            title="Select PPE Required"
            subtitle={`${selectedPpe} PPE items selected`}
            open={showPpe}
            tone="dark"
            onToggle={() => setShowPpe(!showPpe)}
          >
          <View style={styles.ppeGrid}>
            {visiblePpeItems.map((item) => (
              <PpeToggleRow
                key={item.key}
                label={item.label}
                value={!!s500[item.key]}
                compact
                onValueChange={(v) =>
                  setS500({
                    ...s500,
                    [item.key]: v,
                  })
                }
              />
            ))}

            {customPpeItems.map((item, index) => (
              <PpeToggleRow
                key={item.id}
                label={item.label}
                value={!!item.selected}
                compact
                editableLabel
                autoFocus={index === customPpeItems.length - 1 && !item.label}
                onLabelChange={(label) => updateCustomPpe(item.id, { label })}
                onValueChange={(selected) => updateCustomPpe(item.id, { selected })}
              />
            ))}
          </View>

          {customPpeItems.length < 5 ? (
            <TouchableOpacity
              accessibilityLabel="Add another PPE item"
              onPress={addCustomPpe}
              activeOpacity={0.8}
              style={s500UiStyles.addButton}
            >
              <Ionicons name="add" size={27} color="#061A2D" />
            </TouchableOpacity>
          ) : null}
          </CollapseSection>
        </View>

        {!formComplete ? (
          <TouchableOpacity
            onPress={() => showCompletionIssue(false)}
            activeOpacity={0.85}
            style={s500UiStyles.completionNotice}
          >
            <Text style={s500UiStyles.completionNoticeTitle}>Form not ready to export</Text>
            <Text style={s500UiStyles.completionNoticeText}>{completionIssue.message}</Text>
          </TouchableOpacity>
        ) : null}

        <FormActionBar
          onSave={saveS500}
          onExport={exportValidated}
          onUpload={uploadValidated}
          onEmail={emailValidated}
          uploading={preparingUpload}
          subtitle="Save locally or send this assessment to SharePoint."
          variant="dark"
        />
      </ScrollView>
      {preparingUpload ? <LoadingOverlay text="Preparing form for SharePoint…" /> : null}
    </ImageBackground>
  );
}

const s500UiStyles = StyleSheet.create({
  pageTopoImage: {
    resizeMode: 'cover',
    opacity: 0.62,
  },
  pageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,26,45,0.78)',
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 15,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(214,168,79,0.16)',
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,26,45,0.22)',
  },
  heroTopRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroButton: {
    width: 136,
    minWidth: 136,
    height: 44,
    justifyContent: 'center',
  },
  heroButtonRight: {
    width: 60,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  heroClearText: { color: '#FF9292', fontSize: 14, fontWeight: '900' },
  heroCode: { color: '#D6A84F', fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 7 },
  heroEyebrow: { color: '#D6A84F', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 3,
    paddingRight: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    marginLeft: 8,
    marginBottom: 2,
  },
  statusPillComplete: { backgroundColor: 'rgba(36,139,79,0.28)', borderColor: 'rgba(66,200,120,0.72)' },
  statusPillIncomplete: { backgroundColor: 'rgba(170,55,55,0.28)', borderColor: 'rgba(231,88,88,0.72)' },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  jobBanner: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,35,60,0.94)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.48)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 13,
    overflow: 'hidden',
  },
  jobRule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#D6A84F' },
  jobLabel: { color: '#D6A84F', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  jobNumber: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 2 },
  jobName: { color: '#B8C4D0', fontSize: 10, marginTop: 2 },
  jobLock: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,168,79,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.22)',
  },
  scroll: { backgroundColor: 'transparent' },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  guidedTarget: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D6A84F',
    backgroundColor: 'rgba(214,168,79,0.08)',
    padding: 5,
    marginHorizontal: -5,
  },
  setupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 2 },
  dateColumn: { width: '38%', minWidth: 112 },
  dateFieldWrap: { marginBottom: 14 },
  controlLabel: {
    color: '#F4F8FB',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    marginBottom: 7,
  },
  dateInput: {
    minHeight: 56,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.42)',
    backgroundColor: '#F5F7F8',
    color: '#061A2D',
    fontSize: 16,
  },
  matrixButton: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D6A84F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6C477',
    paddingHorizontal: 11,
    marginBottom: 14,
  },
  matrixIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(6,26,45,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  matrixCopy: { flex: 1, minWidth: 0 },
  matrixEyebrow: { color: '#5A4317', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  matrixTitle: { color: '#061A2D', fontSize: 12, lineHeight: 15, fontWeight: '900', marginTop: 2 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9,35,60,0.95)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 12,
  },
  progressStep: { flex: 1, alignItems: 'center' },
  progressDot: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#213B51', borderWidth: 1, borderColor: '#526B7E' },
  progressDotComplete: { backgroundColor: '#2D9655', borderColor: '#64D28D' },
  progressDotText: { color: '#B8C4D0', fontSize: 10, fontWeight: '900' },
  progressLabel: { color: '#8EA2B2', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 5 },
  progressLabelComplete: { color: '#8DDEAA' },
  wmsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: 'rgba(9,35,60,0.95)',
  },
  selectorGroup: { flex: 1 },
  selectorGroupDisabled: { opacity: 0.46 },
  selectorRow: { flexDirection: 'row', gap: 7 },
  selectorButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  selectorButtonSelected: {
    borderColor: '#42C878',
    backgroundColor: 'rgba(45,150,85,0.27)',
  },
  selectorButtonText: { color: '#B8C4D0', fontWeight: '900', fontSize: 12 },
  selectorButtonTextSelected: { color: '#9BE7B5' },
  activityButton: {
    minHeight: 54,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderColor: 'rgba(214,168,79,0.5)',
    backgroundColor: 'rgba(9,35,60,0.96)',
  },
  activityButtonText: { color: '#F4F8FB', fontSize: 16, fontWeight: '800' },
  activityList: {
    borderRadius: 14,
    borderColor: 'rgba(214,168,79,0.42)',
    backgroundColor: 'rgba(9,35,60,0.98)',
    marginBottom: 2,
  },
  activityItem: { minHeight: 48, justifyContent: 'center', borderBottomColor: 'rgba(255,255,255,0.1)' },
  activityItemText: { color: '#F4F8FB', fontSize: 14 },
  addButton: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#D6A84F',
    borderWidth: 1,
    borderColor: '#F0CF83',
  },
  completionNotice: {
    backgroundColor: 'rgba(116,73,18,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(231,179,92,0.72)',
    borderRadius: 14,
    padding: 13,
    marginTop: 4,
    marginBottom: 10,
  },
  completionNoticeTitle: { color: '#FFE1A5', fontWeight: '900', marginBottom: 3 },
  completionNoticeText: { color: '#F7E8CA', lineHeight: 19 },
});
