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
import AppBackButton from '../components/AppBackButton';
import { applyProfileDefaults, profileFullName } from '../features/account/accountProfile';

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
  <View style={{ flex: 1, opacity: disabled ? 0.5 : 1 }}>
    <Text style={[styles.fieldLabel, { marginBottom: 7 }]}>{label}</Text>
    <View style={{ flexDirection: 'row', gap: 7 }}>
      {[
        { label: 'YES', value: true, colour: '#2D9655', background: '#DDF5E5' },
        { label: 'NO', value: false, colour: '#B54A4A', background: '#FBE3E3' },
      ].map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 42,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? option.colour : '#CAD3DA',
              backgroundColor: selected ? option.background : '#FFFFFF',
            }}
          >
            <Text style={{ color: selected ? option.colour : '#536674', fontWeight: '900', fontSize: 12 }}>
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
  accountProfile,
  activeJob,
  backLabel = 'Forms',
}) {
  const insets = useSafeAreaInsets();
  const [showHazards, setShowHazards] = useState(false);
  const [showPpe, setShowPpe] = useState(false);
  const [showActivityOptions, setShowActivityOptions] = useState(false);
  const [hazardDeleteOpen, setHazardDeleteOpen] = useState(false);
  const [focusedHazardNumber, setFocusedHazardNumber] = useState(null);
  const [guidedSection, setGuidedSection] = useState(null);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ImageBackground
        source={require('../../assets/topo-bg.png')}
        style={[s500UiStyles.hero, { paddingTop: insets.top + 8 }]}
        imageStyle={s500UiStyles.heroImage}
      >
        <View style={s500UiStyles.heroShade} />
        <View style={s500UiStyles.heroTopRow}>
          <AppBackButton label={backLabel} onPress={() => setScreen('formMenu')} style={s500UiStyles.heroButton} />
          <Text style={s500UiStyles.heroCode}>S-500</Text>
          <TouchableOpacity onPress={clearS500} style={[s500UiStyles.heroButton, s500UiStyles.heroButtonRight]}>
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
          <View style={s500UiStyles.jobLock}><Text style={s500UiStyles.jobLockText}>✓</Text></View>
        </TouchableOpacity>
      </ImageBackground>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!hazardDeleteOpen}
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
              />
            ) : (
              <TouchableOpacity onPress={setDateToToday} activeOpacity={0.8}>
                <View pointerEvents="none">
                  <Field
                    label="Date"
                    value={s500.date}
                    onChangeText={handleDateChange}
                    placeholder="Set today"
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
            <View style={s500UiStyles.matrixIcon}><Text style={s500UiStyles.matrixIconText}>▦</Text></View>
            <View style={{ flex: 1 }}><Text style={s500UiStyles.matrixEyebrow}>RISK REFERENCE</Text><Text style={s500UiStyles.matrixTitle}>VIEW RISK MATRIX</Text></View>
            <Text style={s500UiStyles.matrixArrow}>›</Text>
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
              <View style={[s500UiStyles.progressDot, step.complete && s500UiStyles.progressDotComplete]}><Text style={[s500UiStyles.progressDotText, step.complete && s500UiStyles.progressDotTextComplete]}>{step.complete ? '✓' : index + 1}</Text></View>
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
          <Text style={styles.fieldLabel}>Activity</Text>

          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowActivityOptions(!showActivityOptions)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownButtonText}>
              {s500.activity || 'Select activity'}
            </Text>

            <Text style={styles.dropdownArrow}>
              {showActivityOptions ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showActivityOptions && (
            <View style={styles.dropdownList}>
              {S500_ACTIVITY_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.dropdownItem}
                  onPress={() => applyActivityPreset(preset)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownItemText}>{preset.label}</Text>
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
                />
              </SwipeDeleteRow>
            </View>
          ))}

          {deletedHazardRows.length || visibleHazardCount < S500_MAX_HAZARD_COUNT ? (
            <TouchableOpacity
              accessibilityLabel="Add another hazard"
              onPress={addHazardRow}
              activeOpacity={0.8}
              style={{
                alignSelf: 'center',
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 14,
                marginBottom: 4,
                backgroundColor: '#D6A84F',
                borderWidth: 2,
                borderColor: '#F5D98D',
              }}
            >
              <Text style={{ color: '#061A2D', fontSize: 29, fontWeight: '700', lineHeight: 31 }}>+</Text>
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
            onToggle={() => setShowPpe(!showPpe)}
            headerStyle={styles.ppeCollapseHeader}
            titleStyle={styles.ppeCollapseTitle}
            subtitleStyle={styles.ppeCollapseSubtitle}
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
              style={{
                alignSelf: 'center',
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 14,
                marginBottom: 4,
                backgroundColor: '#D6A84F',
                borderWidth: 2,
                borderColor: '#F5D98D',
              }}
            >
              <Text style={{ color: '#061A2D', fontSize: 29, fontWeight: '700', lineHeight: 31 }}>+</Text>
            </TouchableOpacity>
          ) : null}
          </CollapseSection>
        </View>

        {!formComplete ? (
          <TouchableOpacity
            onPress={() => showCompletionIssue(false)}
            activeOpacity={0.85}
            style={{ backgroundColor: '#FFF4E5', borderWidth: 1, borderColor: '#E7B35C', borderRadius: 12, padding: 13, marginBottom: 12 }}
          >
            <Text style={{ color: '#8A5612', fontWeight: '900', marginBottom: 3 }}>Form not ready to export</Text>
            <Text style={{ color: '#704A1D', lineHeight: 19 }}>{completionIssue.message}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.saveButton} onPress={saveS500}>
          <Text style={styles.saveButtonText}>Save Form</Text>
        </TouchableOpacity>

        <View style={[styles.formActionRow, { marginTop: 10 }]}>
          <TouchableOpacity
            style={[styles.exportButton, styles.formActionButton, !formComplete && { backgroundColor: '#768590' }]}
            onPress={emailValidated}
          >
            <Text style={styles.exportButtonText}>{formComplete ? 'Email PDF' : '🔒 Email PDF'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportButton, styles.formActionButton, !formComplete && { backgroundColor: '#768590' }]}
            onPress={exportValidated}
          >
            <Text style={styles.exportButtonText}>{formComplete ? 'Export PDF' : '🔒 Export PDF'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s500UiStyles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, overflow: 'hidden' },
  heroImage: { resizeMode: 'cover', opacity: 0.72 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,26,45,0.69)' },
  heroTopRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroButton: { minWidth: 112, minHeight: 40, justifyContent: 'center' },
  heroButtonRight: { alignItems: 'flex-end' },
  heroButtonText: { color: '#D6A84F', fontSize: 14, fontWeight: '900' },
  heroClearText: { color: '#FF9999', fontSize: 14, fontWeight: '900' },
  heroCode: { color: '#D6A84F', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  heroEyebrow: { color: '#D6A84F', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', marginTop: 3, paddingRight: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1 },
  statusPillComplete: { backgroundColor: 'rgba(36,139,79,0.28)', borderColor: 'rgba(66,200,120,0.72)' },
  statusPillIncomplete: { backgroundColor: 'rgba(170,55,55,0.28)', borderColor: 'rgba(231,88,88,0.72)' },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  jobBanner: { minHeight: 68, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(9,35,60,0.92)', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(214,168,79,0.55)', paddingHorizontal: 14, paddingVertical: 10, marginTop: 15, overflow: 'hidden' },
  jobRule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#D6A84F' },
  jobLabel: { color: '#D6A84F', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  jobNumber: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 2 },
  jobName: { color: '#B8C4D0', fontSize: 10, marginTop: 2 },
  jobLock: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(214,168,79,0.15)' },
  jobLockText: { color: '#D6A84F', fontWeight: '900' },
  guidedTarget: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D6A84F',
    backgroundColor: 'rgba(214,168,79,0.08)',
    padding: 5,
    marginHorizontal: -5,
  },
  setupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 4 },
  wmsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 8 },
  dateColumn: { width: '38%' },
  matrixButton: { flex: 1, minHeight: 70, flexDirection: 'row', alignItems: 'center', backgroundColor: '#D6A84F', borderRadius: 13, paddingHorizontal: 12, marginBottom: 14 },
  matrixIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(6,26,45,0.13)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  matrixIconText: { color: '#061A2D', fontSize: 20, fontWeight: '900' },
  matrixEyebrow: { color: '#5A4317', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  matrixTitle: { color: '#061A2D', fontSize: 14, fontWeight: '900', marginTop: 2 },
  matrixArrow: { color: '#061A2D', fontSize: 28, fontWeight: '300' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#09233C', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 9, paddingVertical: 11, marginBottom: 16 },
  progressStep: { flex: 1, alignItems: 'center' },
  progressDot: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#263F54', borderWidth: 1, borderColor: '#567084' },
  progressDotComplete: { backgroundColor: '#D6A84F', borderColor: '#F0CF83' },
  progressDotText: { color: '#B8C4D0', fontSize: 10, fontWeight: '900' },
  progressDotTextComplete: { color: '#061A2D' },
  progressLabel: { color: '#8093A3', fontSize: 7, fontWeight: '900', letterSpacing: 0.5, marginTop: 5 },
  progressLabelComplete: { color: '#D6A84F' },
});
