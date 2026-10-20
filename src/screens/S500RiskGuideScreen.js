import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView, Modal, Pressable, useWindowDimensions,
} from 'react-native';

import styles from '../styles/styles';
import AppBackButton from '../components/AppBackButton';

const riskRows = [
  {
    consequence: 'Minor',
    rating: 1,
    values: [1, 2, 3, 4, 5],
  },
  {
    consequence: 'First aid / minor damage',
    rating: 2,
    values: [2, 4, 6, 8, 10],
  },
  {
    consequence: 'Medical treatment / moderate damage',
    rating: 3,
    values: [3, 6, 9, 12, 15],
  },
  {
    consequence: 'Major injury / major damage',
    rating: 4,
    values: [4, 8, 12, 16, 20],
  },
  {
    consequence: 'Permanent incapacity / extensive damage',
    rating: 5,
    values: [5, 10, 15, 20, 25],
  },
];

const getRiskStyle = (risk) => {
  if (risk <= 6) {
    return styles.guideRiskLow;
  }

  if (risk <= 9) {
    return styles.guideRiskModerate;
  }

  if (risk <= 12) {
    return styles.guideRiskHigh;
  }

  return styles.guideRiskAcute;
};

export default function S500RiskGuideScreen({ setScreen, backLabel = 'S-500 Form' }) {
  const [matrixOpen, setMatrixOpen] = useState(false);
  const { width } = useWindowDimensions();
  const matrixWidth = Math.max(300, width - 28);
  const consequenceWidth = matrixWidth * 0.27;
  const ratingWidth = matrixWidth * 0.10;
  const probabilityWidth = (matrixWidth - consequenceWidth - ratingWidth) / 5;
  const matrix = (zoomed = false) => (
    <View style={[styles.guideMatrix, { width: zoomed ? 720 : matrixWidth }]}>
                <View style={styles.guideMatrixRow}>
                  <View style={[styles.guideMatrixCell, styles.guideConsequenceCell, { width: zoomed ? 190 : consequenceWidth }]}>
                    <Text style={styles.guideMatrixHeaderText}>Consequence</Text>
                  </View>
    
                  <View style={[styles.guideMatrixCell, styles.guideRatingCell, { width: zoomed ? 70 : ratingWidth }]}>
                    <Text style={styles.guideMatrixHeaderText}>Rating</Text>
                  </View>
    
                  {['Rare\n1', 'Unlikely\n2', 'Moderate\n3', 'Probable\n4', 'Almost Certain\n5'].map(
                    (heading) => (
                      <View
                        key={heading}
                        style={[styles.guideMatrixCell, styles.guideProbabilityCell, { width: zoomed ? 92 : probabilityWidth }]}
                      >
                        <Text style={styles.guideMatrixHeaderText}>{heading}</Text>
                      </View>
                    )
                  )}
                </View>
    
                {riskRows.map((row) => (
                  <View key={row.rating} style={styles.guideMatrixRow}>
                    <View
                      style={[
                        styles.guideMatrixCell,
                        styles.guideConsequenceCell,
                        styles.guideMatrixLabelCell, { width: zoomed ? 190 : consequenceWidth },
                      ]}
                    >
                      <Text style={styles.guideMatrixText}>{row.consequence}</Text>
                    </View>
    
                    <View
                      style={[
                        styles.guideMatrixCell,
                        styles.guideRatingCell,
                        styles.guideMatrixLabelCell, { width: zoomed ? 70 : ratingWidth },
                      ]}
                    >
                      <Text style={styles.guideMatrixText}>{row.rating}</Text>
                    </View>
    
                    {row.values.map((risk) => (
                      <View
                        key={`${row.rating}-${risk}`}
                        style={[
                          styles.guideMatrixCell,
                          styles.guideProbabilityCell, { width: zoomed ? 92 : probabilityWidth },
                          getRiskStyle(risk),
                        ]}
                      >
                        <Text
                          style={[
                            styles.guideMatrixRiskText,
                            risk >= 13 && styles.guideMatrixAcuteText,
                          ]}
                        >
                          {risk}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
  );

  return (    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topBar}>
        <AppBackButton label={backLabel} onPress={() => setScreen('fillS500')} />

        <Text style={styles.topTitle}>S-500 Risk Guide</Text>

        <View style={styles.guideTopSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.guideScrollContent}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <Text style={styles.guideSectionTitle}>Hierarchy of Control</Text>

        <View style={styles.guideCard}>
          <Text style={styles.guideListText}>
            <Text style={styles.guideBold}>1. Eliminate</Text>
            {' - '}Modify the process or method to eliminate the hazard.
          </Text>

          <Text style={styles.guideListText}>
            <Text style={styles.guideBold}>2. Substitute</Text>
            {' - '}Replace the material or process with a less hazardous one.
          </Text>

          <Text style={styles.guideListText}>
            <Text style={styles.guideBold}>3. Isolate</Text>
            {' - '}Separate the hazard from the person or the person from the hazard.
          </Text>

          <Text style={styles.guideListText}>
            <Text style={styles.guideBold}>4. Engineer</Text>
            {' - '}Redesign the workplace, equipment or process.
          </Text>

          <Text style={styles.guideListText}>
            <Text style={styles.guideBold}>5. Administrative</Text>
            {' - '}Implement training or develop procedures.
          </Text>

          <Text style={styles.guideListText}>
            <Text style={styles.guideBold}>6. PPE</Text>
            {' - '}Use properly fitted protective equipment to control risk.
          </Text>
        </View>

        <Text style={styles.guideSectionTitle}>How to Use This Form</Text>

        <View style={styles.guideCard}>
          <Text style={styles.guideInstruction}>
            • Identify hazards, including environmental hazards, by observing,
            inspecting, investigating and communicating.
          </Text>

          <Text style={styles.guideInstruction}>
            • Implement control measures to reduce the risk.
          </Text>

          <Text style={styles.guideInstruction}>
            • Use the Risk Assessment Matrix to assess the residual risk after
            control measures are implemented.
          </Text>

          <Text style={styles.guideInstruction}>
            • P means Probability — how likely the event is to happen.
          </Text>

          <Text style={styles.guideInstruction}>
            • C means Consequence — the severity if it happens.
          </Text>

          <Text style={styles.guideInstruction}>
            • R means Risk Rating — the resulting risk factor.
          </Text>

          <Text style={styles.guideInstruction}>
            • Ensure residual risk is ALARP. If the residual risk is High or
            Acute, stop and contact the Safety Manager.
          </Text>

          <Text style={styles.guideInstruction}>
            • Each survey crew member is to complete their own Pre-Start Risk
            Assessment.
          </Text>

          <Text style={styles.guideInstruction}>
            • If the crew leaves the site or work conditions change, review the
            hazards and update the assessment.
          </Text>
        </View>

        <Text style={styles.guideSectionTitle}>Risk Assessment Matrix</Text>

        <Pressable onPress={() => setMatrixOpen(true)} accessibilityRole="button" accessibilityLabel="Open zoomable risk matrix">
          {matrix(false)}
          <Text style={{ color: '#D6A84F', textAlign: 'center', fontWeight: '800', marginTop: 8 }}>Tap matrix to open and zoom</Text>
        </Pressable>

        <View style={styles.guideLegendRow}>
          <View style={[styles.guideLegendBox, styles.guideRiskLow]}>
            <Text style={styles.guideLegendText}>1–6 LOW</Text>
          </View>

          <View style={[styles.guideLegendBox, styles.guideRiskModerate]}>
            <Text style={styles.guideLegendText}>7–9 MODERATE</Text>
          </View>

          <View style={[styles.guideLegendBox, styles.guideRiskHigh]}>
            <Text style={styles.guideLegendText}>10–12 HIGH</Text>
          </View>

          <View style={[styles.guideLegendBox, styles.guideRiskAcute]}>
            <Text style={[styles.guideLegendText, styles.guideMatrixAcuteText]}>
              13–25 ACUTE
            </Text>
          </View>
        </View>
      </ScrollView>
      <Modal visible={matrixOpen} animationType="fade" onRequestClose={() => setMatrixOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#061A2D' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>Risk Matrix</Text>
            <Pressable onPress={() => setMatrixOpen(false)}><Text style={{ color: '#D6A84F', fontWeight: '900', fontSize: 16 }}>Done</Text></Pressable>
          </View>
          <ScrollView horizontal minimumZoomScale={0.7} maximumZoomScale={3} contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
            {matrix(true)}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
