import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
} from "react-native";

import { Asset } from "expo-asset";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { NavigationContainer } from "@react-navigation/native";

import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { emptyS500, emptySE14 } from "./src/data/emptyForms";

import {
  exportS500Pdf as exportS500PdfFile,
  emailS500Pdf as emailS500PdfFile,
} from "./src/export/exportS500Pdf";

import { exportSE14Pdf as exportSE14PdfFile } from "./src/export/exportSE14Pdf";

import IntroScreen from "./src/screens/IntroScreen";
import HomeScreen from "./src/screens/HomeScreen";
import FieldToolsScreen from "./src/features/fieldTools/screens/FieldToolsScreen";
import FeatureScannerScreen from "./src/features/scanner/screens/FeatureScannerScreen";
import S500FormScreen from "./src/screens/S500FormScreen";
import S500RiskGuideScreen from "./src/screens/S500RiskGuideScreen";
import SE14FormScreen from "./src/screens/SE14FormScreen";
import S501FormScreen from "./src/screens/S501FormScreen";
import S506FormScreen from "./src/screens/S506FormScreen";
import SE14MeasurementGuideScreen from "./src/screens/SE14MeasurementGuideScreen";
import SE14InProgressScreen from "./src/screens/SE14InProgressScreen";

import {
  createSE14Record,
  getSE14CompletionIssue,
  getSE14FieldCompletionIssue,
  getSE14StartIssue,
  normaliseSE14Form,
  normaliseSE14Records,
  SE14_DRAFT_KEY,
  SE14_IN_PROGRESS_KEY,
  sortSE14Records,
  updateSE14Record,
} from "./src/utils/se14Records";
import { deleteSE14FormPhotos } from "./src/utils/se14PhotoStorage";

import TmrFeatureGuideScreen from "./src/features/tmrFeatureGuide/screens/TmrFeatureGuideScreen";
import TmrFeatureDetailsScreen from "./src/features/tmrFeatureGuide/screens/TmrFeatureDetailsScreen";
import TmrFeatureCameraScreen from "./src/features/tmrFeatureGuide/screens/TmrFeatureCameraScreen";
import TmrFeaturePhotoReviewScreen from "./src/features/tmrFeatureGuide/screens/TmrFeaturePhotoReviewScreen";
import WelcomeScreen from "./src/features/welcome/screens/WelcomeScreen";
import DashboardScreen from "./src/features/dashboard/screens/DashboardScreen";
import SurveyPhotoScreen from "./src/features/surveyPhoto/screens/SurveyPhotoScreen";
import ChatHomeScreen from "./src/features/chat/screens/ChatHomeScreen";
import JobChatScreen from "./src/features/chat/screens/JobChatScreen";
import TeamsChannelScreen from "./src/features/chat/screens/TeamsChannelScreen";
import AccountScreen from "./src/features/account/screens/AccountScreen";
import ProfileSetupScreen from "./src/features/account/screens/ProfileSetupScreen";
import MicrosoftSignInScreen from "./src/features/auth/screens/MicrosoftSignInScreen";
import useMicrosoftAuth from "./src/features/auth/useMicrosoftAuth";
import JobWorkspaceScreen from "./src/features/jobs/screens/JobWorkspaceScreen";
import JobFilesScreen from "./src/features/jobFiles/screens/JobFilesScreen";
import JobsScreen from "./src/features/jobs/screens/JobsScreen";
import {
  attachJob,
  ACTIVE_JOB_KEY,
  createJob,
  JOB_MIGRATION_KEY,
  JOBS_KEY,
  jobStorageKey,
  loadActiveJob,
  loadJobs,
  mergeTeamsJobs,
  removeJob,
  saveActiveJob,
  updateJob,
} from "./src/features/jobs/jobContext";
import { loadAssignedTeamsJobs } from "./src/features/jobs/teamsShiftsService";
import {
  FORM_STATUS_STORAGE_KEY,
  loadFormStatuses,
  saveFormStatus,
} from "./src/utils/formStatus";
import { isS500Complete } from "./src/utils/s500Status";
import {
  isS501Complete,
  isS506Complete,
} from "./src/utils/operationalFormStatus";
import WeatherScreen from "./src/features/weather/screens/WeatherScreen";
import WeatherRadarScreen from "./src/features/weather/screens/WeatherRadarScreen";
import CompassScreen from "./src/features/compass/screens/CompassScreen";
import {
  ACCOUNT_PROFILE_KEY,
  applyProfileDefaults,
  emptyAccountProfile,
  isProfileSetupComplete,
  loadAccountProfile,
  normaliseProfile,
  PROFILE_SETUP_KEY,
  saveAccountProfile,
} from "./src/features/account/accountProfile";
import {
  accountStorageKey,
  clearActiveAccountId,
  migrateLegacyAccountWorkspace,
  setActiveAccountId,
} from "./src/features/account/accountWorkspace";
import { ThemeProvider } from "./src/theme/ThemeContext";
import {
  loadWeatherForecast,
  WEATHER_LOADING,
} from "./src/features/weather/weatherService";
import WorkspaceLoadingScreen from "./src/components/WorkspaceLoadingScreen";
import {
  RECENTLY_OPENED_ITEMS,
  RECENTLY_OPENED_KEY,
  RECENTLY_OPENED_LIMIT,
} from "./src/navigation/recentlyOpened";

const Stack = createNativeStackNavigator();
const WEATHER_PREFERENCE_KEY = "northgroup_one_weather_preference_v1";
const migrateProfile = (savedProfile) => {
  if (!savedProfile) return normaliseProfile(emptyAccountProfile);
  return normaliseProfile(savedProfile);
};

const microsoftProfile = (account) => migrateProfile({
  ...emptyAccountProfile,
  userId: account?.id || "",
  identitySource: "microsoft",
  firstName: account?.firstName || "",
  lastName: account?.lastName || "",
  email: account?.email || "",
  role: account?.role || "",
  office: account?.office || "",
  microsoftAccountId: account?.id || "",
  microsoftDisplayName: account?.displayName || "",
  microsoftConnectedAt: new Date().toISOString(),
});

const S500_DRAFT_META_KEYS = new Set([
  "jobNumber",
  "completedBy",
  "hazardRowCount",
  "deletedHazardRows",
  "deletedPpeKeys",
  "customPpeItems",
]);

const hasMeaningfulS500Draft = (form) =>
  Object.keys(emptyS500).some((key) => {
    if (S500_DRAFT_META_KEYS.has(key)) return false;

    const value = form?.[key];
    const baseline = emptyS500[key];

    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return value && value !== baseline;

    return String(value ?? "").trim() !== String(baseline ?? "").trim();
  });

