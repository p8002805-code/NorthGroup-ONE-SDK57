import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Animated,
  ImageBackground,
  Keyboard,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import styles, {
  GOLD,
  NAVY,
  WHITE,
} from '../styles/styles';

import { Field } from '../components/FormFields';

import CollapseSection from '../components/CollapseSection';
import SE14PhotoField from '../components/SE14PhotoField';
import LoadingOverlay from '../components/LoadingOverlay';
import AppBackButton from '../components/AppBackButton';
import { STAFF_NAMES } from '../constants/staffNames';
import { applyProfileDefaults } from '../features/account/accountProfile';
import {
  getSE14CompletionIssue,
  getSE14FieldCompletionIssue,
  getSE14StartIssue,
} from '../utils/se14Records';

const LAST_SE14_OBSERVER_KEY = 'se14LastObserver';
const LAST_SE14_PROJECT_KEY = 'se14LastProjectNumber';
const CUSTOM_RECEIVER_SERIALS_KEY =
  'se14CustomReceiverSerials';
const CUSTOM_MARK_TYPES_KEY = 'se14CustomMarkTypes';

const MARK_TYPE_OPTIONS = [
  'Star Picket',
  'Brass Plaque',
  'Mini Mark',
  'Iron Pin',
  'Bolt',
  'Nail in Bitumen',
  'Nail in Concrete',
  'Nail in Kerb',
  'Peg',
  'Screw in Bitumen',
  'Screw in Concrete',
  'Screw in Kerb',
];

const SESSION_NUMBER_OPTIONS = Array.from(
  { length: 4 },
  (_, index) => String(index + 1)
);

const formatMarkLabel = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'MARK —';

  const compact = trimmed.replace(/\s+/g, '');

  if (/^\d+$/.test(compact)) {
    return `PM${compact}`;
  }

  const pmNumberMatch = compact.match(/^PM[-_]?(\d+)$/i);
  if (pmNumberMatch) {
    return `PM${pmNumberMatch[1]}`;
  }

  return trimmed.replace(/\s+/g, ' ').toUpperCase();
};

const RECEIVER_OPTIONS = [
  'Leica 1200',
  'Leica GS15',
  'Trimble R8',
  'Trimble R10',
  'Trimble R12',
  'Trimble R12i',
  'Topcon GR-3',
];

const RECEIVER_SERIAL_OPTIONS = {
  'Leica 1200': [
    '(GPS5) S/N 06410151',
    '(GPS6) S/N 07380017',
    '(GPS7) S/N 07170142',
    '(GPS9) S/N 07190067',
  ],
  'Leica GS15': [
    '(SG76) S/N 1515345',
    '(SG77) S/N 1515303',
    '(SG79) S/N 1517324',
    '(SG80) S/N 1516939',
  ],
  'Trimble R8': [
    '(SG65) S/N 4831156287',
    '(SG66) S/N 4608109006',
    '(SG81) S/N 5130469436',
    '(SG82) S/N 5130469228',
    '(GLSG65) S/N 4730134042',
    '(GLSG66) S/N 4730136042',
    '(GLSG67) S/N 4730136051',
  ],
  'Trimble R10': [
    '(SG83) S/N 5521400120',
    '(SG84) S/N 5549446731',
    '(SG85) S/N 5549445782',
    '(SG86) S/N 5704470096',
    '(SG87) S/N 5609456863',
    '(SG88) S/N 5848470185',
    '(SG89) S/N 5407454438',
    '(SG90) S/N 5413460373',
    '(SG92) S/N 5646472356',
    '(SG93) S/N 5705470314',
  ],
  'Trimble R12': [
    '(SG94) S/N 6213F01851',
    '(SG95) S/N 6216F00889',
    '(SG97) S/N 6304F00340',
    '(SG98) S/N 6304F00194',
  ],
  'Trimble R12i': [
    '(SG101) S/N 6326F00280',
    '(SG102) S/N 6339F01046',
  ],
  'Topcon GR-3': ['S/N 443-0963'],
};

const RECEIVER_ANTENNA_VALUES = {
  'Leica 1200': {
    radius: 0.085,
    groundPlaneOffset: 0.36,
  },
  'Leica GS15': {
    radius: 0.098,
    groundPlaneOffset: 0.255,
  },
  'Trimble R8': {
    radius: 0.091,
    groundPlaneOffset: -0.055,
  },
  'Trimble R10': {
    radius: 0.12,
    groundPlaneOffset: 0.15,
  },
  'Trimble R12': {
    radius: 0.12,
    groundPlaneOffset: 0.15,
  },
  'Trimble R12i': {
    radius: 0.12,
    groundPlaneOffset: 0.15,
  },
  'Topcon GR-3': {
    radius: 0.097,
    groundPlaneOffset: -0.17,
  },
};

const MEASURED_TO_OPTIONS = [
  'Leica Hook',
  'R8 Centre of Bumper',
  'R10 Lever Arm',
  'R12 Lever Arm',
  'Topcon Bottom of Bumper',
];

const RECEIVER_MEASURED_TO = {
  'Leica 1200': 'Leica Hook',
  'Leica GS15': 'Leica Hook',
  'Trimble R8': 'R8 Centre of Bumper',
  'Trimble R10': 'R10 Lever Arm',
  'Trimble R12': 'R12 Lever Arm',
  'Trimble R12i': 'R12 Lever Arm',
  'Topcon GR-3': 'Topcon Bottom of Bumper',
};

const getTodayDate = () => {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  return `${day}/${month}/${year}`;
};

const getCurrentTime = () => {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const START_REQUIRED_YES_KEYS = new Set([
  'levelledStart',
  'antennaNorth',
  'externalPower',
]);

const countCompletedFields = (form, keys) => {
  return keys.filter((key) => {
    const value = form[key];

    if (key === 'arpBqr') {
      const arpBqr = parseMeasurement(value);
      return arpBqr !== null && Math.abs(arpBqr) <= 0.005;
    }

    if (key.startsWith('photo')) {
      return Boolean(value?.uri);
    }

    if (typeof value === 'boolean') {
      if (START_REQUIRED_YES_KEYS.has(key)) {
        return value === true;
      }
      return form.checklistAnswersVersion === 2;
    }

    return String(value || '').trim().length > 0;
  }).length;
};

const SESSION_DETAIL_KEYS = [
  'markId',
  'markType',
  'sessionNumber',
  'receiverModel',
  'receiverSerial',
];

function DropdownField({
  label,
  value,
  placeholder,
  options,
  open,
  onToggle,
  onSelect,
}) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.dropdownButton}
        activeOpacity={0.8}
        onPress={() => {
          Keyboard.dismiss();
          onToggle();
        }}
      >
        <Text style={styles.dropdownButtonText}>
          {value || placeholder}
        </Text>

        <Text style={styles.dropdownArrow}>
          {open ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdownList}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.dropdownItem}
              activeOpacity={0.8}
              onPress={() => onSelect(option)}
            >
              <Text style={styles.dropdownItemText}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

function YesNoChecklistRow({
  label,
  value,
  onChange,
  active = false,
}) {
  return (
    <View
      style={[
        gnssStyles.yesNoRow,
        active && gnssStyles.yesNoRowActive,
      ]}
    >
      <Text style={gnssStyles.yesNoLabel}>{label}</Text>
      <View style={gnssStyles.yesNoActions}>
        <TouchableOpacity
          style={[
            gnssStyles.yesNoButton,
            value === true && gnssStyles.yesButtonSelected,
          ]}
          activeOpacity={0.82}
          onPress={() => onChange(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === true }}
        >
          <Text
            style={[
              gnssStyles.yesNoButtonText,
              value === true && gnssStyles.yesNoSelectedText,
            ]}
          >
            YES
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            gnssStyles.yesNoButton,
            value === false && gnssStyles.noButtonSelected,
          ]}
          activeOpacity={0.82}
          onPress={() => onChange(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === false }}
        >
          <Text
            style={[
              gnssStyles.yesNoButtonText,
              value === false && gnssStyles.yesNoSelectedText,
            ]}
          >
            NO
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const START_KEYS = [
  'startDate',
  'startTime',
  'measuredToStart',
  'hmpStart',
  'bqrStart',
  'arpBqr',
  'levelledStart',
  'antennaNorth',
  'externalPower',
  'photoStartMarkId',
  'photoStartReceiverSerial',
  'photoStartHeightMeasurement',
  'photoStartBubble',
  'photoStartObstructions',
];

