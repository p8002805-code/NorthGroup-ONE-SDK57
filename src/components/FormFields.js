import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  Keyboard,
} from 'react-native';

import styles from '../styles/styles';

const getRiskColourStyle = (value) => {
  const risk = Number(value);

  if (!risk) {
    return {};
  }

  if (risk >= 1 && risk <= 6) {
    return {
      backgroundColor: '#92D050',
      borderColor: '#5A9A22',
    };
  }

  if (risk >= 7 && risk <= 9) {
    return {
      backgroundColor: '#FFFF00',
      borderColor: '#C9A800',
    };
  }

  if (risk >= 10 && risk <= 12) {
    return {
      backgroundColor: '#FFC000',
      borderColor: '#C47A00',
    };
  }

  if (risk >= 13) {
    return {
      backgroundColor: '#FF0000',
      borderColor: '#B00000',
    };
  }

  return {};
};

const getRiskTextStyle = (value) => {
  const risk = Number(value);

  if (!risk) {
    return {};
  }

  return {
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  };
};

export function HazardBlock({
  number,
  data,
  setData,
  hazardKey,
  controlKey,
  pKey,
  cKey,
  rKey,
  includeKey,
  initiallyOpen = false,
  forceOpen = false,
  onComplete,
  onOpen,
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [riskStep, setRiskStep] = useState(() => (
    data[pKey] && !data[cKey] ? 'C' : 'P'
  ));

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const hazardFilled = !!(
    String(data[hazardKey] || '').trim() ||
    String(data[controlKey] || '').trim() ||
    data[pKey] ||
    data[cKey] ||
    data[rKey]
  );
  const hazardDecision = data[includeKey];
  const riskEnabled = hazardDecision === true;
  const hazardComplete = hazardDecision === false || (
    hazardDecision === true &&
    String(data[hazardKey] || '').trim() &&
    String(data[controlKey] || '').trim() &&
    data[pKey] &&
    data[cKey] &&
    data[rKey]
  );
  const riskColourStyle = getRiskColourStyle(data[rKey]);
  const riskTextStyle = getRiskTextStyle(data[rKey]);

  const updateRisk = (key, value) => {
    if (!riskEnabled) return;

    const next = { ...data, [key]: String(value) };
    const p = key === pKey ? String(value) : String(next[pKey] || '');
    const c = key === cKey ? String(value) : String(next[cKey] || '');
    next[rKey] = p && c ? String(Number(p) * Number(c)) : '';
    setData(next);
    setRiskStep(key === pKey ? 'C' : 'P');

    if (p && c && next[rKey]) {
      setOpen(false);
      onComplete?.({ number, data: next, decision: true });
    }
  };

  const setDecision = (value) => {
    const next = {
      ...data,
      [includeKey]: value,
      ...(value === false ? { [pKey]: '', [cKey]: '', [rKey]: '' } : {}),
    };
    setData(next);
    if (value === true) {
      // Keep the card open and make Probability the next clear step.
      // This also prevents a previously selected C/P step from carrying
      // over when the user changes the hazard back to YES.
      setRiskStep('P');
      setOpen(true);
      onOpen?.({ number });
    } else {
      setRiskStep('P');
      setOpen(false);
      onComplete?.({ number, data: next, decision: false });
    }
  };

  return (
    <View style={[styles.hazardCard, hazardComplete && styles.hazardCardComplete]}>
      <View style={[styles.hazardHeader, hazardComplete && styles.hazardHeaderComplete]}>
        <TouchableOpacity
          style={{ flex: 1, paddingRight: 8 }}
          onPress={() => setOpen(!open)}
          activeOpacity={0.8}
        >
          <Text style={styles.hazardHeaderTitle}>
            {data[hazardKey]?.trim() || `Empty Hazard ${number}`}
          </Text>
          <Text style={[styles.hazardHeaderSubtitle, hazardComplete && styles.hazardHeaderSubtitleComplete]}>
            {!hazardFilled
              ? 'Unused row — no review required'
              : hazardDecision === true
                ? 'Applies — PCR required'
                : hazardDecision === false
                  ? 'Does not apply — PCR not required'
                  : 'Review required — select YES or NO'}
          </Text>
        </TouchableOpacity>

        {hazardFilled ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setDecision(true)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 9,
                borderWidth: hazardDecision === true ? 2 : 1,
                borderColor: hazardDecision === true ? '#42C878' : '#CAD3DA',
                backgroundColor: hazardDecision === true ? '#2D9655' : '#FFFFFF',
              }}
            >
              <Text style={{ color: hazardDecision === true ? '#FFFFFF' : '#536674', fontWeight: '900', fontSize: 12 }}>YES</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDecision(false)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 9,
                borderWidth: hazardDecision === false ? 2 : 1,
                borderColor: hazardDecision === false ? '#FF7A6E' : '#CAD3DA',
                backgroundColor: hazardDecision === false ? '#B83A3A' : '#FFFFFF',
              }}
            >
              <Text style={{ color: hazardDecision === false ? '#FFFFFF' : '#536674', fontWeight: '900', fontSize: 12 }}>NO</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity onPress={() => setOpen(!open)} hitSlop={8}>
          <Text style={[styles.hazardHeaderArrow, { marginLeft: 8 }]}>{open ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {open && (
        <View style={styles.hazardBody}>
          <View style={styles.hazardTopRow}>
            <View style={styles.hazardMainBox}>
              <Text style={styles.fieldLabel}>Hazard</Text>
              <TextInput
                value={data[hazardKey]}
                onChangeText={(v) => setData({ ...data, [hazardKey]: v, ...(v.trim() ? {} : { [includeKey]: null }) })}
                placeholder="Hazard"
                placeholderTextColor="#8291A1"
                style={[styles.input, styles.inputMultiline, styles.hazardInput]}
                multiline
              />
            </View>
          </View>

          <Field
            label="Control Measures"
            value={data[controlKey]}
            onChangeText={(v) => setData({ ...data, [controlKey]: v })}
            multiline
          />

          {hazardDecision === false ? (
            <View style={{ backgroundColor: '#F1F4F6', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#536674', fontWeight: '800' }}>PCR is not required for a hazard marked NO.</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.fieldLabel, { marginBottom: 7 }]}>Residual Risk</Text>
              {!riskEnabled ? (
                <View style={{ backgroundColor: '#FFF8E8', borderColor: '#D6A84F', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                  <Text style={{ color: '#765719', fontWeight: '800' }}>Select YES above to unlock Probability and Consequence.</Text>
                </View>
              ) : null}
              <View style={{ gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Probability', shortLabel: 'P', key: pKey },
                  { label: 'Consequence', shortLabel: 'C', key: cKey },
                ].map((group) => (
                  <View key={group.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 96 }}><Text style={{ color: riskEnabled && riskStep === group.shortLabel ? '#D6A84F' : '#FFFFFF', fontWeight: '900', fontSize: 12 }}>{group.label}</Text></View>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((value) => {
                        const selected = String(data[group.key] || '') === String(value);
                        const activeStep = riskEnabled && riskStep === group.shortLabel;
                        return (
                          <TouchableOpacity
                            key={value}
                            disabled={!riskEnabled}
                            onPress={() => updateRisk(group.key, value)}
                            style={{ flex: 1, minHeight: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', opacity: riskEnabled ? 1 : 0.48, borderWidth: activeStep || selected ? 2 : 1, borderColor: selected ? '#D6A84F' : activeStep ? '#D6A84F' : '#D4DCE2', backgroundColor: selected ? '#061A2D' : activeStep ? '#FFF8E8' : '#FFFFFF' }}
                          >
                            <Text style={{ color: selected ? '#FFFFFF' : '#061A2D', fontWeight: '900' }}>{value}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ width: 96, color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>Risk</Text>
                <View style={[styles.input, riskColourStyle, { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' }]}> 
                  <Text style={[{ fontSize: 18 }, riskTextStyle]}>{data[rKey] || '—'}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export function Field({
  label,
  helperText,
  value,
  onChangeText,
  placeholder,
  multiline,
  inputRef,
  keyboardType,
  autoCapitalize,
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
  onFocus,
}) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>

        {helperText ? (
          <Text style={styles.fieldHelperText}>
            {helperText}
          </Text>
        ) : null}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#8291A1"
        style={[styles.input, multiline && styles.inputMultiline]}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType={
          returnKeyType || (multiline ? 'default' : 'done')
        }
        blurOnSubmit={
          blurOnSubmit === undefined ? !multiline : blurOnSubmit
        }
        onFocus={onFocus}
        onSubmitEditing={
          onSubmitEditing || (multiline ? undefined : Keyboard.dismiss)
        }
      />
    </View>
  );
}

export function SmallField({ label, value, onChangeText, colourStyle, textStyle, editable = true }) {
  return (
    <View style={styles.smallFieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={label}
        placeholderTextColor="#8291A1"
        style={[styles.input, colourStyle, textStyle]}
        keyboardType="numeric"
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={Keyboard.dismiss}
      />
    </View>
  );
}

export function Toggle({ label, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>

      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function SectionTitle({ text }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}