function AppContent() {
  const microsoftAuth = useMicrosoftAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const [playHomeLanding, setPlayHomeLanding] = useState(false);

  const [selectedTmrFeature, setSelectedTmrFeature] = useState(null);

  const [capturedTmrPhotoUri, setCapturedTmrPhotoUri] = useState(null);

  const [loading] = useState(false);

  const [s500, setS500] = useState(emptyS500);
  const [se14, setSE14] = useState(emptySE14);
  const [profile, setProfile] = useState(() => migrateProfile(null));
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [profileSetupComplete, setProfileSetupComplete] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [weather, setWeather] = useState(WEATHER_LOADING);
  const [weatherPreference, setWeatherPreference] = useState("job");
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [recentlyOpened, setRecentlyOpened] = useState([]);
  const weatherRequestId = useRef(0);
  const formProfile = useMemo(
    () => ({
      ...profile,
      fullName: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
    }),
    [profile],
  );
  const [se14InProgress, setSE14InProgress] = useState([]);
  const [activeSE14RecordId, setActiveSE14RecordId] = useState(null);
  const [formStatuses, setFormStatuses] = useState({});

  const updateCurrentFormStatus = async (formId, status, details = {}) => {
    if (!activeJob) return {};
    const nextStatuses = await saveFormStatus(
      activeJob,
      formId,
      status,
      details,
    );
    setFormStatuses(nextStatuses);
    return nextStatuses;
  };

  const continueWork = useMemo(() => {
    const inProgressRecord = se14InProgress.find(
      (record) => record?.status !== "complete",
    );

    if (inProgressRecord) {
      const markId = String(
        inProgressRecord.data?.markId || "Mark pending",
      ).trim();
      const sessionNumber = String(
        inProgressRecord.data?.sessionNumber || "",
      ).trim();
      const sessionLabel = sessionNumber
        ? `Session ${sessionNumber}`
        : "SE-14 static session";

      return {
        type: "se14",
        tone: "progress",
        icon: "\u2316",
        eyebrow: "END SESSION",
        title: "GNSS session ready to finish",
        detail: `${markId} \u00b7 ${sessionLabel}`,
        actionLabel: "Open GNSS workspace",
        recordId: inProgressRecord.id,
      };
    }

    const s500Complete = isS500Complete(s500, formProfile);
    const hasS500Draft =
      !s500Complete &&
      (formStatuses.s500?.status === "draft" ||
        (!formStatuses.s500 && hasMeaningfulS500Draft(s500)));

    if (hasS500Draft) {
      return {
        type: "s500",
        tone: "recommended",
        icon: "\u2713",
        eyebrow: "S-500 DRAFT",
        title: "Pre-Start draft incomplete",
        detail: `${activeJob?.number || "Active job"} \u00b7 Saved on this phone`,
        actionLabel: "Continue pre-start",
      };
    }

    if (formStatuses.s501?.status === "draft") {
      return {
        type: "s501",
        tone: "recommended",
        icon: "\u2713",
        eyebrow: "S-501 DRAFT",
        title: "Vehicle pre-start draft incomplete",
        detail: `${activeJob?.number || "Active job"} \u00b7 Saved on this phone`,
        actionLabel: "Continue S-501",
      };
    }

    if (formStatuses.s506?.status === "draft") {
      return {
        type: "s506",
        tone: "recommended",
        icon: "\u2197",
        eyebrow: "S-506 DRAFT",
        title: "Journey plan draft incomplete",
        detail: `${activeJob?.number || "Active job"} \u00b7 Saved on this phone`,
        actionLabel: "Continue S-506",
      };
    }

    if (s500Complete || formStatuses.s500?.status === "complete") {
      return {
        type: "s500",
        tone: "complete",
        icon: "\u2713",
        eyebrow: "READY FOR TODAY",
        title: "Pre-Start complete",
        detail: `${activeJob?.number || "Active job"} \u00b7 Ready for field work`,
        actionLabel: "View pre-start",
      };
    }

    return {
      type: "s500",
      tone: "recommended",
      icon: "\u2713",
      eyebrow: "RECOMMENDED NEXT STEP",
      title: "Start your field day",
      detail: activeJob?.number
        ? `${activeJob.number} \u00b7 Complete the daily pre-start before heading out.`
        : "Select an active job before starting the daily pre-start.",
      actionLabel: activeJob ? "Start pre-start" : "Choose a job",
    };
  }, [activeJob, formProfile, formStatuses, s500, se14InProgress]);

  const recordRecentlyOpened = useCallback(async (id) => {
    const item = RECENTLY_OPENED_ITEMS[id];
    if (!item) return;

    setRecentlyOpened((current) => {
      const next = [
        item,
        ...current.filter((recentItem) => recentItem.id !== item.id),
      ].slice(0, RECENTLY_OPENED_LIMIT);

      AsyncStorage.setItem(
        accountStorageKey(RECENTLY_OPENED_KEY),
        JSON.stringify(next),
      ).catch(() => {});

      return next;
    });
  }, []);

  const openRecentlyOpenedItem = useCallback(
    (item, navigation) => {
      const id = item?.id || item;
      recordRecentlyOpened(id);

      if (
        ["s500", "se14", "s501", "s506", "surveyPhoto"].includes(id) &&
        !activeJob
      ) {
        navigation.popTo("Jobs");
        return;
      }

      if (id === "account") navigation.navigate("Account");
      if (id === "weather") navigation.navigate("Weather");
      if (id === "fieldTools") navigation.navigate("FieldTools");
      if (id === "surveyPhoto") {
        navigation.navigate("SurveyPhoto", { backLabel: "Dashboard" });
      }
      if (id === "tmrFeatureGuide") {
        setSelectedTmrFeature(null);
        navigation.navigate("TmrFeatureGuide");
      }
      if (id === "compass") navigation.navigate("Compass");
      if (id === "s500")
        navigation.navigate("S500Form", { backLabel: "Dashboard" });
      if (id === "se14") {
        navigation.navigate("SE14InProgress", { backLabel: "Dashboard" });
      }
      if (id === "s501")
        navigation.navigate("S501Form", { backLabel: "Dashboard" });
      if (id === "s506")
        navigation.navigate("S506Form", { backLabel: "Dashboard" });
    },
    [activeJob, recordRecentlyOpened],
  );

  const loadSavedForms = async (microsoftAccount) => {
    try {
      setActiveAccountId(microsoftAccount.id);
      const migration = await migrateLegacyAccountWorkspace({
        account: microsoftAccount,
        profileKey: ACCOUNT_PROFILE_KEY,
        storageKeys: [
          ACCOUNT_PROFILE_KEY,
          PROFILE_SETUP_KEY,
          JOBS_KEY,
          ACTIVE_JOB_KEY,
          JOB_MIGRATION_KEY,
          WEATHER_PREFERENCE_KEY,
          RECENTLY_OPENED_KEY,
        ],
        jobStorageBases: [
          "s500_form",
          SE14_DRAFT_KEY,
          SE14_IN_PROGRESS_KEY,
          "s501_form",
          "s506_form",
          FORM_STATUS_STORAGE_KEY,
        ],
      });
      const savedProfile = await loadAccountProfile();
      const verifiedProfile = microsoftProfile(microsoftAccount);
      const savedFullName = savedProfile
        ? `${savedProfile.firstName || ""} ${savedProfile.lastName || ""}`.trim()
        : "";
      const verifiedFullName =
        `${verifiedProfile.firstName || ""} ${verifiedProfile.lastName || ""}`.trim();
      const savedInitials = savedProfile?.initials || "";
      const nameInitials = savedFullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      const nextProfile = migrateProfile({
        ...verifiedProfile,
        ...(savedProfile || {}),
        userId: microsoftAccount.id,
        identitySource: "microsoft",
        firstName:
          microsoftAccount.firstName || savedProfile?.firstName || "",
        lastName:
          microsoftAccount.lastName || savedProfile?.lastName || "",
        initials:
          !savedInitials || savedInitials === nameInitials
            ? (verifiedFullName ? verifiedProfile.initials : savedInitials)
            : savedInitials,
        email: microsoftAccount.email || savedProfile?.email || "",
        signature:
          !savedProfile?.signature || savedProfile.signature === savedFullName
            ? (verifiedFullName || savedFullName)
            : savedProfile.signature,
        microsoftAccountId: microsoftAccount.id,
        microsoftDisplayName: microsoftAccount.displayName || "",
        microsoftConnectedAt:
          savedProfile?.microsoftConnectedAt || new Date().toISOString(),
      });
      await saveAccountProfile(nextProfile);
      const nextFormProfile = {
        ...nextProfile,
        fullName:
          `${nextProfile.firstName || ""} ${nextProfile.lastName || ""}`.trim(),
      };
      setProfile(nextProfile);
      const setupKey = accountStorageKey(PROFILE_SETUP_KEY);
      const savedSetup = await AsyncStorage.getItem(setupKey);
      const migratedSetupComplete =
        migration.claimedLegacy && isProfileSetupComplete(nextProfile);
      if (savedSetup !== "true" && migratedSetupComplete) {
        await AsyncStorage.setItem(setupKey, "true");
      }
      setProfileSetupComplete(
        savedSetup === "true" || migratedSetupComplete,
      );
      setJobs(await loadJobs(nextProfile));
      const savedActiveJob = await loadActiveJob();
      setActiveJob(savedActiveJob);
      const savedWeatherPreference = await AsyncStorage.getItem(
        accountStorageKey(WEATHER_PREFERENCE_KEY),
      );
      if (
        savedWeatherPreference === "job" ||
        savedWeatherPreference === "current"
      ) {
        setWeatherPreference(savedWeatherPreference);
      }
      const savedRecentlyOpened =
        await AsyncStorage.getItem(accountStorageKey(RECENTLY_OPENED_KEY));
      if (savedRecentlyOpened) {
        const parsedRecentlyOpened = JSON.parse(savedRecentlyOpened);
        if (Array.isArray(parsedRecentlyOpened)) {
          setRecentlyOpened(
            parsedRecentlyOpened
              .map((item) => RECENTLY_OPENED_ITEMS[item?.id])
              .filter(Boolean)
              .slice(0, RECENTLY_OPENED_LIMIT),
          );
        }
      }

      // Restore the active job's complete workspace on launch. Previously only
      // the status map was restored here, leaving the in-memory S-500 form empty
      // until the user switched jobs again. That made the dashboard recommend a
      // new pre-start even when the active job already had a completed form.
      if (savedActiveJob) {
        await loadJobWorkspace(savedActiveJob, nextFormProfile);
        return;
      }

      setFormStatuses({});
      const savedS500 = await AsyncStorage.getItem(
        accountStorageKey("s500_form"),
      );

      const savedSE14 = await AsyncStorage.getItem(
        accountStorageKey(SE14_DRAFT_KEY),
      );

      const savedSE14InProgress =
        await AsyncStorage.getItem(accountStorageKey(SE14_IN_PROGRESS_KEY));

      if (savedS500) {
        setS500({
          ...emptyS500,
          ...JSON.parse(savedS500),
        });
      }

      if (savedSE14) {
        const parsedSE14 = JSON.parse(savedSE14);

        const migratedSE14 = normaliseSE14Form({
          ...parsedSE14,

          bqrStart: parsedSE14.bqrStart || parsedSE14.bamStart || "",

          arpBqr: parsedSE14.arpBqr || parsedSE14.arpBam || "",

          photoStartMarkId:
            parsedSE14.photoStartMarkId ?? parsedSE14.photosStart ?? false,

          photoStartReceiverSerial:
            parsedSE14.photoStartReceiverSerial ??
            parsedSE14.photosStart ??
            false,

          photoStartHeightMeasurement:
            parsedSE14.photoStartHeightMeasurement ??
            parsedSE14.photosStart ??
            false,

          photoStartBubble:
            parsedSE14.photoStartBubble ?? parsedSE14.photosStart ?? false,

          photoStartPlummet:
            parsedSE14.photoStartPlummet ?? parsedSE14.photosStart ?? false,

          photoStartObstructions:
            parsedSE14.photoStartObstructions ??
            parsedSE14.photosStart ??
            false,

          photoEndMarkId:
            parsedSE14.photoEndMarkId ?? parsedSE14.photosEnd ?? false,

          photoEndHeightMeasurement:
            parsedSE14.photoEndHeightMeasurement ??
            parsedSE14.photosEnd ??
            false,
        });

        setSE14(migratedSE14);
      }

      if (savedSE14InProgress) {
        const parsedRecords = JSON.parse(savedSE14InProgress);

        if (Array.isArray(parsedRecords)) {
          setSE14InProgress(
            sortSE14Records(normaliseSE14Records(parsedRecords)),
          );
        }
      }
    } catch (error) {
      console.log("Could not load saved forms", error);
    } finally {
      setProfileHydrated(true);
    }
  };

  const loadJobWorkspace = async (job, profileOverride = formProfile) => {
    const [
      savedS500,
      savedSE14,
      savedRecords,
      savedS501,
      savedS506,
      savedStatuses,
    ] = await Promise.all([
      AsyncStorage.getItem(jobStorageKey("s500_form", job)),
      AsyncStorage.getItem(jobStorageKey(SE14_DRAFT_KEY, job)),
      AsyncStorage.getItem(jobStorageKey(SE14_IN_PROGRESS_KEY, job)),
      AsyncStorage.getItem(jobStorageKey("s501_form", job)),
      AsyncStorage.getItem(jobStorageKey("s506_form", job)),
      loadFormStatuses(job),
    ]);
    const workspaceProfile = profileOverride || formProfile;
    const nextStatuses = { ...savedStatuses };
    const loadedS500 = applyProfileDefaults(
      attachJob(
        savedS500 ? { ...emptyS500, ...JSON.parse(savedS500) } : emptyS500,
        job,
      ),
      workspaceProfile,
      "s500",
      job,
    );

    const s500Status = isS500Complete(loadedS500, workspaceProfile)
      ? "complete"
      : hasMeaningfulS500Draft(loadedS500)
        ? "draft"
        : "none";

    if (s500Status === "none") delete nextStatuses.s500;
    else {
      nextStatuses.s500 = {
        status: s500Status,
        date: String(loadedS500.date || ""),
      };
    }

    if (savedS501) {
      const parsedS501 = { ...JSON.parse(savedS501) };
      nextStatuses.s501 = {
        status: isS501Complete(parsedS501) ? "complete" : "draft",
        date: String(parsedS501.date || ""),
      };
    }
    if (savedS506) {
      const parsedS506 = { ...JSON.parse(savedS506) };
      nextStatuses.s506 = {
        status: isS506Complete(parsedS506) ? "complete" : "draft",
        date: String(parsedS506.date || ""),
      };
    }
    setS500(loadedS500);
    setSE14(
      applyProfileDefaults(
        attachJob(
          savedSE14 ? normaliseSE14Form(JSON.parse(savedSE14)) : emptySE14,
          job,
          "projectNumber",
        ),
        workspaceProfile,
        "se14",
        job,
      ),
    );
    setSE14InProgress(
      savedRecords
        ? sortSE14Records(normaliseSE14Records(JSON.parse(savedRecords)))
        : [],
    );
    setFormStatuses(nextStatuses);
    setActiveSE14RecordId(null);
  };

  const activateJob = async (job, navigation) => {
    const result = await saveActiveJob(job, jobs);
    setActiveJob(result.active);
    setJobs(result.jobs);
    await loadJobWorkspace(result.active);
    navigation.navigate("Dashboard");
  };

  const refreshTeamsJobs = useCallback(async () => {
    const accessToken = await microsoftAuth.getAccessToken();
    const imported = await loadAssignedTeamsJobs({
      accessToken,
      userId: microsoftAuth.account?.id,
    });
    const nextJobs = await mergeTeamsJobs(imported, jobs);
    setJobs(nextJobs);
    if (activeJob?.number) {
      const refreshedActive = nextJobs.find((item) => item.number === activeJob.number);
      if (refreshedActive) {
        setActiveJob(refreshedActive);
        await AsyncStorage.setItem(
          accountStorageKey(ACTIVE_JOB_KEY),
          JSON.stringify(refreshedActive),
        );
      } else if (activeJob.source === "teams-shifts") {
        setActiveJob(null);
        await AsyncStorage.removeItem(accountStorageKey(ACTIVE_JOB_KEY));
      }
    }
    return imported.length;
  }, [activeJob?.number, jobs, microsoftAuth.account?.id, microsoftAuth.getAccessToken]);

  useEffect(() => {
    Promise.all([
      Asset.loadAsync(require("./assets/topo-bg.png")),
      Asset.loadAsync(require("./assets/logo-transparent.png")),
    ]).catch((error) => {
      console.log("Could not prepare app assets", error);
    });
  }, []);

  useEffect(() => {
    if (!microsoftAuth.ready) return;

    if (!microsoftAuth.account?.id) {
      clearActiveAccountId();
      setProfile(migrateProfile(null));
      setProfileHydrated(false);
      setProfileSetupComplete(false);
      setJobs([]);
      setActiveJob(null);
      setS500(emptyS500);
      setSE14(emptySE14);
      setSE14InProgress([]);
      setFormStatuses({});
      setRecentlyOpened([]);
      return;
    }

    setProfileHydrated(false);
    setProfileSetupComplete(false);
    setJobs([]);
    setActiveJob(null);
    setS500(emptyS500);
    setSE14(emptySE14);
    setSE14InProgress([]);
    setFormStatuses({});
    setRecentlyOpened([]);
    setActiveAccountId(microsoftAuth.account.id);
    loadSavedForms(microsoftAuth.account).catch((error) => {
      console.log("Could not prepare account workspace", error);
      setProfile(microsoftProfile(microsoftAuth.account));
      setProfileHydrated(true);
      setProfileSetupComplete(false);
    });
  }, [microsoftAuth.account?.id, microsoftAuth.ready]);

  const fetchWeather = useCallback(
    async ({
      forceRefresh = false,
      showRefreshing = false,
      nextPreference = weatherPreference,
    } = {}) => {
      const requestId = weatherRequestId.current + 1;
      weatherRequestId.current = requestId;
      if (showRefreshing) setWeatherRefreshing(true);
      try {
        const effectivePreference =
          nextPreference === "job" && !activeJob ? "current" : nextPreference;
        const nextWeather = await loadWeatherForecast({
          office: profile.office,
          profile,
          job: activeJob,
          preference: effectivePreference,
          forceRefresh,
        });
        if (requestId === weatherRequestId.current) setWeather(nextWeather);
        return nextWeather;
      } finally {
        if (showRefreshing) setWeatherRefreshing(false);
      }
    },
    [profile, activeJob, weatherPreference],
  );

  useEffect(() => {
    if (!profileHydrated || !microsoftAuth.account) return undefined;
    let active = true;
    const refreshWeather = () => {
      fetchWeather({
        forceRefresh: Boolean(activeJob),
        nextPreference: weatherPreference,
      }).catch((error) => {
        if (active) console.log("Could not refresh weather", error);
      });
    };

    refreshWeather();
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") refreshWeather();
      },
    );
    const refreshInterval = setInterval(refreshWeather, 30 * 60 * 1000);

    return () => {
      active = false;
      appStateSubscription.remove();
      clearInterval(refreshInterval);
    };
  }, [
    fetchWeather,
    microsoftAuth.account,
    profileHydrated,
    weatherPreference,
  ]);

  const refreshWeatherManually = useCallback(
    () => fetchWeather({ forceRefresh: true, showRefreshing: true }),
    [fetchWeather],
  );

  const changeWeatherPreference = useCallback(async (nextPreference) => {
    if (nextPreference !== "job" && nextPreference !== "current") return;
    setWeatherPreference(nextPreference);
    try {
      await AsyncStorage.setItem(
        accountStorageKey(WEATHER_PREFERENCE_KEY),
        nextPreference,
      );
    } catch (error) {
      console.log("Could not save weather preference", error);
    }
  }, []);

  const applyWeatherFromScreen = useCallback(
    (nextWeather) => {
      const activeJobNumber = String(activeJob?.number || "").trim();
      const weatherJobNumber = String(nextWeather?.jobNumber || "").trim();
      if (
        activeJobNumber &&
        nextWeather?.locationSource === "job" &&
        weatherJobNumber &&
        weatherJobNumber !== activeJobNumber
      )
        return;
      setWeather(nextWeather);
    },
    [activeJob],
  );

  const saveS500 = async () => {
    try {
      await AsyncStorage.setItem(
        jobStorageKey("s500_form", activeJob),
        JSON.stringify(s500),
      );
      await updateCurrentFormStatus(
        "s500",
        isS500Complete(s500, formProfile) ? "complete" : "draft",
        { date: s500.date },
      );

      Alert.alert("Saved", "S-500 form data saved on this phone.");
    } catch (error) {
      Alert.alert("Save failed", String(error?.message || error));
    }
  };

  const persistSE14Records = async (records) => {
    const sortedRecords = sortSE14Records(records);

    setSE14InProgress(sortedRecords);

    await AsyncStorage.setItem(
      jobStorageKey(SE14_IN_PROGRESS_KEY, activeJob),
      JSON.stringify(sortedRecords),
    );

    return sortedRecords;
  };

  const saveSE14AsInProgress = async () => {
    const startIssue = getSE14StartIssue(se14);

    if (startIssue) {
      Alert.alert("More information required", startIssue.message);

      return false;
    }

    const duplicate = se14InProgress.find(
      (record) =>
        String(record.data.projectNumber || "")
          .trim()
          .toLowerCase() ===
          String(se14.projectNumber || "")
            .trim()
            .toLowerCase() &&
        String(record.data.markId || "")
          .trim()
          .toLowerCase() ===
          String(se14.markId || "")
            .trim()
            .toLowerCase() &&
        String(record.data.sessionNumber || "")
          .trim()
          .toLowerCase() ===
          String(se14.sessionNumber || "")
            .trim()
            .toLowerCase(),
    );

    if (duplicate) {
      Alert.alert(
        "Session already exists",
        `${duplicate.name} is already in progress. Open the existing session instead.`,
      );

      return false;
    }

    try {
      const record = createSE14Record(se14);

      await persistSE14Records([...se14InProgress, record]);

      setSE14(emptySE14);
      setActiveSE14RecordId(null);
      await AsyncStorage.removeItem(jobStorageKey(SE14_DRAFT_KEY, activeJob));

      Alert.alert(
        "Moved to End Session",
        `${record.name} is now ready for its end-session details.`,
      );

      return true;
    } catch (error) {
      Alert.alert("Save failed", String(error?.message || error));

      return false;
    }
  };

  const saveActiveSE14Record = async ({ silent = false } = {}) => {
    try {
      const currentRecord = se14InProgress.find(
        (record) => record.id === activeSE14RecordId,
      );

      if (!currentRecord) {
        Alert.alert(
          "Save failed",
          "This in-progress session could not be found.",
        );
        return false;
      }

      const updatedRecord = updateSE14Record(currentRecord, se14);

      await persistSE14Records(
        se14InProgress.map((record) =>
          record.id === activeSE14RecordId ? updatedRecord : record,
        ),
      );

      if (!silent) {
        Alert.alert("Saved", `${updatedRecord.name} has been updated.`);
      }

      return true;
    } catch (error) {
      Alert.alert("Save failed", String(error?.message || error));

      return false;
    }
  };

  const completeSE14FieldSession = async () => {
    const completionIssue = getSE14FieldCompletionIssue(se14);

    if (completionIssue) {
      Alert.alert("More information required", completionIssue.message);
      return false;
    }

    const currentRecord = se14InProgress.find(
      (record) => record.id === activeSE14RecordId,
    );

    if (!currentRecord) {
      Alert.alert(
        "Session not found",
        "This GNSS session could not be moved to review.",
      );
      return false;
    }

    try {
      const fieldCompletedAt = new Date().toISOString();
      const reviewRecord = {
        ...updateSE14Record(currentRecord, se14),
        status: "review",
        fieldCompletedAt,
        completedAt: null,
      };

      await persistSE14Records(
        se14InProgress.map((record) =>
          record.id === activeSE14RecordId ? reviewRecord : record,
        ),
      );
      await updateCurrentFormStatus("se14", "draft", {
        date: se14.startDate,
      });

      Alert.alert(
        "Ready for review",
        `${reviewRecord.name} is now in Review & Complete. Data filenames can be added when they are available.`,
      );

      return true;
    } catch (error) {
      Alert.alert(
        "Could not complete session",
        String(error?.message || error),
      );
      return false;
    }
  };

  const openSE14Record = (recordId) => {
    const record = se14InProgress.find((item) => item.id === recordId);

    if (!record) {
      return false;
    }

    setSE14(normaliseSE14Form(record.data));
    setActiveSE14RecordId(record.id);
    return true;
  };

  const startNewSE14 = async () => {
    setActiveSE14RecordId(null);

    try {
      const savedDraft = await AsyncStorage.getItem(
        jobStorageKey(SE14_DRAFT_KEY, activeJob),
      );

      const draft = savedDraft
        ? normaliseSE14Form(JSON.parse(savedDraft))
        : emptySE14;

      setSE14(
        applyProfileDefaults(
          attachJob(draft, activeJob, "projectNumber"),
          formProfile,
          "se14",
          activeJob,
        ),
      );
    } catch (error) {
      console.log("Could not load the SE-14 draft:", error);
      setSE14(
        applyProfileDefaults(
          attachJob(emptySE14, activeJob, "projectNumber"),
          formProfile,
          "se14",
          activeJob,
        ),
      );
    }
  };

  const deleteSE14Record = async (recordId) => {
    try {
      await persistSE14Records(
        se14InProgress.filter((record) => record.id !== recordId),
      );

      if (activeSE14RecordId === recordId) {
        setActiveSE14RecordId(null);
        setSE14(emptySE14);
      }
    } catch (error) {
      Alert.alert("Delete failed", String(error?.message || error));
    }
  };

  const clearS500 = async () => {
    Alert.alert(
      "Clear S-500 Form?",
      "This will clear the saved draft on this phone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            const clearedS500 = applyProfileDefaults(
              attachJob(emptyS500, activeJob),
              formProfile,
              "s500",
              activeJob,
            );

            setS500({
              ...clearedS500,
              date: "",
              jobNumber: activeJob?.number || "",
            });

            await AsyncStorage.removeItem(
              jobStorageKey("s500_form", activeJob),
            );
            await updateCurrentFormStatus("s500", "none");
          },
        },
      ],
    );
  };

  const clearSE14 = (onCleared) => {
    Alert.alert(
      "Clear Start Session?",
      "This will permanently clear all entered Session Details, Session Start answers and captured Start photos from this draft. Copies already saved to iPhone Photos will remain. This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear Start Session",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(
                jobStorageKey(SE14_DRAFT_KEY, activeJob),
              );

              await deleteSE14FormPhotos(se14, { stage: "Start" });

              setSE14(
                applyProfileDefaults(
                  attachJob(emptySE14, activeJob, "projectNumber"),
                  formProfile,
                  "se14",
                  activeJob,
                ),
              );
              setActiveSE14RecordId(null);

              try {
                await updateCurrentFormStatus("se14", "none");
              } catch (statusError) {
                console.log(
                  "Could not reset the SE-14 form status:",
                  statusError,
                );
              }

              if (typeof onCleared === "function") {
                onCleared();
              }
            } catch (error) {
              Alert.alert(
                "Clear failed",
                "The Start Session could not be cleared. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const exportS500Pdf = async () => {
    const result = await exportS500PdfFile(s500);
    if (result?.exported) {
      await updateCurrentFormStatus("s500", "complete", { date: s500.date });
    }
    return result;
  };

  const emailS500Pdf = async () => {
    const result = await emailS500PdfFile(s500);
    if (result?.exported) {
      await updateCurrentFormStatus("s500", "complete", { date: s500.date });
    }
    return result;
  };

  const exportSE14Pdf = async (onPrepared, onCompleted) => {
    const completionIssue = getSE14CompletionIssue(se14);

    if (completionIssue) {
      Alert.alert("More information required", completionIssue.message);
      return { exported: false, issue: completionIssue };
    }

    const result = await exportSE14PdfFile(se14, onPrepared);

    if (!result?.exported || !activeSE14RecordId) {
      return;
    }

    const completedAt = new Date().toISOString();
    await updateCurrentFormStatus("se14", "complete", {
      date: se14.startDate,
      completedAt,
    });

    await persistSE14Records(
      se14InProgress.map((record) =>
        record.id === activeSE14RecordId
          ? {
              ...updateSE14Record(record, se14),
              status: "complete",
              completedAt,
            }
          : record,
      ),
    );

    Alert.alert(
      "Record exported",
      "The PDF was exported and this session is now marked complete. It remains available in Review & Complete for corrections or re-export.",
    );

    onCompleted?.();
    return result;
  };

  const clearCapturedTmrPhoto = () => {
    setCapturedTmrPhotoUri(null);
  };

  const completeProfileSetup = async (nextProfile) => {
    const cleanProfile = migrateProfile({
      ...nextProfile,
      userId: microsoftAuth.account.id,
      identitySource: "microsoft",
      email: microsoftAuth.account.email || nextProfile.email,
      microsoftAccountId: microsoftAuth.account.id,
      microsoftDisplayName: microsoftAuth.account.displayName || "",
      microsoftConnectedAt:
        nextProfile.microsoftConnectedAt || new Date().toISOString(),
    });
    const savedProfile = await saveAccountProfile(cleanProfile);
    await AsyncStorage.setItem(
      accountStorageKey(PROFILE_SETUP_KEY),
      "true",
    );
    setProfile(savedProfile);
    setProfileSetupComplete(true);
    setShowWelcome(false);
  };

  const signOutMicrosoft = async () => {
    await microsoftAuth.signOut();
    clearActiveAccountId();
    setProfile(migrateProfile(null));
    setProfileHydrated(false);
    setProfileSetupComplete(false);
    setJobs([]);
    setActiveJob(null);
    setS500(emptyS500);
    setSE14(emptySE14);
    setSE14InProgress([]);
    setFormStatuses({});
    setRecentlyOpened([]);
  };

  if (showIntro) {
    return (
      <IntroScreen
        onComplete={() => {
          setShowWelcome(true);
          setShowIntro(false);
        }}
      />
    );
  }

  if (!microsoftAuth.ready || !microsoftAuth.account) {
    return (
      <MicrosoftSignInScreen
        busy={!microsoftAuth.ready || microsoftAuth.busy}
        error={microsoftAuth.error}
        onSignIn={microsoftAuth.signIn}
      />
    );
  }

  if (!profileHydrated) {
    return <WorkspaceLoadingScreen />;
  }

  if (!profileSetupComplete) {
    return (
      <ThemeProvider
        appearance={{
          themeId: profile.themeId,
          mode: profile.appearanceMode,
        }}
      >
        <ProfileSetupScreen
          key={microsoftAuth.account.id}
          profile={profile}
          onComplete={completeProfileSetup}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider
      appearance={{
        themeId: profile.themeId,
        mode: profile.appearanceMode,
      }}
    >
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={showWelcome ? "Welcome" : "Jobs"}
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            gestureDirection: "horizontal",
            fullScreenGestureEnabled: false,
            animation: "default",
            presentation: "card",
            contentStyle: {
              backgroundColor: "#061A2D",
            },
          }}
        >
          <Stack.Screen name="Welcome">
            {({ navigation }) => (
              <WelcomeScreen
                onContinue={() => {
                  setShowWelcome(false);
                  navigation.navigate("Jobs");
                }}
                user={{
                  firstName: profile.firstName,
                  currentJob: activeJob || {
                    number: "No job selected",
                    name: "Choose a job to begin",
                  },
                  weather,
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Jobs">
            {({ navigation }) => (
              <JobsScreen
                jobs={jobs}
                activeJob={activeJob}
                selectJob={(job) => activateJob(job, navigation)}
                addJob={async (values) => {
                  const result = await createJob(values, jobs);
                  setActiveJob(result.active);
                  setJobs(result.jobs);
                  await loadJobWorkspace(result.active);
                  navigation.navigate("Dashboard");
                }}
                editJob={async (original, values) => {
                  const nextJobs = await updateJob(
                    original.number,
                    values,
                    jobs,
                  );
                  setJobs(nextJobs);
                  if (activeJob?.number === original.number) {
                    const updated = nextJobs.find(
                      (item) => item.number === original.number,
                    );
                    const result = await saveActiveJob(updated, nextJobs);
                    setActiveJob(result.active);
                    setJobs(result.jobs);
                  }
                }}
                deleteJob={async (job) => {
                  const nextJobs = await removeJob(job.number, jobs);
                  setJobs(nextJobs);
                  if (activeJob?.number === job.number) {
                    setActiveJob(null);
                    setS500(emptyS500);
                    setSE14(emptySE14);
                    setSE14InProgress([]);
                  }
                }}
                openDashboard={() => activateJob(activeJob, navigation)}
                microsoftConnected={Boolean(microsoftAuth.account)}
                refreshTeamsJobs={refreshTeamsJobs}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Dashboard">
            {({ navigation }) => (
              <DashboardScreen
                profilePhotoUri={microsoftAuth.profilePhotoUri}
                profilePhotoRevision={microsoftAuth.profilePhotoRevision}
                user={{
                  firstName: profile.firstName,
                  initials:
                    `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase(),
                  currentJob: activeJob || {
                    number: "No job selected",
                    name: "Choose a job to begin",
                  },
                  weather,
                }}
                recentlyOpened={recentlyOpened}
                openRecentlyOpened={(item) =>
                  openRecentlyOpenedItem(item, navigation)
                }
                openAccount={() => {
                  recordRecentlyOpened("account");
                  navigation.navigate("Account");
                }}
                openTodaysJob={() => navigation.navigate("TodaysJob")}
                openJobs={() => navigation.popTo("Jobs")}
                continueWork={continueWork}
                openContinueWork={async () => {
                  if (!activeJob) {
                    navigation.popTo("Jobs");
                    return;
                  }

                  if (continueWork?.type === "se14") {
                    recordRecentlyOpened("se14");
                    navigation.navigate("SE14InProgress", {
                      backLabel: "Dashboard",
                    });
                    return;
                  }

                  if (continueWork?.type === "s501") {
                    recordRecentlyOpened("s501");
                    navigation.navigate("S501Form", { backLabel: "Dashboard" });
                    return;
                  }

                  if (continueWork?.type === "s506") {
                    recordRecentlyOpened("s506");
                    navigation.navigate("S506Form", { backLabel: "Dashboard" });
                    return;
                  }

                  recordRecentlyOpened("s500");
                  navigation.navigate("S500Form", { backLabel: "Dashboard" });
                }}
                openPreStart={() => {
                  if (activeJob) {
                    recordRecentlyOpened("s500");
                    navigation.navigate("S500Form", { backLabel: "Dashboard" });
                    return;
                  }

                  navigation.popTo("Jobs");
                }}
                openGNSS={() => {
                  if (!activeJob) {
                    navigation.popTo("Jobs");
                    return;
                  }

                  recordRecentlyOpened("se14");
                  navigation.navigate("SE14InProgress", {
                    backLabel: "Dashboard",
                  });
                }}
                openPhotoCapture={() => {
                  if (!activeJob) {
                    navigation.popTo("Jobs");
                    return;
                  }

                  recordRecentlyOpened("surveyPhoto");
                  navigation.navigate("SurveyPhoto", {
                    initialTab: "capture",
                    launchCameraAt: Date.now(),
                    backLabel: "Dashboard",
                  });
                }}
                openMoreTools={() => {
                  recordRecentlyOpened("fieldTools");
                  navigation.navigate("FieldTools");
                }}
                openFeed={() => navigation.navigate("FeedHome")}
                openChats={() => {
                  if (!activeJob) {
                    navigation.popTo("Jobs");
                    return;
                  }
                  navigation.navigate("JobChat");
                }}
                openWeather={() => {
                  recordRecentlyOpened("weather");
                  navigation.navigate("Weather");
                }}
                onRefreshWeather={refreshWeatherManually}
                weatherRefreshing={weatherRefreshing}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="FeedHome">
            {({ navigation }) => (
              <ChatHomeScreen
                profile={formProfile}
                account={microsoftAuth.account}
                profilePhotoUri={microsoftAuth.profilePhotoUri}
                profilePhotoRevision={microsoftAuth.profilePhotoRevision}
                getAccessToken={microsoftAuth.getAccessToken}
                goBack={() => navigation.goBack()}
                openProfile={() => navigation.navigate("Account")}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="TeamsChannel">
            {({ navigation, route }) => (
              <TeamsChannelScreen
                channelKey={route.params?.channelKey}
                profile={formProfile}
                account={microsoftAuth.account}
                getAccessToken={microsoftAuth.getAccessToken}
                goBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="JobChat">
            {({ navigation }) => (
              <JobChatScreen
                activeJob={activeJob}
                profile={formProfile}
                account={microsoftAuth.account}
                profilePhotoUri={microsoftAuth.profilePhotoUri}
                profilePhotoRevision={microsoftAuth.profilePhotoRevision}
                getAccessToken={microsoftAuth.getJobChatAccessToken}
                goBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Weather">
            {({ navigation }) => (
              <WeatherScreen
                initialWeather={weather}
                profile={profile}
                job={activeJob}
                onWeatherChange={applyWeatherFromScreen}
                locationPreference={weatherPreference}
                onPreferenceChange={changeWeatherPreference}
                goBack={() => navigation.goBack()}
                openRadar={() => navigation.navigate("WeatherRadar")}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="WeatherRadar">
            {({ navigation }) => (
              <WeatherRadarScreen goBack={() => navigation.goBack()} />
            )}
          </Stack.Screen>

          <Stack.Screen name="TodaysJob">
            {({ navigation }) => (
              <JobWorkspaceScreen
                job={activeJob}
                goBack={() => navigation.goBack()}
                openForms={() => {
                  setPlayHomeLanding(true);
                  navigation.navigate("Home", { backLabel: "Job Workspace" });
                }}
                openJobFiles={() => navigation.navigate("JobFiles")}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="JobFiles">
            {({ navigation }) => (
              <JobFilesScreen
                job={activeJob}
                goBack={() => navigation.goBack()}
                getAccessToken={microsoftAuth.getAccessToken}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Account">
            {({ navigation }) => (
              <AccountScreen
                profile={profile}
                microsoftAccount={microsoftAuth.account}
                profilePhotoUri={microsoftAuth.profilePhotoUri}
                profilePhotoRevision={microsoftAuth.profilePhotoRevision}
                profilePhotoLoading={microsoftAuth.profilePhotoLoading}
                onRefreshProfilePhoto={() =>
                  microsoftAuth.refreshProfilePhoto()
                }
                onMicrosoftSignOut={signOutMicrosoft}
                goBack={() => navigation.goBack()}
                onSave={async (next) => {
                  const cleanProfile = migrateProfile({
                    ...next,
                    userId: microsoftAuth.account.id,
                    identitySource: "microsoft",
                    email: microsoftAuth.account.email || next.email,
                    microsoftAccountId: microsoftAuth.account.id,
                    microsoftDisplayName:
                      microsoftAuth.account.displayName || "",
                  });
                  setProfile(cleanProfile);
                  await saveAccountProfile(cleanProfile);
                  setS500((current) => ({
                    ...current,
                    completedBy:
                      current.completedBy ||
                      `${cleanProfile.firstName} ${cleanProfile.lastName}`.trim(),
                    jobNumber: current.jobNumber || cleanProfile.defaultJob,
                  }));
                  setSE14((current) => ({
                    ...current,
                    observer:
                      current.observer ||
                      `${cleanProfile.firstName} ${cleanProfile.lastName}`.trim(),
                    projectNumber:
                      current.projectNumber || cleanProfile.defaultJob,
                  }));
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Home">
            {({ navigation, route }) => (
              <HomeScreen
                loading={loading}
                playIntroLanding={playHomeLanding}
                onIntroLandingComplete={() => {
                  setPlayHomeLanding(false);
                }}
                openForm={(form) => {
                  if (form?.id === "se14") {
                    recordRecentlyOpened("se14");
                    navigation.navigate("SE14InProgress", {
                      backLabel: "Forms",
                    });
                    return;
                  }

                  if (form?.id === "s500") {
                    recordRecentlyOpened("s500");
                    navigation.navigate("S500Form", { backLabel: "Forms" });
                    return;
                  }

                  if (form?.id === "s501") {
                    recordRecentlyOpened("s501");
                    navigation.navigate("S501Form", { backLabel: "Forms" });
                    return;
                  }

                  if (form?.id === "s506") {
                    recordRecentlyOpened("s506");
                    navigation.navigate("S506Form", { backLabel: "Forms" });
                  }
                }}
                goDashboard={() => navigation.goBack()}
                backLabel={route.params?.backLabel || "Job Workspace"}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="FieldTools">
            {({ navigation }) => (
              <FieldToolsScreen
                goBack={() => navigation.goBack()}
                openSurveyPhotoCapture={() => {
                  recordRecentlyOpened("surveyPhoto");
                  navigation.navigate("SurveyPhoto", {
                    backLabel: "Field Tools",
                  });
                }}
                openTmrFeatureGuide={() => {
                  recordRecentlyOpened("tmrFeatureGuide");
                  setSelectedTmrFeature(null);
                  navigation.navigate("TmrFeatureGuide");
                }}
                openCompass={() => {
                  recordRecentlyOpened("compass");
                  navigation.navigate("Compass");
                }}
                openFeatureScanner={() => {
                  navigation.navigate("FeatureScanner");
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="FeatureScanner">
            {({ navigation }) => (
              <FeatureScannerScreen
                activeJob={activeJob}
                accountProfile={formProfile}
                goBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Compass">
            {({ navigation }) => (
              <CompassScreen onBack={() => navigation.goBack()} />
            )}
          </Stack.Screen>

          <Stack.Screen name="SurveyPhoto">
            {({ navigation, route }) => (
              <SurveyPhotoScreen
                accountProfile={formProfile}
                activeJob={activeJob}
                initialFeature={selectedTmrFeature}
                initialTab={route.params?.initialTab}
                launchCameraAt={route.params?.launchCameraAt}
                backLabel={route.params?.backLabel || "Dashboard"}
                goBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="S500Form">
            {({ navigation, route }) => (
              <S500FormScreen
                s500={s500}
                setS500={setS500}
                saveS500={saveS500}
                clearS500={clearS500}
                exportS500Pdf={exportS500Pdf}
                emailS500Pdf={emailS500Pdf}
                accountProfile={formProfile}
                activeJob={activeJob}
                backLabel={route.params?.backLabel || "Forms"}
                setScreen={(targetScreen) => {
                  if (targetScreen === "formMenu") {
                    navigation.goBack();
                    return;
                  }

                  if (targetScreen === "s500RiskGuide") {
                    navigation.navigate("S500RiskGuide");
                  }
                }}
                openCameraCompare={(feature) => {
                  setSelectedTmrFeature(feature);
                  navigation.navigate("TmrFeatureCamera", {
                    backLabel: "S-500 Form",
                  });
                }}
                useFeature={(feature) => {
                  setSelectedTmrFeature(feature);
                  navigation.navigate("SurveyPhoto", {
                    backLabel: "S-500 Form",
                  });
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="S501Form">
            {({ navigation, route }) => (
              <S501FormScreen
                profile={profile}
                activeJob={activeJob}
                backLabel={route.params?.backLabel || "Forms"}
                goBack={() => navigation.goBack()}
                onFormStatusChange={updateCurrentFormStatus}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="S506Form">
            {({ navigation, route }) => (
              <S506FormScreen
                profile={profile}
                activeJob={activeJob}
                backLabel={route.params?.backLabel || "Forms"}
                goBack={() => navigation.goBack()}
                onFormStatusChange={updateCurrentFormStatus}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="S500RiskGuide">
            {({ navigation, route }) => (
              <S500RiskGuideScreen
                setScreen={(targetScreen) => {
                  if (targetScreen === "fillS500") {
                    navigation.goBack();
                  }
                }}
                backLabel={route.params?.backLabel || "S-500 Form"}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="SE14Form">
            {({ navigation }) => (
              <SE14FormScreen
                se14={se14}
                setSE14={setSE14}
                saveSE14AsInProgress={async () => {
                  const saved = await saveSE14AsInProgress();

                  if (saved) {
                    Alert.alert(
                      "Session Started",
                      "This form has now moved to End Session.",
                      [
                        {
                          text: "OK",
                          onPress: () => navigation.goBack(),
                        },
                      ],
                    );
                  }

                  return saved;
                }}
                saveActiveSE14Record={saveActiveSE14Record}
                completeSE14FieldSession={async () => {
                  const completed = await completeSE14FieldSession();
                  if (completed) navigation.goBack();
                }}
                isInProgress={Boolean(activeSE14RecordId)}
                recordStatus={
                  se14InProgress.find(
                    (record) => record.id === activeSE14RecordId,
                  )?.status || "draft"
                }
                isCompleted={Boolean(
                  se14InProgress.find(
                    (record) => record.id === activeSE14RecordId,
                  )?.status === "complete",
                )}
                clearSE14={clearSE14}
                exportSE14Pdf={exportSE14Pdf}
                accountProfile={formProfile}
                activeJob={activeJob}
                backLabel="GNSS Sessions"
                setScreen={(targetScreen) => {
                  if (targetScreen === "formMenu") {
                    navigation.goBack();
                    return;
                  }

                  if (targetScreen === "se14MeasurementGuide") {
                    navigation.navigate("SE14MeasurementGuide");
                    return;
                  }

                  if (targetScreen === "sessionCompleted") {
                    navigation.goBack();
                  }
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="SE14InProgress">
            {({ navigation, route }) => (
              <SE14InProgressScreen
                records={se14InProgress}
                activeJob={activeJob}
                startSession={async () => {
                  await startNewSE14();
                  navigation.navigate("SE14Form", {
                    backLabel: "GNSS Sessions",
                  });
                }}
                openRecord={(recordId) => {
                  if (openSE14Record(recordId)) {
                    navigation.navigate("SE14Form", {
                      backLabel: "GNSS Sessions",
                    });
                  }
                }}
                deleteRecord={deleteSE14Record}
                backLabel={route.params?.backLabel || "Forms"}
                goBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="SE14MeasurementGuide">
            {({ navigation }) => (
              <SE14MeasurementGuideScreen
                backLabel="GNSS Session"
                setScreen={(targetScreen) => {
                  if (targetScreen === "fillSE14") {
                    navigation.goBack();
                  }
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="TmrFeatureGuide">
            {({ navigation }) => (
              <TmrFeatureGuideScreen
                currentJob={{
                  number: profile.defaultJob || "No job selected",
                  name:
                    profile.defaultJobName ||
                    "Set a default job in Profile Settings",
                }}
                setScreen={(targetScreen) => {
                  if (targetScreen === "home") {
                    navigation.goBack();
                  }
                }}
                openFeatureDetails={(feature) => {
                  setSelectedTmrFeature(feature);

                  navigation.navigate("TmrFeatureDetails");
                }}
                openCamera={() => {
                  setCapturedTmrPhotoUri(null);

                  navigation.navigate("TmrFeatureCamera");
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="TmrFeatureDetails">
            {({ navigation }) => (
              <TmrFeatureDetailsScreen
                feature={selectedTmrFeature}
                setScreen={(targetScreen) => {
                  if (targetScreen === "tmrFeatureGuide") {
                    navigation.goBack();
                  }
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="TmrFeatureCamera">
            {({ navigation, route }) => (
              <TmrFeatureCameraScreen
                selectedFeature={selectedTmrFeature}
                backLabel={route.params?.backLabel || "TMR Guide"}
                setScreen={(targetScreen) => {
                  if (targetScreen === "tmrFeatureGuide") {
                    navigation.goBack();
                  }
                }}
                onPhotoCaptured={(photoUri) => {
                  setCapturedTmrPhotoUri(photoUri);

                  navigation.navigate("TmrFeaturePhotoReview", {
                    backLabel: route.params?.backLabel || "TMR Guide",
                  });
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="TmrFeaturePhotoReview">
            {({ navigation, route }) => (
              <TmrFeaturePhotoReviewScreen
                photoUri={capturedTmrPhotoUri}
                backLabel={route.params?.backLabel || "TMR Guide"}
                clearCapturedPhoto={clearCapturedTmrPhoto}
                setScreen={(targetScreen) => {
                  if (targetScreen === "tmrFeatureCamera") {
                    navigation.goBack();
                    return;
                  }

                  if (targetScreen === "tmrFeatureGuide") {
                    navigation.pop(2);
                  }
                }}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