const END_KEYS = [
  'endDate',
  'endTime',
  'measuredToEnd',
  'hmpEnd',
  'levelledEnd',
  'powerStillOn',
  'markConfirmed',
  'photoEndMarkId',
  'photoEndHeightMeasurement',
];

const FILE_KEYS = [
  'rawGnssFile',
  'rinexFile',
];

const parseMeasurement = (value) => {
  const cleanedValue = String(value || '')
    .trim()
    .replace(',', '.');

  if (!cleanedValue) {
    return null;
  }

  const numericValue = Number(cleanedValue);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
};

const hasMinimumHeightDigits = (value) => {
  const cleanedValue = String(value || '')
    .trim()
    .replace(',', '.');
  const digitCount = (cleanedValue.match(/\d/g) || []).length;

  return digitCount >= 4 && parseMeasurement(cleanedValue) !== null;
};

const getMeasuredToForReceiver = (receiverModel) =>
  RECEIVER_MEASURED_TO[receiverModel] || '';

export default function SE14FormScreen({
  se14,
  setSE14,
  saveSE14AsInProgress,
  saveActiveSE14Record,
  completeSE14FieldSession,
  isInProgress,
  isCompleted,
  recordStatus = 'draft',
  clearSE14,
  exportSE14Pdf,
  setScreen,
  accountProfile,
  activeJob,
  backLabel = 'GNSS Sessions',
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const bodyY = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const markIdRef = useRef(null);
  const hmpStartRef = useRef(null);
  const bqrStartRef = useRef(null);
  const hmpEndRef = useRef(null);
  const rawFileRef = useRef(null);
  const rinexFileRef = useRef(null);
  const commentsRef = useRef(null);
  const hmpStartAdvanceTimer = useRef(null);
  const hmpEndAdvanceTimer = useRef(null);
  const bqrAdvanceTimer = useRef(null);
  const autosaveTimer = useRef(null);
  const reviewKeyboardSubscription = useRef(null);
  const reviewInputScrollTimers = useRef([]);
  const saveRecordRef = useRef(saveActiveSE14Record);
  const isReview =
    recordStatus === 'review' ||
    recordStatus === 'complete' ||
    Boolean(isCompleted);
  const isFieldSession = Boolean(isInProgress && !isReview);
  const headerMark = formatMarkLabel(se14.markId);
  const headerSession = `SESSION ${se14.sessionNumber || '—'}`;

  const [showSessionStart, setShowSessionStart] =
    useState(!isInProgress);

  const [showSessionDetails, setShowSessionDetails] =
    useState(!isInProgress);

  const [showSessionEnd, setShowSessionEnd] =
    useState(false);

  const [showFiles, setShowFiles] =
    useState(false);

  const [showComments, setShowComments] =
    useState(false);

  const [keyboardHeight, setKeyboardHeight] =
    useState(0);

  const [editStartDetails, setEditStartDetails] =
    useState(false);

  const [editEndDetails, setEditEndDetails] =
    useState(false);

  const [isPreparingPdf, setIsPreparingPdf] =
    useState(false);

  const [openDropdown, setOpenDropdown] =
    useState(null);

  const [customReceiverSerials, setCustomReceiverSerials] =
    useState({});

  const [customMarkTypes, setCustomMarkTypes] =
    useState([]);

  const [guidedChecklistKey, setGuidedChecklistKey] =
    useState(null);

  const [arpBqrRetryRequired, setArpBqrRetryRequired] =
    useState(false);

  const [arpBqrHeightRetried, setArpBqrHeightRetried] =
    useState(false);

  useEffect(() => {
    const updateKeyboardHeight = (event) => {
      setKeyboardHeight(Number(event?.endCoordinates?.height) || 0);
    };
    const clearKeyboardHeight = () => setKeyboardHeight(0);
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', updateKeyboardHeight),
      Keyboard.addListener('keyboardDidShow', updateKeyboardHeight),
      Keyboard.addListener('keyboardWillHide', clearKeyboardHeight),
      Keyboard.addListener('keyboardDidHide', clearKeyboardHeight),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  const sessionDetailsCompleted =
    countCompletedFields(se14, SESSION_DETAIL_KEYS);

  const startCompleted =
    countCompletedFields(se14, START_KEYS);

  const endCompleted =
    countCompletedFields(se14, END_KEYS);

  const filesCompleted =
    countCompletedFields(se14, FILE_KEYS);

  const sessionDetailsComplete =
    sessionDetailsCompleted === SESSION_DETAIL_KEYS.length;

  const sessionStartComplete =
    startCompleted === START_KEYS.length;

  const sessionEndComplete =
    endCompleted === END_KEYS.length;

  const arpBqrValue =
    parseMeasurement(se14.arpBqr);

  const arpBqrWithinTolerance =
    arpBqrValue !== null &&
    Math.abs(arpBqrValue) <= 0.005;

  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [85, 130],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const compactHeaderTranslate = scrollY.interpolate({
    inputRange: [85, 130],
    outputRange: [-96, 0],
    extrapolate: 'clamp',
  });

  const updateField = (key, value) => {
    setSE14((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const scrollToSection = (section, extraOffset = 0) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(
          0,
          bodyY.current +
            (sectionY.current[section] || 0) +
            extraOffset -
            66
        ),
        animated: true,
      });
    }, 180);
  };

  const focusFieldStep = (inputRef, section, extraOffset = 0) => {
    setOpenDropdown(null);
    scrollToSection(section, extraOffset);
    setTimeout(() => inputRef.current?.focus(), 320);
  };

  const clearReviewInputVisibilityWork = () => {
    reviewKeyboardSubscription.current?.remove();
    reviewKeyboardSubscription.current = null;
    reviewInputScrollTimers.current.forEach((timer) => clearTimeout(timer));
    reviewInputScrollTimers.current = [];
  };

  const revealReviewInput = (section, extraOffset = 0) => {
    clearReviewInputVisibilityWork();

    const scrollForInput = () => {
      scrollToSection(section, extraOffset);
    };

    const keyboardSubscription = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        keyboardSubscription.remove();
        reviewKeyboardSubscription.current = null;
        scrollForInput();
        const followUpTimer = setTimeout(scrollForInput, 240);
        reviewInputScrollTimers.current.push(followUpTimer);
      }
    );

    reviewKeyboardSubscription.current = keyboardSubscription;
    scrollForInput();

    [260, 700].forEach((delay) => {
      const timer = setTimeout(scrollForInput, delay);
      reviewInputScrollTimers.current.push(timer);
    });

    const cleanupTimer = setTimeout(() => {
      keyboardSubscription.remove();
      if (reviewKeyboardSubscription.current === keyboardSubscription) {
        reviewKeyboardSubscription.current = null;
      }
    }, 1800);
    reviewInputScrollTimers.current.push(cleanupTimer);
  };

  const focusReviewInputStep = (
    inputRef,
    section,
    extraOffset = 0
  ) => {
    setOpenDropdown(null);
    revealReviewInput(section, extraOffset);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openReviewSection = (
    section,
    setOpen,
    inputRef,
    extraOffset = 0
  ) => {
    setOpen(true);
    setTimeout(() => {
      focusReviewInputStep(inputRef, section, extraOffset);
    }, 160);
  };

  const openDropdownStep = (key, section, extraOffset = 0) => {
    Keyboard.dismiss();
    setOpenDropdown(key);
    scrollToSection(section, extraOffset);
  };

  const returnToSessionDetailsMarkId = () => {
    if (hmpStartAdvanceTimer.current) {
      clearTimeout(hmpStartAdvanceTimer.current);
      hmpStartAdvanceTimer.current = null;
    }

    if (hmpEndAdvanceTimer.current) {
      clearTimeout(hmpEndAdvanceTimer.current);
      hmpEndAdvanceTimer.current = null;
    }

    if (bqrAdvanceTimer.current) {
      clearTimeout(bqrAdvanceTimer.current);
      bqrAdvanceTimer.current = null;
    }

    setOpenDropdown(null);
    setShowSessionDetails(true);
    setShowSessionStart(false);
    setShowSessionEnd(false);
    setShowFiles(false);
    setShowComments(false);
    setEditStartDetails(false);
    setEditEndDetails(false);
    setGuidedChecklistKey(null);
    setArpBqrRetryRequired(false);
    setArpBqrHeightRetried(false);
    Keyboard.dismiss();

    setTimeout(() => {
      focusFieldStep(markIdRef, 'details');
    }, 120);
  };

  const answerChecklist = (key, value, nextKey, section) => {
    updateField(key, value);

    if (section === 'start' && value === false) {
      const correctiveMessages = {
        levelledStart:
          'Please relevel and centre the antenna before continuing.',
        antennaNorth:
          'Please orientate antenna north before continuing.',
        externalPower:
          'Please connect external power before continuing.',
      };

      setGuidedChecklistKey(key);
      Alert.alert(
        'Action required',
        correctiveMessages[key] ||
          'Please correct this setup item before continuing.'
      );
      return;
    }

    setGuidedChecklistKey(nextKey || null);

    if (!nextKey) {
      scrollToSection(section, section === 'start' ? 420 : 300);
    }
  };

  const focusStartChecklist = () => {
    Keyboard.dismiss();
    setGuidedChecklistKey('levelledStart');
    scrollToSection('start', 390);
  };

  const focusEndChecklist = () => {
    Keyboard.dismiss();
    setGuidedChecklistKey('levelledEnd');
    scrollToSection('end', 220);
  };

  const updateHmpWithGuidance = (
    key,
    value,
    nextStep,
    timerRef
  ) => {
    if (arpBqrRetryRequired) {
      setArpBqrHeightRetried(true);
    }

    updateField(key, value);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!hasMinimumHeightDigits(value)) return;

    timerRef.current = setTimeout(() => {
      nextStep?.();
    }, 650);
  };

  const updateBqrWithGuidance = (value) => {
    if (arpBqrRetryRequired) {
      setArpBqrHeightRetried(true);
    }

    updateField('bqrStart', value);

    if (bqrAdvanceTimer.current) {
      clearTimeout(bqrAdvanceTimer.current);
    }

    if (!hasMinimumHeightDigits(value)) return;

    bqrAdvanceTimer.current = setTimeout(() => {
      focusStartChecklist();
    }, 850);
  };

  useEffect(
    () => () => {
      if (hmpStartAdvanceTimer.current) {
        clearTimeout(hmpStartAdvanceTimer.current);
      }
      if (hmpEndAdvanceTimer.current) {
        clearTimeout(hmpEndAdvanceTimer.current);
      }
      if (bqrAdvanceTimer.current) {
        clearTimeout(bqrAdvanceTimer.current);
      }
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
      clearReviewInputVisibilityWork();
    },
    []
  );

  useEffect(() => {
    saveRecordRef.current = saveActiveSE14Record;
  }, [saveActiveSE14Record]);

  useEffect(() => {
    if (!isInProgress) return undefined;

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = setTimeout(() => {
      saveRecordRef.current?.({ silent: true });
    }, 700);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, [isInProgress, se14]);

  useEffect(() => {
    if (sessionDetailsCompleted === SESSION_DETAIL_KEYS.length) {
      setShowSessionDetails(false);
      if (startCompleted < START_KEYS.length) {
        setShowSessionStart(true);
      }
    }
  }, [sessionDetailsCompleted, startCompleted]);

  useEffect(() => {
    if (startCompleted === START_KEYS.length) {
      setOpenDropdown(null);
      setShowSessionStart(false);
    }
  }, [startCompleted]);

  useEffect(() => {
    if (endCompleted === END_KEYS.length) {
      setOpenDropdown(null);
      setShowSessionEnd(false);
    }
  }, [endCompleted]);

  useEffect(() => {
    const loadLastObserver = async () => {
      try {
        const [lastObserver, lastProjectNumber] =
          await Promise.all([
            AsyncStorage.getItem(
              LAST_SE14_OBSERVER_KEY
            ),
            AsyncStorage.getItem(
              LAST_SE14_PROJECT_KEY
            ),
          ]);

        setSE14((currentForm) => {
          const withProfileDefaults = applyProfileDefaults(
            currentForm,
            accountProfile,
            'se14'
          );

          return {
            ...withProfileDefaults,
            observer:
              withProfileDefaults.observer ||
              lastObserver ||
              '',
            projectNumber:
              activeJob?.number ||
              withProfileDefaults.projectNumber ||
              lastProjectNumber ||
              '',
          };
        });
      } catch (error) {
        console.log(
          'Could not load last SE-14 observer:',
          error
        );
      }
    };

    loadLastObserver();
  }, [accountProfile, activeJob?.number, setSE14]);

  useEffect(() => {
    const loadCustomReceiverSerials = async () => {
      try {
        const savedSerials = await AsyncStorage.getItem(
          CUSTOM_RECEIVER_SERIALS_KEY
        );

        if (!savedSerials) {
          return;
        }

        const parsedSerials = JSON.parse(savedSerials);

        if (
          parsedSerials &&
          typeof parsedSerials === 'object' &&
          !Array.isArray(parsedSerials)
        ) {
          setCustomReceiverSerials(parsedSerials);
        }
      } catch (error) {
        console.log(
          'Could not load custom receiver serials:',
          error
        );
      }
    };

    loadCustomReceiverSerials();
  }, []);

  useEffect(() => {
    const loadCustomMarkTypes = async () => {
      try {
        const savedMarkTypes = await AsyncStorage.getItem(
          CUSTOM_MARK_TYPES_KEY
        );

        if (!savedMarkTypes) {
          return;
        }

        const parsedMarkTypes = JSON.parse(savedMarkTypes);

        if (Array.isArray(parsedMarkTypes)) {
          setCustomMarkTypes(parsedMarkTypes);
        }
      } catch (error) {
        console.log(
          'Could not load custom mark types:',
          error
        );
      }
    };

    loadCustomMarkTypes();
  }, []);

  const selectObserver = async (name) => {
    updateField('observer', name);
    setOpenDropdown(null);
    setShowSessionDetails(true);
    focusFieldStep(markIdRef, 'details');

    try {
      await AsyncStorage.setItem(
        LAST_SE14_OBSERVER_KEY,
        name
      );
    } catch (error) {
      console.log(
        'Could not save last SE-14 observer:',
        error
      );
    }
  };

  const updateProjectNumber = async (value) => {
    updateField('projectNumber', value);

    try {
      if (String(value || '').trim()) {
        await AsyncStorage.setItem(
          LAST_SE14_PROJECT_KEY,
          value
        );
      } else {
        await AsyncStorage.removeItem(
          LAST_SE14_PROJECT_KEY
        );
      }
    } catch (error) {
      console.log(
        'Could not save last SE-14 project number:',
        error
      );
    }
  };

  const selectDropdownValue = (key, value, nextStep) => {
    updateField(key, value);
    setOpenDropdown(null);
    nextStep?.();
  };

  const markTypeOptions = [
    ...MARK_TYPE_OPTIONS,
    ...customMarkTypes,
  ];

  const addMarkType = () => {
    Alert.prompt(
      'Add Mark Type',
      'Enter the new mark type. It will be saved to the Mark Type list on this phone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: async (enteredValue) => {
            const newMarkType = String(
              enteredValue || ''
            ).trim();

            if (!newMarkType) {
              Alert.alert(
                'Mark type required',
                'Enter a mark type to add.'
              );
              return;
            }

            const existingMarkType = markTypeOptions.find(
              (markType) =>
                markType.toLowerCase() ===
                newMarkType.toLowerCase()
            );

            if (existingMarkType) {
              updateField(
                'markType',
                existingMarkType
              );
              setOpenDropdown(null);
              Alert.alert(
                'Already saved',
                `${existingMarkType} is already in the Mark Type list.`
              );
              return;
            }

            const updatedMarkTypes = [
              ...customMarkTypes,
              newMarkType,
            ];

            try {
              await AsyncStorage.setItem(
                CUSTOM_MARK_TYPES_KEY,
                JSON.stringify(updatedMarkTypes)
              );

              setCustomMarkTypes(updatedMarkTypes);
              updateField('markType', newMarkType);
              openDropdownStep('receiverModel', 'details', 120);
            } catch (error) {
              Alert.alert(
                'Could not save mark type',
                String(error?.message || error)
              );
            }
          },
        },
      ],
      'plain-text',
      '',
      'words'
    );
  };

  const selectReceiver = (receiverModel) => {
    const measuredTo = getMeasuredToForReceiver(receiverModel);

    setSE14((currentForm) => ({
      ...currentForm,
      receiverModel,
      receiverSerial: '',
      measuredToStart:
        measuredTo || currentForm.measuredToStart || '',
      measuredToEnd:
        measuredTo || currentForm.measuredToEnd || '',
    }));
    openDropdownStep('receiverSerial', 'details', 175);
  };

  const receiverSerialOptions = [
    ...(RECEIVER_SERIAL_OPTIONS[
      se14.receiverModel
    ] || []),
    ...(customReceiverSerials[
      se14.receiverModel
    ] || []),
  ];

  const addReceiverSerial = () => {
    if (!se14.receiverModel) {
      Alert.alert(
        'Select a receiver first',
        'Choose the receiver model before adding its serial number.'
      );
      return;
    }

    Alert.prompt(
      'Add Receiver S/N',
      `Enter the serial number for ${se14.receiverModel}. It will be saved to this receiver list on the phone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: async (enteredValue) => {
            const newSerial = String(
              enteredValue || ''
            ).trim();

            if (!newSerial) {
              Alert.alert(
                'Serial number required',
                'Enter a receiver serial number.'
              );
              return;
            }

            const existingSerial =
              receiverSerialOptions.find(
                (serial) =>
                  serial.toLowerCase() ===
                  newSerial.toLowerCase()
              );

            if (existingSerial) {
              updateField(
                'receiverSerial',
                existingSerial
              );
              setOpenDropdown(null);
              Alert.alert(
                'Already saved',
                `${existingSerial} is already in the ${se14.receiverModel} list.`
              );
              return;
            }

            const updatedCustomSerials = {
              ...customReceiverSerials,
              [se14.receiverModel]: [
                ...(customReceiverSerials[
                  se14.receiverModel
                ] || []),
                newSerial,
              ],
            };

            try {
              await AsyncStorage.setItem(
                CUSTOM_RECEIVER_SERIALS_KEY,
                JSON.stringify(updatedCustomSerials)
              );

              setCustomReceiverSerials(
                updatedCustomSerials
              );
              updateField(
                'receiverSerial',
                newSerial
              );
              setShowSessionStart(true);
              focusFieldStep(hmpStartRef, 'start', 95);
            } catch (error) {
              Alert.alert(
                'Could not save receiver',
                String(error?.message || error)
              );
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  useEffect(() => {
    const measuredTo = getMeasuredToForReceiver(
      se14.receiverModel
    );

    if (!measuredTo) return;

    setSE14((currentForm) => {
      const nextForm = {
        ...currentForm,
        measuredToStart:
          currentForm.measuredToStart || measuredTo,
        measuredToEnd:
          currentForm.measuredToEnd || measuredTo,
      };

      return nextForm.measuredToStart === currentForm.measuredToStart &&
        nextForm.measuredToEnd === currentForm.measuredToEnd
        ? currentForm
        : nextForm;
    });
  }, [se14.receiverModel, setSE14]);

  useEffect(() => {
    const antennaValues =
      RECEIVER_ANTENNA_VALUES[se14.receiverModel];
    const hmp = parseMeasurement(se14.hmpStart);
    const bqr = parseMeasurement(se14.bqrStart);

    if (!antennaValues || hmp === null || bqr === null) {
      return;
    }

    const squaredHeight = hmp ** 2;
    const squaredRadius = antennaValues.radius ** 2;

    if (squaredHeight < squaredRadius) {
      return;
    }

    const arpHeight =
      Math.sqrt(squaredHeight - squaredRadius) +
      antennaValues.groundPlaneOffset;
    const calculatedCheck = Math.abs(arpHeight - bqr)
      .toFixed(4);

    setSE14((currentForm) =>
      currentForm.arpBqr === calculatedCheck
        ? currentForm
        : {
            ...currentForm,
            arpBqr: calculatedCheck,
          }
    );
  }, [
    se14.receiverModel,
    se14.hmpStart,
    se14.bqrStart,
    setSE14,
  ]);

  useEffect(() => {
    if (
      isInProgress ||
      isReview ||
      !hasMinimumHeightDigits(se14.hmpStart) ||
      !hasMinimumHeightDigits(se14.bqrStart) ||
      arpBqrValue === null
    ) {
      return;
    }

    if (arpBqrWithinTolerance) {
      setArpBqrRetryRequired(false);
      setArpBqrHeightRetried(false);
      return;
    }

    setArpBqrRetryRequired(true);

    if (hmpStartAdvanceTimer.current) {
      clearTimeout(hmpStartAdvanceTimer.current);
    }
    if (bqrAdvanceTimer.current) {
      clearTimeout(bqrAdvanceTimer.current);
    }

    setShowSessionStart(true);
    setGuidedChecklistKey(null);
    scrollToSection('start', 95);
  }, [
    se14.hmpStart,
    se14.bqrStart,
    se14.arpBqr,
    arpBqrValue,
    arpBqrWithinTolerance,
    isInProgress,
    isReview,
    arpBqrRetryRequired,
  ]);

  const setStartDateAndTimeToNow = () => {
    setSE14((currentForm) => ({
      ...currentForm,
      startDate: getTodayDate(),
      startTime: getCurrentTime(),
    }));
  };

  const setEndDateAndTimeToNow = () => {
    setSE14((currentForm) => ({
      ...currentForm,
      endDate: getTodayDate(),
      endTime: getCurrentTime(),
    }));
  };

  const rememberSectionPosition = (section, event) => {
    sectionY.current[section] = event.nativeEvent.layout.y;
  };

  const openSectionForIssue = (section) => {
    if (section === 'details') setShowSessionDetails(true);
    if (section === 'start') setShowSessionStart(true);
    if (section === 'end') setShowSessionEnd(true);
    if (section === 'files') setShowFiles(true);
    if (section === 'comments') setShowComments(true);
  };

  const snapToIssue = (issue) => {
    openSectionForIssue(issue.section);
    setOpenDropdown(null);
    Keyboard.dismiss();

    const issueOffsets = {
      observer: 0,
      markId: 0,
      sessionNumber: 35,
      markType: 80,
      receiverModel: 120,
      receiverSerial: 175,
      hmpStart: 95,
      measuredToStart: 25,
      bqrStart: 205,
      arpBqr: 285,
      levelledStart: 390,
      antennaNorth: 455,
      externalPower: 520,
      startDate: 620,
      startTime: 690,
      photoStartMarkId: 790,
      photoStartReceiverSerial: 1020,
      photoStartHeightMeasurement: 1270,
      photoStartBubble: 1510,
      photoStartObstructions: 1900,
      hmpEnd: 30,
      measuredToEnd: 25,
      levelledEnd: 220,
      powerStillOn: 285,
      markConfirmed: 350,
      endDate: 450,
      endTime: 515,
      photoEndMarkId: 610,
      photoEndHeightMeasurement: 830,
      rawGnssFile: 35,
      rinexFile: 85,
    };
    const dropdownKeys = new Set([
      'observer',
      'sessionNumber',
      'markType',
      'receiverModel',
      'receiverSerial',
      'measuredToStart',
      'measuredToEnd',
    ]);
    const checklistKeys = new Set([
      'levelledStart',
      'antennaNorth',
      'externalPower',
      'levelledEnd',
      'powerStillOn',
      'markConfirmed',
    ]);
    const inputRefs = {
      markId: markIdRef,
      hmpStart: hmpStartRef,
      bqrStart: bqrStartRef,
      arpBqr: hmpStartRef,
      hmpEnd: hmpEndRef,
      rawGnssFile: rawFileRef,
      rinexFile: rinexFileRef,
    };

    setTimeout(() => {
      if (dropdownKeys.has(issue.key)) {
        setOpenDropdown(issue.key);
      }
      if (checklistKeys.has(issue.key)) {
        setGuidedChecklistKey(issue.key);
      }

      scrollToSection(
        issue.section,
        issueOffsets[issue.key] || 0
      );

      if (inputRefs[issue.key]) {
        setTimeout(() => inputRefs[issue.key].current?.focus(), 260);
      }
    }, 140);
  };

  const showIssue = (issue) => {
    Alert.alert(
      'More information required',
      issue.message,
      [
        {
          text: 'Go to missing item',
          onPress: () => snapToIssue(issue),
        },
      ]
    );
  };

  const moveToEndSession = async () => {
    if (arpBqrRetryRequired && !arpBqrHeightRetried) {
      showIssue({
        key: 'arpBqr',
        section: 'start',
        message:
          'ARP-BQR is outside the required tolerance. Re-enter either the HMP or BQR measurement before continuing.',
      });
      return;
    }

    const issue = getSE14StartIssue(se14);

    if (issue) {
      showIssue(issue);
      return;
    }

    await saveSE14AsInProgress();
  };

  const finishFieldSession = async () => {
    const issue = getSE14FieldCompletionIssue(se14);

    if (issue) {
      showIssue(issue);
      return;
    }

    await completeSE14FieldSession?.();
  };

  const prepareAndExportPdf = async () => {
    if (isPreparingPdf) return;

    const issue = getSE14CompletionIssue(se14);

    if (issue) {
      showIssue(issue);
      return;
    }

    setIsPreparingPdf(true);

    try {
      await exportSE14Pdf(
        () => setIsPreparingPdf(false),
        () => setScreen('sessionCompleted')
      );
    } finally {
      setIsPreparingPdf(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Animated.View
        style={[
          gnssStyles.compactHeader,
          { height: insets.top + 78 },
          {
            opacity: compactHeaderOpacity,
            transform: [{ translateY: compactHeaderTranslate }],
          },
        ]}
      >
        <ImageBackground
          source={require('../../assets/topo-bg.png')}
          style={[
            gnssStyles.compactHeaderBackground,
            { paddingTop: insets.top },
          ]}
          imageStyle={gnssStyles.compactHeaderImage}
        >
          <View style={gnssStyles.compactHeaderShade} />
          <AppBackButton
            label={backLabel}
            style={gnssStyles.compactBackButton}
            onPress={() => setScreen('formMenu')}
          />

          <View style={gnssStyles.compactHeaderCopy}>
            <Text style={gnssStyles.compactTitle} numberOfLines={1}>
              {headerMark}
            </Text>
            <Text style={gnssStyles.compactSession} numberOfLines={1}>{headerSession}</Text>
          </View>

          <View style={gnssStyles.compactHeaderSpacer} />
        </ImageBackground>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          gnssStyles.scrollContainer,
          {
            paddingBottom: keyboardHeight > 0
              ? keyboardHeight + 240
              : Math.max(insets.bottom, 12),
          },
        ]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >

      <ImageBackground
        source={require('../../assets/topo-bg.png')}
        style={[
          gnssStyles.hero,
          { paddingTop: insets.top },
        ]}
        imageStyle={gnssStyles.heroImage}
      >
        <View style={gnssStyles.heroShade} />

        <View style={gnssStyles.topBar}>
          <AppBackButton
            label={backLabel}
            style={gnssStyles.topAction}
            onPress={() => setScreen('formMenu')}
          />

          <View
            style={[
              gnssStyles.stagePill,
              isReview && gnssStyles.stagePillComplete,
            ]}
          >
            <Text
              style={[
                gnssStyles.stagePillText,
                isReview && gnssStyles.stagePillTextComplete,
              ]}
            >
              {isReview
                ? recordStatus === 'complete'
                  ? 'EXPORTED'
                  : 'REVIEW'
                : isInProgress
                  ? 'END SESSION'
                  : 'START SESSION'}
            </Text>
          </View>

          {!isInProgress ? (
            <TouchableOpacity
              style={[gnssStyles.topAction, gnssStyles.topActionRight]}
              onPress={() =>
                clearSE14?.(returnToSessionDetailsMarkId)
              }
            >
              <Text style={gnssStyles.topActionText}>Clear</Text>
            </TouchableOpacity>
          ) : (
            <View style={gnssStyles.topAction} />
          )}
        </View>

        <Text style={gnssStyles.eyebrow}>SE-14 · STATIC OBSERVATION</Text>
        <Text
          style={[
            gnssStyles.title,
            isInProgress && gnssStyles.endTitle,
          ]}
        >
          {isReview
            ? 'Review and Complete'
            : isInProgress
              ? 'End Session'
              : 'Start Session'}
        </Text>
        <View style={gnssStyles.headerIdentity}>
          <Text style={gnssStyles.headerPm}>{headerMark}</Text>
          <Text style={gnssStyles.headerSession}>{headerSession}</Text>
        </View>
      </ImageBackground>

      <View
        style={styles.scrollContent}
        onLayout={(event) => {
          bodyY.current = event.nativeEvent.layout.y;
        }}
      >
        {!isInProgress ? (
          <View
            style={styles.projectDetailsCard}
            onLayout={(event) => rememberSectionPosition('project', event)}
          >
            <DropdownField
              label="Observer"
              value={se14.observer}
              placeholder="Select observer"
              options={STAFF_NAMES}
              open={openDropdown === 'observer'}
              onToggle={() =>
                setOpenDropdown(openDropdown === 'observer' ? null : 'observer')
              }
              onSelect={selectObserver}
            />
          </View>
        ) : null}

        {isReview ? (
          <>
          <View style={gnssStyles.reviewObserverCard}>
            <Text style={gnssStyles.summaryLabel}>OBSERVER</Text>
            <Text style={gnssStyles.summaryValue}>{se14.observer || '—'}</Text>
          </View>
          <Text style={gnssStyles.reviewObserverSubtitle}>
            {recordStatus === 'complete'
              ? 'Exported record'
              : 'Review details and add office filenames'}
          </Text>

          <View style={gnssStyles.reviewSummaryCard}>
            <View style={gnssStyles.reviewSummaryHeader}>
              <View style={gnssStyles.reviewSummaryHeading}>
                <Text style={gnssStyles.reviewSummaryTitle}>Start Details</Text>
                <Text style={gnssStyles.reviewSummarySubtitle}>
                  {se14.projectNumber || '—'} · {headerMark} · Session {se14.sessionNumber || '—'}
                </Text>
              </View>
              <TouchableOpacity
                style={gnssStyles.unlockButton}
                activeOpacity={0.82}
                onPress={() => {
                  setEditStartDetails((current) => !current);
                  setShowSessionDetails(true);
                  setShowSessionStart(true);
                }}
              >
                <Text style={gnssStyles.unlockButtonText}>
                  {editStartDetails ? 'LOCK' : 'UNLOCK & EDIT'}
                </Text>
              </TouchableOpacity>
            </View>
            {!editStartDetails ? (
              <View style={gnssStyles.lockedSummary}>
                <View style={gnssStyles.summaryCell}>
                  <Text style={gnssStyles.summaryLabel}>JOB</Text>
                  <Text style={gnssStyles.summaryValue}>{se14.projectNumber || '—'}</Text>
                </View>
                <View style={gnssStyles.summaryCell}>
                  <Text style={gnssStyles.summaryLabel}>PM / MARK</Text>
                  <Text style={gnssStyles.summaryValue}>{se14.markId || '—'}</Text>
                </View>
                <View style={gnssStyles.summaryCell}>
                  <Text style={gnssStyles.summaryLabel}>SESSION</Text>
                  <Text style={gnssStyles.summaryValue}>{se14.sessionNumber || '—'}</Text>
                </View>
                <View style={gnssStyles.summaryCell}>
                  <Text style={gnssStyles.summaryLabel}>START HMP</Text>
                  <Text style={gnssStyles.summaryValue}>
                    {se14.hmpStart ? `${se14.hmpStart} m` : '—'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          </>
        ) : null}

        {(!isInProgress || (isReview && editStartDetails)) && (
          <>

        <View onLayout={(event) => rememberSectionPosition('details', event)}>
        <CollapseSection
          title="Session Details"
          subtitle={`${sessionDetailsCompleted} of ${SESSION_DETAIL_KEYS.length} fields completed`}
          workflow
          complete={sessionDetailsComplete}
          current={!sessionDetailsComplete}
          open={showSessionDetails}
          onToggle={() =>
            setShowSessionDetails(!showSessionDetails)
          }
        >

          <View style={styles.formFieldPair}>
            <View style={styles.formFieldPairItem}>
              <Field
                label="Mark ID"
                inputRef={markIdRef}
                value={se14.markId}
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={() =>
                  openDropdownStep('sessionNumber', 'details', 40)
                }
                onChangeText={(value) =>
                  updateField('markId', value)
                }
              />
            </View>

            <View style={styles.formFieldPairItem}>
              <DropdownField
                label="Session Number"
                value={se14.sessionNumber}
                placeholder="Select"
                options={SESSION_NUMBER_OPTIONS}
                open={openDropdown === 'sessionNumber'}
                onToggle={() =>
                  setOpenDropdown(
                    openDropdown === 'sessionNumber'
                      ? null
                      : 'sessionNumber'
                  )
                }
                onSelect={(value) =>
                  selectDropdownValue(
                    'sessionNumber',
                    value,
                    () => openDropdownStep('markType', 'details', 80)
                  )
                }
              />
            </View>
          </View>

          <DropdownField
            label="Mark Type"
            value={se14.markType}
            placeholder="Select mark type"
            options={markTypeOptions}
            open={openDropdown === 'markType'}
            onToggle={() =>
              setOpenDropdown(
                openDropdown === 'markType'
                  ? null
                  : 'markType'
              )
            }
            onSelect={(value) =>
              selectDropdownValue('markType', value, () =>
                openDropdownStep('receiverModel', 'details', 120)
              )
            }
          />

          <TouchableOpacity
            style={styles.compactAddButton}
            activeOpacity={0.8}
            onPress={addMarkType}
          >
            <Text style={styles.compactAddButtonText}>
              + Add Mark Type
            </Text>
          </TouchableOpacity>

          <DropdownField
            label="Receiver"
            value={se14.receiverModel}
            placeholder="Select receiver"
            options={RECEIVER_OPTIONS}
            open={openDropdown === 'receiverModel'}
            onToggle={() =>
              setOpenDropdown(
                openDropdown === 'receiverModel'
                  ? null
                  : 'receiverModel'
              )
            }
            onSelect={selectReceiver}
          />

          <DropdownField
            label="Receiver S/N"
            value={se14.receiverSerial}
            placeholder={
              se14.receiverModel
                ? 'Select receiver serial number'
                : 'Select receiver first'
            }
            options={receiverSerialOptions}
            open={openDropdown === 'receiverSerial'}
            onToggle={() => {
              if (!se14.receiverModel) {
                return;
              }

              setOpenDropdown(
                openDropdown === 'receiverSerial'
                  ? null
                  : 'receiverSerial'
              );
            }}
            onSelect={(value) =>
              selectDropdownValue(
                'receiverSerial',
                value,
                () => {
                  setShowSessionDetails(false);
                  setShowSessionStart(true);
                  focusFieldStep(hmpStartRef, 'start', 95);
                }
              )
            }
          />

          <TouchableOpacity
            style={styles.compactAddButton}
            activeOpacity={0.8}
            onPress={addReceiverSerial}
          >
            <Text style={styles.compactAddButtonText}>
              + Add Receiver S/N
            </Text>
          </TouchableOpacity>
        </CollapseSection>
        </View>

        <View onLayout={(event) => rememberSectionPosition('start', event)}>
        <CollapseSection
          title="Session Start"
          subtitle={`${startCompleted} of ${START_KEYS.length} items completed`}
          workflow
          complete={sessionStartComplete}
          current={sessionDetailsComplete && !sessionStartComplete}
          open={showSessionStart}
          onToggle={() =>
            setShowSessionStart(
              !showSessionStart
            )
          }
        >
          <Text style={styles.groupLabel}>
            Antenna Height & Check
          </Text>
<TouchableOpacity
  style={styles.secondaryButton}
  activeOpacity={0.8}
  onPress={() =>
    setScreen('se14MeasurementGuide')
  }
>
  <Text style={styles.secondaryButtonText}>
    View Antenna Measurement Guide
  </Text>
</TouchableOpacity>
          <DropdownField
            label="Measured To"
            value={se14.measuredToStart}
            placeholder="Select measurement point"
            options={MEASURED_TO_OPTIONS}
            open={openDropdown === 'measuredToStart'}
            onToggle={() =>
              setOpenDropdown(
                openDropdown === 'measuredToStart'
                  ? null
                  : 'measuredToStart'
              )
            }
            onSelect={(value) => {
              if (hmpStartAdvanceTimer.current) {
                clearTimeout(hmpStartAdvanceTimer.current);
              }
              selectDropdownValue(
                'measuredToStart',
                value,
                () => focusFieldStep(hmpStartRef, 'start', 95)
              );
            }}
          />

          <Field
            label="Height (HMP)"
            helperText="Lever"
            inputRef={hmpStartRef}
            value={se14.hmpStart}
            placeholder="Metres"
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => {
              if (hmpStartAdvanceTimer.current) {
                clearTimeout(hmpStartAdvanceTimer.current);
              }
              focusFieldStep(bqrStartRef, 'start', 205);
            }}
            onChangeText={(value) =>
              updateHmpWithGuidance(
                'hmpStart',
                value,
                () => focusFieldStep(bqrStartRef, 'start', 205),
                hmpStartAdvanceTimer
              )
            }
          />

          <Field
            label="Height (BQR)"
            helperText="Bottom of quick release"
            inputRef={bqrStartRef}
            value={se14.bqrStart}
            placeholder="Metres"
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (bqrAdvanceTimer.current) {
                clearTimeout(bqrAdvanceTimer.current);
              }
              focusStartChecklist();
            }}
            onChangeText={(value) =>
              updateBqrWithGuidance(value)
            }
          />

          <Field
            label="ARP-BQR"
            value={se14.arpBqr}
            placeholder="Example: 0.003"
            keyboardType="decimal-pad"
            onChangeText={(value) =>
              updateField(
                'arpBqr',
                value
              )
            }
          />

          <Text
            style={[
              styles.cardSubtitle,
              arpBqrValue !== null && {
                color: arpBqrWithinTolerance
                  ? '#92D050'
                  : '#FF8A80',
                fontWeight: '900',
              },
            ]}
          >
            {arpBqrValue === null
              ? 'Required tolerance: ARP-BQR must be within ±0.005 m.'
              : arpBqrWithinTolerance
                ? 'Within tolerance: ARP-BQR is within ±0.005 m.'
                : 'Outside tolerance: repeat the measurements.'}
          </Text>

          <Text style={styles.groupLabel}>
            🟢 Start Setup Checklist
          </Text>

          <YesNoChecklistRow
            label="🎯 Levelled & centred"
            value={se14.levelledStart}
            active={guidedChecklistKey === 'levelledStart'}
            onChange={(value) =>
              answerChecklist(
                'levelledStart',
                value,
                'antennaNorth',
                'start'
              )
            }
          />

          <YesNoChecklistRow
            label="🧭 Antenna oriented north"
            value={se14.antennaNorth}
            active={guidedChecklistKey === 'antennaNorth'}
            onChange={(value) =>
              answerChecklist(
                'antennaNorth',
                value,
                'externalPower',
                'start'
              )
            }
          />

          <YesNoChecklistRow
            label="🔋 External power connected"
            value={se14.externalPower}
            active={guidedChecklistKey === 'externalPower'}
            onChange={(value) =>
              answerChecklist(
                'externalPower',
                value,
                null,
                'start'
              )
            }
          />

          <Text style={styles.groupLabel}>
            Start Date & Time
          </Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() => {
              setStartDateAndTimeToNow();
              scrollToSection('start', 620);
            }}
          >
            <Text style={styles.secondaryButtonText}>
              Set Start Date & Time to Now
            </Text>
          </TouchableOpacity>

          <Field
            label="Start Date"
            value={se14.startDate}
            placeholder="DD/MM/YYYY"
            onChangeText={(value) =>
              updateField('startDate', value)
            }
          />

          <Field
            label="Start Time"
            value={se14.startTime}
            placeholder="HH:MM"
            onChangeText={(value) =>
              updateField('startTime', value)
            }
          />

          <Text style={styles.groupLabel}>
            Start Photos
          </Text>

          <SE14PhotoField
            label="1. Mark ID"
            value={se14.photoStartMarkId}
            photoType="Start_Mark_ID"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            onChange={(value) =>
              updateField(
                'photoStartMarkId',
                value
              )
            }
            onAccepted={() => scrollToSection('start', 905)}
          />

          <SE14PhotoField
            label="2. Receiver serial number"
            value={se14.photoStartReceiverSerial}
            photoType="Start_Receiver_Serial"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            tagText={`S/N: ${se14.receiverSerial || '—'}`}
            onChange={(value) =>
              updateField(
                'photoStartReceiverSerial',
                value
              )
            }
            onAccepted={() => scrollToSection('start', 1160)}
          />

          <SE14PhotoField
            label="3. Height measurement"
            value={se14.photoStartHeightMeasurement}
            photoType="Start_Height_Measurement"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            tagText={`HMP: ${se14.hmpStart || '—'} m`}
            onChange={(value) =>
              updateField(
                'photoStartHeightMeasurement',
                value
              )
            }
            onAccepted={() => scrollToSection('start', 1415)}
          />

          <SE14PhotoField
            label="4. Bubble"
            value={se14.photoStartBubble}
            photoType="Start_Bubble"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            onChange={(value) =>
              updateField(
                'photoStartBubble',
                value
              )
            }
            onAccepted={() => scrollToSection('start', 1900)}
          />

          <SE14PhotoField
            label="5. Plummet (optional)"
            value={se14.photoStartPlummet}
            photoType="Start_Plummet"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            optional
            onChange={(value) =>
              updateField(
                'photoStartPlummet',
                value
              )
            }
            onAccepted={() => scrollToSection('start', 1900)}
          />

          <SE14PhotoField
            label="6. Obstructions"
            value={se14.photoStartObstructions}
            photoType="Start_Obstructions"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            onChange={(value) =>
              updateField(
                'photoStartObstructions',
                value
              )
            }
            onAccepted={() => {
              setShowSessionStart(false);
              scrollToSection('start', 2190);
            }}
          />
        </CollapseSection>
        </View>

          </>
        )}

        {isInProgress && (
          <>
        {isReview ? (
          <View style={gnssStyles.reviewSummaryCard}>
            <View style={gnssStyles.reviewSummaryHeader}>
              <View style={gnssStyles.reviewSummaryHeading}>
                <Text style={gnssStyles.reviewSummaryTitle}>End Details</Text>
              </View>
              <TouchableOpacity
                style={gnssStyles.unlockButton}
                activeOpacity={0.82}
                onPress={() => {
                  setEditEndDetails((current) => !current);
                  setShowSessionEnd(true);
                }}
              >
                <Text style={gnssStyles.unlockButtonText} numberOfLines={1}>
                  {editEndDetails ? 'LOCK' : 'UNLOCK & EDIT'}
                </Text>
              </TouchableOpacity>
            </View>
            {!editEndDetails ? (
            <View style={gnssStyles.lockedSummary}>
              <View style={gnssStyles.summaryCell}>
                <Text style={gnssStyles.summaryLabel}>START HMP</Text>
                <Text style={gnssStyles.summaryValue}>
                  {se14.hmpStart ? `${se14.hmpStart} m` : '—'}
                </Text>
              </View>
              <View style={gnssStyles.summaryCell}>
                <Text style={gnssStyles.summaryLabel}>END HMP</Text>
                <Text style={gnssStyles.summaryValue}>
                  {se14.hmpEnd ? `${se14.hmpEnd} m` : '—'}
                </Text>
              </View>
              <View style={gnssStyles.summaryCell}>
                <Text style={gnssStyles.summaryLabel}>MEASURED TO</Text>
                <Text style={gnssStyles.summaryValue} numberOfLines={2}>
                  {se14.measuredToEnd || '—'}
                </Text>
              </View>
              <View style={gnssStyles.summaryWideCell}>
                <Text style={gnssStyles.summaryLabel}>ENDED</Text>
                <Text style={gnssStyles.summaryValue}>
                  {se14.endDate || '—'} {se14.endTime || ''}
                </Text>
              </View>
            </View>
            ) : null}

            <View
              onLayout={(event) => rememberSectionPosition('files', event)}
              style={gnssStyles.reviewNestedSection}
            >
              <TouchableOpacity
                style={gnssStyles.reviewNestedRow}
                activeOpacity={0.82}
                onPress={() => {
                  if (showFiles) {
                    Keyboard.dismiss();
                    setShowFiles(false);
                  } else {
                    openReviewSection('files', setShowFiles, rawFileRef);
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: showFiles }}
              >
                <View style={gnssStyles.reviewNestedRowCopy}>
                  <Text style={gnssStyles.reviewNestedTitle}>Data Files</Text>
                  <Text style={gnssStyles.reviewNestedSubtitle}>
                    {filesCompleted ? `${filesCompleted} of ${FILE_KEYS.length} entered` : 'Optional · 0 of 2 entered'}
                  </Text>
                </View>
                <Text style={gnssStyles.reviewNestedAction}>
                  {showFiles ? '⌃' : '+'}
                </Text>
              </TouchableOpacity>

              {showFiles ? (
                <View style={gnssStyles.reviewNestedContent}>
                  <Field
                    label="Raw GNSS Data Filename"
                    inputRef={rawFileRef}
                    value={se14.rawGnssFile}
                    returnKeyType="next"
                    onFocus={() => revealReviewInput('files')}
                    onSubmitEditing={() =>
                      focusReviewInputStep(rinexFileRef, 'files', 85)
                    }
                    onChangeText={(value) =>
                      updateField('rawGnssFile', value)
                    }
                  />

                  <Field
                    label="RINEX Data Filename"
                    inputRef={rinexFileRef}
                    value={se14.rinexFile}
                    returnKeyType="done"
                    onFocus={() => revealReviewInput('files', 85)}
                    onSubmitEditing={() => {
                      Keyboard.dismiss();
                      setShowFiles(false);
                    }}
                    onChangeText={(value) =>
                      updateField('rinexFile', value)
                    }
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {(!isReview || editEndDetails) ? (
        <View onLayout={(event) => rememberSectionPosition('end', event)}>
        {!isReview ? (
          <View style={gnssStyles.startHmpConfirmation}>
            <View>
              <Text style={gnssStyles.startHmpLabel}>START SESSION HMP</Text>
              <Text style={gnssStyles.startHmpValue}>
                {se14.hmpStart ? `${se14.hmpStart} m` : '—'}
              </Text>
            </View>
            <Text style={gnssStyles.startHmpMeasuredTo} numberOfLines={2}>
              Measured to{`\n`}{se14.measuredToStart || '—'}
            </Text>
          </View>
        ) : null}

        <CollapseSection
          title="Session End"
          subtitle={`${endCompleted} of ${END_KEYS.length} items completed`}
          workflow
          complete={sessionEndComplete}
          current={!sessionEndComplete}
          open={showSessionEnd}
          onToggle={() =>
            setShowSessionEnd(
              !showSessionEnd
            )
          }
        >
          <DropdownField
            label="Measured To"
            value={se14.measuredToEnd}
            placeholder="Select measurement point"
            options={MEASURED_TO_OPTIONS}
            open={openDropdown === 'measuredToEnd'}
            onToggle={() =>
              setOpenDropdown(
                openDropdown === 'measuredToEnd'
                  ? null
                  : 'measuredToEnd'
              )
            }
            onSelect={(value) => {
              if (hmpEndAdvanceTimer.current) {
                clearTimeout(hmpEndAdvanceTimer.current);
              }
              selectDropdownValue(
                'measuredToEnd',
                value,
                () => focusFieldStep(hmpEndRef, 'end', 30)
              );
            }}
          />

          <Field
            label="Height (HMP)"
            helperText="Lever"
            inputRef={hmpEndRef}
            value={se14.hmpEnd}
            placeholder="Metres"
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => {
              if (hmpEndAdvanceTimer.current) {
                clearTimeout(hmpEndAdvanceTimer.current);
              }
              focusEndChecklist();
            }}
            onChangeText={(value) =>
              updateHmpWithGuidance(
                'hmpEnd',
                value,
                focusEndChecklist,
                hmpEndAdvanceTimer
              )
            }
          />

          <Text style={styles.groupLabel}>
            🔴 End Setup Checklist
          </Text>

          <YesNoChecklistRow
            label="🎯 Levelled & centred"
            value={se14.levelledEnd}
            active={guidedChecklistKey === 'levelledEnd'}
            onChange={(value) =>
              answerChecklist(
                'levelledEnd',
                value,
                'powerStillOn',
                'end'
              )
            }
          />

          <YesNoChecklistRow
            label="🔋 Power still on at end"
            value={se14.powerStillOn}
            active={guidedChecklistKey === 'powerStillOn'}
            onChange={(value) =>
              answerChecklist(
                'powerStillOn',
                value,
                'markConfirmed',
                'end'
              )
            }
          />

          <YesNoChecklistRow
            label="📍 Mark ID confirmed"
            value={se14.markConfirmed}
            active={guidedChecklistKey === 'markConfirmed'}
            onChange={(value) =>
              answerChecklist(
                'markConfirmed',
                value,
                null,
                'end'
              )
            }
          />

          <Text style={styles.groupLabel}>
            End Date & Time
          </Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() => {
              setEndDateAndTimeToNow();
              scrollToSection('end', 500);
            }}
          >
            <Text
              style={styles.secondaryButtonText}
            >
              Set End Date & Time to Now
            </Text>
          </TouchableOpacity>

          <View style={styles.formFieldPair}>
            <View style={styles.formFieldPairItem}>
              <Field
                label="End Date"
                value={se14.endDate}
                placeholder="DD/MM/YYYY"
                onChangeText={(value) =>
                  updateField('endDate', value)
                }
              />
            </View>
            <View style={styles.formFieldPairItem}>
              <Field
                label="End Time"
                value={se14.endTime}
                placeholder="HH:MM"
                onChangeText={(value) =>
                  updateField('endTime', value)
                }
              />
            </View>
          </View>

          <Text style={styles.groupLabel}>
            End Photos
          </Text>

          <SE14PhotoField
            label="7. Mark ID"
            value={se14.photoEndMarkId}
            photoType="End_Mark_ID"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            onChange={(value) =>
              updateField(
                'photoEndMarkId',
                value
              )
            }
            onAccepted={() => scrollToSection('end', 830)}
          />

          <SE14PhotoField
            label="8. Height measurement"
            value={se14.photoEndHeightMeasurement}
            photoType="End_Height_Measurement"
            markId={se14.markId}
            sessionNumber={se14.sessionNumber}
            projectNumber={se14.projectNumber}
            tagText={`HMP: ${se14.hmpEnd || '—'} m`}
            onChange={(value) =>
              updateField(
                'photoEndHeightMeasurement',
                value
              )
            }
            onAccepted={() => {
              setShowSessionEnd(false);
              scrollToSection('end', 1080);
            }}
          />
        </CollapseSection>
        </View>
        ) : null}

        {isReview ? (
          <>
        <View
          onLayout={(event) => rememberSectionPosition('comments', event)}
          style={[
            gnssStyles.reviewNestedSection,
            gnssStyles.reviewStandaloneSection,
          ]}
        >
          <TouchableOpacity
            style={gnssStyles.reviewNestedRow}
            activeOpacity={0.82}
            onPress={() => {
              if (showComments) {
                Keyboard.dismiss();
                setShowComments(false);
              } else {
                openReviewSection('comments', setShowComments, commentsRef);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: showComments }}
          >
            <View style={gnssStyles.reviewNestedRowCopy}>
              <Text style={gnssStyles.reviewNestedTitle}>Comments</Text>
              <Text style={gnssStyles.reviewNestedSubtitle}>
                {String(se14.comments || '').trim()
                  ? 'Optional comments entered'
                  : 'Optional · leave blank when not required'}
              </Text>
            </View>
            <Text style={gnssStyles.reviewNestedAction}>
              {showComments ? '⌃' : '+'}
            </Text>
          </TouchableOpacity>

          {showComments ? (
            <View style={gnssStyles.reviewNestedContent}>
              <Field
                label="Comments & Notes"
                inputRef={commentsRef}
                value={se14.comments}
                multiline
                onFocus={() => revealReviewInput('comments')}
                onChangeText={(value) =>
                  updateField(
                    'comments',
                    value
                  )
                }
              />
            </View>
          ) : null}
        </View>

          </>
        ) : null}

          </>
        )}

        {!isInProgress ? (
          <TouchableOpacity
            style={styles.exportButton}
            activeOpacity={0.8}
            onPress={moveToEndSession}
          >
            <Text style={styles.exportButtonText}>
              Session Started
            </Text>
          </TouchableOpacity>
        ) : isReview ? (
          <TouchableOpacity
              style={styles.exportButton}
              activeOpacity={0.8}
              onPress={prepareAndExportPdf}
              disabled={isPreparingPdf}
            >
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.exportButton}
            activeOpacity={0.8}
            onPress={finishFieldSession}
          >
            <Text style={styles.exportButtonText}>
              Complete Session
            </Text>
          </TouchableOpacity>
        )}
      </View>
      </Animated.ScrollView>
      {isPreparingPdf ? (
        <LoadingOverlay text="Preparing PDF…" />
      ) : null}
    </View>
  );
}

const gnssStyles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 0,
  },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 78,
    zIndex: 30,
    elevation: 12,
    overflow: 'hidden',
  },
  compactHeaderBackground: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(214,168,79,0.65)',
  },
  compactHeaderImage: {
    opacity: 0.36,
  },
  compactHeaderShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,28,48,0.83)',
  },
  compactBackButton: {
    width: 112,
  },
  compactHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  compactStage: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  compactTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  compactSession: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  compactHeaderSpacer: {
    width: 112,
  },
  compactSaveButton: {
    minWidth: 52,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(214,168,79,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.56)',
  },
  compactSaveText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '900',
  },
  hero: {
    paddingHorizontal: 17,
    paddingBottom: 17,
    overflow: 'hidden',
  },
  heroImage: {
    opacity: 0.3,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,28,48,0.68)',
  },
  topBar: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topAction: {
    width: 112,
    minHeight: 40,
    justifyContent: 'center',
  },
  topActionRight: {
    alignItems: 'flex-end',
  },
  topActionText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '900',
  },
  stagePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.62)',
    backgroundColor: 'rgba(214,168,79,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  stagePillComplete: {
    borderColor: 'rgba(76,193,121,0.72)',
    backgroundColor: 'rgba(42,157,89,0.2)',
  },
  stagePillText: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  stagePillTextComplete: {
    color: '#7FE0A4',
  },
  eyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.45,
    marginTop: 7,
  },
  title: {
    color: WHITE,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 3,
  },
  endTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    color: '#C8D5DF',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  headerIdentity: {
    marginTop: 5,
  },
  headerPm: {
    color: WHITE,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  headerSession: {
    color: GOLD,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 1,
  },
  jobBanner: {
    minHeight: 68,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.46)',
    backgroundColor: 'rgba(5,34,56,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  jobCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  jobCheckText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: '900',
  },
  jobCopy: {
    flex: 1,
  },
  jobLabel: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  jobNumber: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  jobName: {
    color: '#AFC2D2',
    fontSize: 10,
    marginTop: 1,
  },
  lockText: {
    color: '#C7D4DF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  lockedSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.28)',
    overflow: 'hidden',
    marginTop: 4,
  },
  summaryCell: {
    width: '33.333%',
    minHeight: 60,
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryWideCell: {
    width: '100%',
    minHeight: 55,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryLabel: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  unlockButton: {
    flexShrink: 0,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.58)',
    backgroundColor: 'rgba(214,168,79,0.1)',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  unlockButtonText: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  reviewSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.34)',
    backgroundColor: '#0A263E',
    padding: 13,
    marginBottom: 12,
  },
  reviewObserverCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.42)',
    backgroundColor: '#0A263E',
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 4,
  },
  reviewObserverSubtitle: {
    color: '#AFC2D2',
    fontSize: 11,
    marginBottom: 10,
  },
  reviewSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  reviewSummaryHeading: {
    flex: 1,
    minWidth: 0,
  },
  reviewSummaryTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
  },
  reviewSummarySubtitle: {
    color: '#AFC2D2',
    fontSize: 10,
    marginTop: 2,
  },
  reviewNestedSection: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.32)',
    overflow: 'hidden',
  },
  reviewStandaloneSection: {
    marginTop: 0,
    marginBottom: 12,
  },
  reviewNestedRow: {
    minHeight: 52,
    backgroundColor: '#102F49',
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewNestedRowCopy: {
    flex: 1,
  },
  reviewNestedTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '900',
  },
  reviewNestedSubtitle: {
    color: '#AFC2D2',
    fontSize: 10,
    marginTop: 2,
  },
  reviewNestedAction: {
    color: GOLD,
    fontSize: 25,
    lineHeight: 25,
    fontWeight: '900',
    marginLeft: 8,
  },
  reviewNestedContent: {
    backgroundColor: '#0A263E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(214,168,79,0.22)',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  startHmpConfirmation: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.55)',
    backgroundColor: '#1D2A31',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 14,
  },
  startHmpLabel: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  startHmpValue: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  startHmpMeasuredTo: {
    maxWidth: '52%',
    color: '#C8D5DF',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  yesNoRow: {
    minHeight: 62,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 9,
  },
  yesNoRowActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(214,168,79,0.1)',
  },
  yesNoLabel: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    paddingRight: 10,
  },
  yesNoActions: {
    flexDirection: 'row',
    gap: 7,
  },
  yesNoButton: {
    minWidth: 53,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,34,56,0.52)',
  },
  yesButtonSelected: {
    backgroundColor: '#208A4C',
    borderColor: '#58C982',
  },
  noButtonSelected: {
    backgroundColor: '#A9362E',
    borderColor: '#E07A72',
  },
  yesNoButtonText: {
    color: '#B9C7D3',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  yesNoSelectedText: {
    color: WHITE,
  },
  filedCard: {
    minHeight: 80,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#43B875',
    backgroundColor: '#0B3A2E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  filedCheck: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2EAA63',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  filedCheckText: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '900',
  },
  filedCopy: {
    flex: 1,
  },
  filedTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
  },
  filedSubtitle: {
    color: '#A9DABE',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});
