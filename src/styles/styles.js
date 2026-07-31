import { StyleSheet } from 'react-native';

export const NAVY = '#061A2D';
export const NAVY_2 = '#09233C';
export const GOLD = '#D6A84F';
export const WHITE = '#FFFFFF';
export const MUTED = '#B8C4D0';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },
    homeScroll: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  header: {
    padding: 28,
    paddingTop: 36,
    backgroundColor: NAVY_2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  headerSmall: {
    padding: 24,
    paddingTop: 34,
    backgroundColor: NAVY_2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  logoLarge: {
    width: 150,
    height: 150,
    marginBottom: 14,
  },
  company: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  title: {
    color: WHITE,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleSmall: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  subtitle: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 22,
  },
    homeIntro: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 4,
  },
  sectionLabel: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
  },
  backText: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
  },
  formList: {
    padding: 20,
    gap: 16,
  },
  hazardCard: {
    backgroundColor: '#0E203A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#243B5A',
    marginTop: 10,
    overflow: 'hidden',
  },

  hazardCardComplete: {
    borderColor: '#2D9655',
  },

  hazardHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  hazardHeaderComplete: {
    backgroundColor: '#153B2A',
    borderLeftWidth: 4,
    borderLeftColor: '#42C878',
  },

  hazardHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  hazardHeaderSubtitle: {
    color: '#A8B6C8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },

  hazardHeaderSubtitleComplete: {
    color: '#9BE6B5',
  },

  hazardHeaderArrow: {
    color: '#D6A84F',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 10,
  },

  hazardBody: {
    borderTopWidth: 1,
    borderTopColor: '#243B5A',
    padding: 12,
  },

  hazardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  hazardMainBox: {
    flex: 1,
  },

  hazardRiskBox: {
    width: 128,
  },

  hazardRiskRow: {
    flexDirection: 'row',
    gap: 6,
  },
  hazardIncludeRow: {
    backgroundColor: '#071D34',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#243B5A',
  },

  hazardIncludeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  hazardInput: {
    minHeight: 54,
    maxHeight: 72,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.22)',
  },
    cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardBadge: {
    backgroundColor: NAVY,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardBadgeText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardArrow: {
    color: GOLD,
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 34,
  },
  cardTitle: {
    color: NAVY,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: '#51606F',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 14,
  },
  cardHint: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '900',
  },
  dropdownButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6A84F',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownButtonText: {
    color: '#13294B',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },

  dropdownArrow: {
    color: '#13294B',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 10,
  },

  dropdownList: {
    backgroundColor: '#0E203A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6A84F',
    marginBottom: 12,
    overflow: 'hidden',
  },

  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#243B5A',
  },

  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
    ppeRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6E8EE',
  },

  ppeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF3FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  ppeIconText: {
    fontSize: 20,
  },

  ppeRowLabel: {
    color: '#071D34',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  ppeCollapseHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 7,
    borderRadius: 13,
    borderColor: '#D5E0E8',
    backgroundColor: '#F8FAFC',
  },
  ppeCollapseTitle: {
    color: NAVY,
    fontSize: 15,
    marginBottom: 2,
  },
  ppeCollapseSubtitle: {
    color: '#687784',
    fontSize: 10,
  },
  ppeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  ppeGridItem: {
    width: '31.8%',
    minHeight: 78,
    marginTop: 0,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ppeGridItemSelected: {
    backgroundColor: '#DDF5E5',
    borderColor: '#2D9655',
  },
  ppeGridLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  ppeGridLabelSelected: {
    color: '#145A2A',
  },
  ppeGridCheck: {
    alignSelf: 'flex-end',
    color: '#2D9655',
    fontSize: 17,
    lineHeight: 17,
    fontWeight: '900',
  },
  ppeGridCheckEmpty: {
    color: 'transparent',
  },
  ppeGridSwitch: {
    alignSelf: 'flex-end',
    transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }],
    marginBottom: -5,
    marginRight: -6,
  },
    homeFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
  },
  homeFooterText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '700',
  },
  topBar: {
    height: 54,
    backgroundColor: NAVY_2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  topButton: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
    width: 62,
    textAlign: 'left',
  },
  topButtonRight: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
    width: 62,
    textAlign: 'right',
  },
  topClearButton: {
    color: '#FF8A80',
    fontWeight: '900',
  },
  topTitle: {
    flex: 1,
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: WHITE,
  },
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NAVY,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(6,26,45,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: WHITE,
    marginTop: 12,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  projectDetailsCard: {
    backgroundColor: NAVY_2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.48)',
    padding: 14,
    marginBottom: 2,
  },
  projectDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  projectDetailsHeadingWrap: {
    flex: 1,
    paddingRight: 12,
  },
  projectDetailsTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '900',
  },
  projectDetailsSubtitle: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  projectEditButton: {
    minHeight: 38,
    minWidth: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  projectEditButtonText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '900',
  },
  projectSummaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  projectSummaryItem: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 11,
  },
  projectSummaryLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  projectSummaryValue: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },
  formFieldPair: {
    flexDirection: 'row',
    gap: 10,
  },
  formFieldPairItem: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 12,
  },
  groupLabel: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  fieldHelperText: {
    flexShrink: 1,
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 12,
    marginBottom: 6,
  },
  fieldLabel: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: NAVY,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  smallFieldWrap: {
    flex: 1,
  },
  toggleRow: {
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },
    secondaryButton: {
    backgroundColor: '#13294B',
    borderWidth: 1,
    borderColor: '#D6A84F',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },

  compactAddButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.65)',
    backgroundColor: 'rgba(214,168,79,0.10)',
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: -4,
    marginBottom: 14,
  },

  compactAddButtonText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '900',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },

  formActionButton: {
    flex: 1,
    marginTop: 0,
  },

  saveButton: {
    backgroundColor: GOLD,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: '900',
  },
  exportButton: {
    backgroundColor: WHITE,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: GOLD,
  },
  exportButtonText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: '900',
  },
  clearButton: {
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  collapseHeader: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseHeaderStart: {
    backgroundColor: '#CDEBD5',
    borderColor: '#238443',
    borderWidth: 2,
  },
  collapseHeaderEnd: {
    backgroundColor: '#F4CEC8',
    borderColor: '#C33E32',
    borderWidth: 2,
  },
  collapseHeaderCompact: {
    alignSelf: 'center',
    width: 165,
    minHeight: 40,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: NAVY_2,
    borderColor: 'rgba(214,168,79,0.58)',
    borderWidth: 1,
  },
  collapseHeaderWorkflow: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 72,
    paddingLeft: 20,
    paddingRight: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#DCE3E8',
    backgroundColor: WHITE,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  collapseHeaderWorkflowCurrent: {
    borderColor: 'rgba(214,168,79,0.88)',
    backgroundColor: NAVY_2,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  collapseHeaderWorkflowComplete: {
    borderColor: 'rgba(214,168,79,0.52)',
  },
  collapseWorkflowAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#DCE3E8',
  },
  collapseWorkflowAccentCurrent: {
    backgroundColor: GOLD,
  },
  collapseWorkflowAccentComplete: {
    backgroundColor: GOLD,
  },
  collapseCopy: {
    flex: 1,
    minWidth: 0,
  },
  collapseWorkflowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  collapseTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  collapseTitleStart: {
    color: '#145A2A',
  },
  collapseTitleEnd: {
    color: '#7B211B',
  },
  collapseTitleCompact: {
    color: WHITE,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 0,
  },
  collapseTitleWorkflow: {
    flexShrink: 1,
    marginBottom: 0,
  },
  collapseTitleWorkflowCurrent: {
    color: WHITE,
  },
  collapseSubtitle: {
    color: '#51606F',
    fontSize: 13,
    fontWeight: '700',
  },
  collapseSubtitleStart: {
    color: '#256B38',
  },
  collapseSubtitleEnd: {
    color: '#91352D',
  },
  collapseSubtitleCompact: {
    color: '#AFC2D2',
    fontSize: 9,
    textAlign: 'center',
  },
  collapseSubtitleWorkflow: {
    marginTop: 5,
    color: '#607080',
    fontSize: 12,
  },
  collapseSubtitleWorkflowCurrent: {
    color: '#C7D4DF',
  },
  collapseWorkflowStatus: {
    flexShrink: 0,
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE3E8',
    backgroundColor: '#F3F6F8',
  },
  collapseWorkflowStatusCurrent: {
    borderColor: 'rgba(214,168,79,0.7)',
    backgroundColor: 'rgba(214,168,79,0.14)',
  },
  collapseWorkflowStatusComplete: {
    borderColor: 'rgba(214,168,79,0.54)',
    backgroundColor: 'rgba(214,168,79,0.1)',
  },
  collapseWorkflowStatusText: {
    color: '#697887',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  collapseWorkflowStatusTextCurrent: {
    color: GOLD,
  },
  collapseWorkflowStatusTextComplete: {
    color: NAVY_2,
  },
  collapseArrow: {
    color: GOLD,
    fontSize: 28,
    fontWeight: '700',
    paddingLeft: 12,
  },
  collapseArrowStart: {
    color: '#167A36',
  },
  collapseArrowEnd: {
    color: '#B52F25',
  },
  collapseArrowWorkflow: {
    color: GOLD,
    fontSize: 24,
    paddingLeft: 10,
  },
  collapseArrowWorkflowCurrent: {
    color: GOLD,
  },
  collapseContent: {
    marginBottom: 8,
  },
  collapseCloseButton: {
  minHeight: 44,
  backgroundColor: '#F4D9D4',
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 9,
  marginTop: 12,
  marginBottom: 4,
  borderWidth: 1,
  borderColor: '#C97868',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},

collapseCloseButtonStart: {
  backgroundColor: '#DDF1E3',
  borderColor: '#64A875',
},

collapseCloseButtonEnd: {
  backgroundColor: '#F4D9D4',
  borderColor: '#C97868',
},

collapseCloseButtonText: {
  color: '#7A2F24',
  fontSize: 15,
  fontWeight: '900',
},

collapseCloseButtonTextStart: {
  color: '#1F6335',
},

collapseCloseButtonTextEnd: {
  color: '#7A2F24',
},

collapseCloseArrow: {
  color: '#A94737',
  fontSize: 18,
  fontWeight: '900',
  paddingLeft: 10,
},

collapseCloseArrowStart: {
  color: '#2E8B4B',
},

collapseCloseArrowEnd: {
  color: '#A94737',
},
collapseCloseButtonWorkflow: {
  backgroundColor: '#F3F6F8',
  borderColor: 'rgba(9,35,60,0.22)',
},

collapseCloseButtonTextWorkflow: {
  color: NAVY_2,
},

collapseCloseArrowWorkflow: {
  color: GOLD,
},
  clearButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
  },
    sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  riskGuideButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 18,
    marginBottom: 12,
  },

  riskGuideButtonText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '900',
  },

  guideTopSpacer: {
    width: 112,
  },

  guideScrollContent: {
    padding: 20,
    paddingBottom: 50,
  },

  guideSectionTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 10,
  },

  guideCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.35)',
    marginBottom: 10,
  },

  guideListText: {
    color: NAVY,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },

  guideBold: {
    fontWeight: '900',
  },

  guideInstruction: {
    color: NAVY,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },

  guideMatrixScroll: {
    paddingBottom: 6,
  },

  guideMatrix: {
    borderWidth: 1,
    borderColor: NAVY,
  },

  guideMatrixRow: {
    flexDirection: 'row',
  },

  guideMatrixCell: {
    minHeight: 52,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },

  guideConsequenceCell: {
    width: 165,
    backgroundColor: '#F7DFA6',
  },

  guideRatingCell: {
    width: 58,
    backgroundColor: '#F7DFA6',
  },

  guideProbabilityCell: {
    width: 82,
    backgroundColor: '#A9D3F0',
  },

  guideMatrixLabelCell: {
    backgroundColor: '#F7DFA6',
  },

  guideMatrixHeaderText: {
    color: NAVY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },

  guideMatrixText: {
    color: NAVY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  guideMatrixRiskText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '900',
  },

  guideMatrixAcuteText: {
    color: WHITE,
  },

  guideRiskLow: {
    backgroundColor: '#92D050',
  },

  guideRiskModerate: {
    backgroundColor: '#FFFF00',
  },

  guideRiskHigh: {
    backgroundColor: '#FFC000',
  },

  guideRiskAcute: {
    backgroundColor: '#FF0000',
  },

  guideLegendRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 20,
  },

  guideLegendBox: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  guideLegendText: {
    color: NAVY,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },

  photoFieldCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },

  photoFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  photoFieldLabel: {
    flex: 1,
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
  },

  photoOptionalText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  photoCaptureButton: {
    minHeight: 52,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: GOLD,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,168,79,0.08)',
  },

  photoCaptureIcon: {
    color: GOLD,
    fontSize: 25,
    marginRight: 8,
  },

  photoCaptureText: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '900',
  },

  photoPreviewWrap: {
    height: 190,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: NAVY,
  },

  photoPreview: {
    width: '100%',
    height: '100%',
  },

  photoStampPreview: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,26,45,0.86)',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  photoStampText: {
    color: WHITE,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },

  photoActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },

  photoRetakeButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,138,128,0.55)',
  },

  photoRetakeText: {
    color: '#FFB4AC',
    fontSize: 12,
    fontWeight: '900',
  },
});

export default styles;
