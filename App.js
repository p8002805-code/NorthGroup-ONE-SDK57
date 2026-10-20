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
  Linking,
  View,
} from "react-native";
import { Asset } from "expo-asset";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppPrivacyShield from "./src/components/AppPrivacyShield";
import { reportDevelopmentError } from "./src/services/security/securityLogger";
import { archiveStaleForm, parseStoredJson } from "./src/utils/safeStorage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { emptyS500, emptySE14 } from "./src/data/emptyForms";
import {
  exportS500Pdf as exportS500PdfFile,
  emailS500Pdf as emailS500PdfFile,
} from "./src/export/exportS500Pdf";
import { exportSE14Pdf as exportSE14PdfFile } from "./src/export/exportSE14Pdf";
import IntroScreen from "./src/screens/IntroScreen";
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
  archiveSE14Record as archiveSE14RecordState,
  createSE14Record,
  getSE14CompletionIssue,
  getSE14FieldCompletionIssue,
  getSE14StartIssue,
  normaliseSE14Form,
  normaliseSE14Records,
  SE14_DRAFT_KEY,
  SE14_IN_PROGRESS_KEY,
  restoreSE14Record as restoreSE14RecordState,
  sortSE14Records,
  updateSE14Record,
} from "./src/utils/se14Records";
import { deleteSE14FormPhotos } from "./src/utils/se14PhotoStorage";
import { persistSE14UploadCompletion, saveSE14ForUploadDayWithFeedback } from "./src/features/gnss/se14OfflineQueue";
import { applySE14RoundAssignment, resolveSE14RoundAssignment } from "./src/features/gnss/se14Rounds";
import { saveSE14BulkSessionNumberEdit } from "./src/features/gnss/se14BulkSessionEdit";
import TmrFeatureGuideScreen from "./src/features/tmrFeatureGuide/screens/TmrFeatureGuideScreen";
import TmrFeatureDetailsScreen from "./src/features/tmrFeatureGuide/screens/TmrFeatureDetailsScreen";
import TmrFeatureCameraScreen from "./src/features/tmrFeatureGuide/screens/TmrFeatureCameraScreen";
import TmrFeaturePhotoReviewScreen from "./src/features/tmrFeatureGuide/screens/TmrFeaturePhotoReviewScreen";
import WelcomeScreen from "./src/features/welcome/screens/WelcomeScreen";
import DashboardScreen from "./src/features/dashboard/screens/DashboardScreen";
import { buildDashboardWorkflow } from "./src/features/dashboard/dashboardWorkflow";
import SurveyPhotoScreen from "./src/features/surveyPhoto/screens/SurveyPhotoScreen";
import ChatHomeScreen from "./src/features/chat/screens/ChatHomeScreen";
import JobChatScreen from "./src/features/chat/screens/JobChatScreen";
import TeamsChannelScreen from "./src/features/chat/screens/TeamsChannelScreen";
import AccountScreen from "./src/features/account/screens/AccountScreen";
import DiagnosticsScreen from "./src/features/account/screens/DiagnosticsScreen";
import ProfileSetupScreen from "./src/features/account/screens/ProfileSetupScreen";
import MicrosoftSignInScreen from "./src/features/auth/screens/MicrosoftSignInScreen";
import useMicrosoftAuth from "./src/features/auth/useMicrosoftAuth";
import { isTrustedJobFileWebUrl } from "./src/features/jobFiles/jobFilesRules";
import { processSurveyPhotoUploadOutbox } from "./src/features/surveyPhoto/services/surveyPhotoUploadProcessor";
import JobHubScreen from "./src/features/jobs/screens/JobHubScreen";
import KmlEditorScreen from "./src/features/kml/screens/KmlEditorScreen";
import JobsScreen from "./src/features/jobs/screens/JobsScreen";
import NotificationsScreen from "./src/features/notifications/screens/NotificationsScreen";
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
  addNotification,
  getUnreadNotificationCount,
} from "./src/features/notifications/notificationService";
import {
  syncNotificationActivity,
} from "./src/features/notifications/notificationActivityService";
import {
  FORM_STATUS_STORAGE_KEY,
  loadFormStatuses,
  saveFormStatus,
} from "./src/utils/formStatus";
import {
  hasMeaningfulS500Draft,
  isS500Complete,
} from "./src/utils/s500Status";
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
  profileInitials,
  PROFILE_SETUP_KEY,
  saveAccountProfile,
} from "./src/features/account/accountProfile";
import {
  migrateLegacyAccountWorkspace,
} from "./src/features/account/accountWorkspace";
import {
  accountStorageKey,
  clearActiveAccountId,
  setActiveAccountId,
} from "./src/services/account/accountIdentity";
import { ThemeProvider } from "./src/theme/ThemeContext";
import {
  loadWeatherForecast,
  WEATHER_LOADING,
} from "./src/features/weather/weatherService";
import WorkspaceLoadingScreen from "./src/components/WorkspaceLoadingScreen";
import { FEATURE_SCANNER_ENABLED } from "./src/config/featureFlags";
import {
  normaliseRecentlyOpenedItem,
  RECENTLY_OPENED_KEY,
  RECENTLY_OPENED_LIMIT,
} from "./src/navigation/recentlyOpened";
import {
  getLocalDateKey,
  isS500FormFromDate,
  operationalFormForToday,
} from "./src/utils/dailyFormReset";
const Stack = createNativeStackNavigator();
const WEATHER_PREFERENCE_KEY = "northgroup_one_weather_preference_v1";
const openJobHubFromStack = (navigation, tab = "workspace", params = {}) => {
  const routes = navigation.getState()?.routes || [];
  const request = {
    tab,
    requestKey: `${Date.now()}-${routes.length}`,
    pendingUpload: null,
    formLabel: "",
    focus: null,
    jobDetailsSectionId: "",
    shellTransition: false,
    ...params,
  };
  if (routes.some((route) => route.name === "JobHub")) {
    navigation.popTo("JobHub", request);
    return;
  }
  navigation.navigate("JobHub", request);
};
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

function AppContent() {
  const microsoftAuth = useMicrosoftAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
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
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const weatherRequestId = useRef(0);
  const notificationActivityRequestRef = useRef(false);
  const s500ActiveDateRef = useRef(getLocalDateKey());
  // Job switches run one at a time (see switchWorkspace) so a slow load can
  // never land after a newer one.
  const workspaceQueue = useRef(Promise.resolve());
  const activeJobRef = useRef(null);
  const s500Ref = useRef(emptyS500);
  const formProfile = useMemo(
    () => ({
      ...profile,
      fullName: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
    }),
    [profile],
  );
  const [se14InProgress, setSE14InProgress] = useState([]);
  const se14InProgressRef = useRef(se14InProgress);
  se14InProgressRef.current = se14InProgress;
  activeJobRef.current = activeJob;
  s500Ref.current = s500;
  const [activeSE14RecordId, setActiveSE14RecordId] = useState(null);
  const [formStatuses, setFormStatuses] = useState({});

  useEffect(() => {
    if (!profileHydrated || !microsoftAuth.account?.id || !profileSetupComplete) {
      return undefined;
    }

    let cancelled = false;
    const retryPhotoUploads = () => {
      if (cancelled) return;
      processSurveyPhotoUploadOutbox({
        getAccessToken: microsoftAuth.getAccessToken,
        initials: profileInitials(formProfile),
      }).catch(() => undefined);
    };
    retryPhotoUploads();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") retryPhotoUploads();
    });
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state?.isConnected !== false && state?.isInternetReachable !== false) {
        retryPhotoUploads();
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
      networkSubscription.remove();
    };
  }, [
    microsoftAuth.account?.id,
    microsoftAuth.getAccessToken,
    profileHydrated,
    profileSetupComplete,
    formProfile.initials,
  ]);

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

  const dashboardWorkflow = useMemo(() => buildDashboardWorkflow({
    activeJob,
    formProfile,
    formStatuses,
    s500,
    se14InProgress,
  }), [activeJob, formProfile, formStatuses, s500, se14InProgress]);
  const continueWork = dashboardWorkflow.focus;

  const recordRecentlyOpened = useCallback(async (value) => {
    const item = normaliseRecentlyOpenedItem(value);
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
    async (item, navigation) => {
      const id = item?.id || item;
      const recentItem = normaliseRecentlyOpenedItem(item);
      recordRecentlyOpened(recentItem || id);

      if (recentItem?.type === "jobFile") {
        if (recentItem.webUrl) {
          if (!isTrustedJobFileWebUrl(recentItem.webUrl)) {
            Alert.alert(
              "SharePoint link blocked",
              "This saved link is not a secure NorthGroup SharePoint address. Open Job Files and refresh it.",
            );
            return;
          }
          try {
            await Linking.openURL(recentItem.webUrl);
          } catch {
            Alert.alert(
              "Could not open recent file",
              "Open Job Files and try this SharePoint item again.",
            );
          }
          return;
        }

        openJobHubFromStack(navigation, "files");
        return;
      }

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
      setNotificationUnreadCount(await getUnreadNotificationCount());
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
              .map(normaliseRecentlyOpenedItem)
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
      reportDevelopmentError("Could not load saved forms", error);
    } finally {
      setProfileHydrated(true);
    }
  };

  const loadJobWorkspace = async (
    job,
    profileOverride = formProfile,
    { commitJob } = {},
  ) => {
    const s500Key = jobStorageKey("s500_form", job);
    const s501Key = jobStorageKey("s501_form", job);
    const s506Key = jobStorageKey("s506_form", job);
    const draftKey = jobStorageKey(SE14_DRAFT_KEY, job);
    const recordsKey = jobStorageKey(SE14_IN_PROGRESS_KEY, job);
    const [
      savedS500,
      savedSE14,
      savedRecords,
      savedS501,
      savedS506,
      savedStatuses,
    ] = await Promise.all([
      AsyncStorage.getItem(s500Key),
      AsyncStorage.getItem(draftKey),
      AsyncStorage.getItem(recordsKey),
      AsyncStorage.getItem(s501Key),
      AsyncStorage.getItem(s506Key),
      loadFormStatuses(job),
    ]);
    const workspaceProfile = profileOverride || formProfile;
    const nextStatuses = { ...savedStatuses };

    // Parse every saved value once. A corrupt value no longer stops the whole
    // workspace from loading; a copy of it is kept in the archive instead.
    const [
      storedS500,
      storedSE14,
      storedRecords,
      storedS501,
      storedS506,
    ] = await Promise.all([
      parseStoredJson(s500Key, savedS500, null),
      parseStoredJson(draftKey, savedSE14, null),
      parseStoredJson(recordsKey, savedRecords, null),
      parseStoredJson(s501Key, savedS501, null),
      parseStoredJson(s506Key, savedS506, null),
    ]);

    const parsedS500 = storedS500 ? { ...emptyS500, ...storedS500 } : emptyS500;
    const savedS500IsFromToday = !savedS500 || isS500FormFromDate(parsedS500);
    const loadedS500 = applyProfileDefaults(
      attachJob(
        savedS500IsFromToday ? parsedS500 : emptyS500,
        job,
      ),
      workspaceProfile,
      "s500",
      job,
    );

    // Yesterday's forms are archived, not deleted.
    if (!savedS500IsFromToday) {
      await archiveStaleForm(s500Key, savedS500, { reason: "new-day" });
      delete nextStatuses.s500;
    }

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

    if (storedS501 && operationalFormForToday(storedS501)) {
      nextStatuses.s501 = {
        status: isS501Complete(storedS501) ? "complete" : "draft",
        date: String(storedS501.date || ""),
      };
    } else if (savedS501) {
      await archiveStaleForm(s501Key, savedS501, { reason: "new-day" });
      delete nextStatuses.s501;
    }
    if (storedS506 && operationalFormForToday(storedS506)) {
      nextStatuses.s506 = {
        status: isS506Complete(storedS506) ? "complete" : "draft",
        date: String(storedS506.date || ""),
      };
    } else if (savedS506) {
      await archiveStaleForm(s506Key, savedS506, { reason: "new-day" });
      delete nextStatuses.s506;
    }

    const loadedSE14 = applyProfileDefaults(
      attachJob(
        storedSE14 ? normaliseSE14Form(storedSE14) : emptySE14,
        job,
        "projectNumber",
      ),
      workspaceProfile,
      "se14",
      job,
    );
    const loadedRecords = Array.isArray(storedRecords)
      ? sortSE14Records(normaliseSE14Records(storedRecords))
      : [];

    // Everything above only READ. Now swap the job and its forms in together
    // (same tick) so the app never holds job B with job A's forms.
    commitJob?.();
    setS500(loadedS500);
    setSE14(loadedSE14);
    setSE14InProgress(loadedRecords);
    setFormStatuses(nextStatuses);
    setActiveSE14RecordId(null);
  };

  // Runs job switches strictly one after another. `getResult` does the
  // saving (saveActiveJob / createJob) and returns { active, jobs }.
  const switchWorkspace = (getResult, profileOverride) => {
    const task = async () => {
      const result = await getResult();
      await loadJobWorkspace(result.active, profileOverride, {
        commitJob: () => {
          setActiveJob(result.active);
          setJobs(result.jobs);
        },
      });
      return result;
    };
    const run = workspaceQueue.current.then(task, task);
    workspaceQueue.current = run.catch(() => undefined);
    return run;
  };

  const activateJob = async (job, navigation) => {
    await switchWorkspace(() => saveActiveJob(job, jobs));
    navigation.navigate("Dashboard");
  };

  const refreshTeamsJobs = useCallback(async ({ notify = true } = {}) => {
    const accessToken = await microsoftAuth.getAccessToken();
    const imported = await loadAssignedTeamsJobs({
      accessToken,
      userId: microsoftAuth.account?.id,
    });
    const existingNumbers = new Set(
      jobs.map((job) => String(job?.number || '').trim().toUpperCase()).filter(Boolean),
    );
    const newJobs = imported.filter((job) => (
      job?.number
      && !existingNumbers.has(String(job.number).trim().toUpperCase())
    ));
    if (notify && newJobs.length) {
      let addedCount = 0;
      for (const job of newJobs) {
        const result = await addNotification({
          type: "job",
          title: "New job added",
          message: [job.number, job.name, job.location].filter(Boolean).join(" · "),
          sourceId: `teams-job-${String(job.number).trim().toUpperCase()}`,
          dedupeKey: `teams-job-${String(job.number).trim().toUpperCase()}`,
          target: "Jobs",
          jobNumber: job.number,
          icon: "briefcase-outline",
        });
        if (result.added) addedCount += 1;
      }
      if (addedCount) {
        setNotificationUnreadCount((current) => current + addedCount);
      }
    }
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

  const refreshNotificationActivity = useCallback(async () => {
    if (
      notificationActivityRequestRef.current
      || !profileHydrated
      || !profileSetupComplete
      || !microsoftAuth.account?.id
    ) return null;

    notificationActivityRequestRef.current = true;
    try {
      const accessToken = await microsoftAuth.getAccessToken();
      const result = await syncNotificationActivity({
        accessToken,
        accountId: microsoftAuth.account.id,
        activeJob,
      });
      if (result?.addedCount) {
        setNotificationUnreadCount(await getUnreadNotificationCount());
      }
      return result;
    } catch (error) {
      // Activity checks are intentionally quiet. The Feed and Job Chat screens
      // still show their own connection errors when the user opens them.
      reportDevelopmentError("Could not refresh notification activity", error);
      return null;
    } finally {
      notificationActivityRequestRef.current = false;
    }
  }, [
    activeJob,
    microsoftAuth.account?.id,
    microsoftAuth.getAccessToken,
    profileHydrated,
    profileSetupComplete,
  ]);
  useEffect(() => {
    Promise.all([
      Asset.loadAsync(require("./assets/topo-bg.png")),
      Asset.loadAsync(require("./assets/topo-bg-vertical.png")),
      Asset.loadAsync(require("./assets/first-welcome-field-heritage.jpg")),
      Asset.loadAsync(require("./assets/logo-transparent.png")),
    ]).catch((error) => {
      reportDevelopmentError("Could not prepare app assets", error);
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
      setNotificationUnreadCount(0);
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
    setNotificationUnreadCount(0);
    setActiveAccountId(microsoftAuth.account.id);
    loadSavedForms(microsoftAuth.account).catch((error) => {
      reportDevelopmentError("Could not prepare account workspace", error);
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
        if (active) reportDevelopmentError("Could not refresh weather", error);
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

  useEffect(() => {
    if (!profileHydrated || !activeJob) return undefined;

    const resetForNewDay = async () => {
      const today = getLocalDateKey();
      if (today === s500ActiveDateRef.current) return;

      // Archive yesterday's forms BEFORE clearing anything. If archiving
      // fails this throws, nothing has been touched, and the next tick retries
      // (the date marker below is only moved once everything succeeded).
      const jobAtReset = activeJob;
      for (const base of ["s500_form", "s501_form", "s506_form"]) {
        const key = jobStorageKey(base, jobAtReset);
        const stored = await AsyncStorage.getItem(key);
        if (base === "s500_form" && hasMeaningfulS500Draft(s500Ref.current)) {
          // Unsaved on-screen edits are newer than the stored copy.
          await archiveStaleForm(key, JSON.stringify(s500Ref.current), {
            reason: "new-day",
            remove: false,
          });
        }
        await archiveStaleForm(key, stored, { reason: "new-day" });
      }

      // The user may have switched jobs while we were archiving.
      if (activeJobRef.current?.number !== jobAtReset?.number) return;

      s500ActiveDateRef.current = today;
      setS500(applyProfileDefaults(
        attachJob(emptyS500, jobAtReset),
        formProfile,
        "s500",
        jobAtReset,
      ));
      // One at a time: each call reads, edits and rewrites the same status
      // record, so running them together lets one overwrite the other.
      for (const formId of ["s500", "s501", "s506"]) {
        await updateCurrentFormStatus(formId, "none");
      }
    };

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resetForNewDay().catch((error) => {
        reportDevelopmentError("Could not reset S-500 for the new day", error);
      });
    });
    const midnightCheckInterval = setInterval(() => {
      resetForNewDay().catch((error) => {
        reportDevelopmentError("Could not reset S-500 for the new day", error);
      });
    }, 30 * 1000);

    return () => {
      appStateSubscription.remove();
      clearInterval(midnightCheckInterval);
    };
  }, [activeJob, formProfile, profileHydrated]);

  useEffect(() => {
    if (!profileHydrated || !profileSetupComplete || !microsoftAuth.account?.id) {
      return undefined;
    }

    const syncWhenActive = () => {
      if (AppState.currentState === "active") refreshNotificationActivity();
    };

    syncWhenActive();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshNotificationActivity();
    });
    const refreshInterval = setInterval(syncWhenActive, 45 * 1000);

    return () => {
      appStateSubscription.remove();
      clearInterval(refreshInterval);
    };
  }, [
    microsoftAuth.account?.id,
    profileHydrated,
    profileSetupComplete,
    refreshNotificationActivity,
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
      reportDevelopmentError("Could not save weather preference", error);
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
    const job = activeJob;
    if (!job) throw new Error("Select a job before saving GNSS sessions.");

    // 1) Write to the phone first. If this fails it throws, and the screen
    //    has not been changed, so it never shows data that isn't saved.
    await AsyncStorage.setItem(
      jobStorageKey(SE14_IN_PROGRESS_KEY, job),
      JSON.stringify(sortedRecords),
    );

    // 2) Only then update what's on screen - and only if we are still on the
    //    same job (the user may have switched while the write was running).
    if (activeJobRef.current?.number === job.number) {
      se14InProgressRef.current = sortedRecords;
      setSE14InProgress(sortedRecords);
    }

    return sortedRecords;
  };

  const saveSE14DraftProgress = async ({ silent = false } = {}) => {
    try {
      const draft = normaliseSE14Form(se14);

      await AsyncStorage.setItem(
        jobStorageKey(SE14_DRAFT_KEY, activeJob),
        JSON.stringify(draft),
      );
      await updateCurrentFormStatus("se14", "draft", {
        date: draft.startDate,
      });

      if (!silent) {
        Alert.alert(
          "Progress saved",
          "This Start Session remains a draft and can be continued from GNSS Static Sessions.",
        );
      }

      return true;
    } catch (error) {
      Alert.alert("Save failed", String(error?.message || error));
      return false;
    }
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

  const saveActiveSE14Record = async ({
    silent = false,
    formOverride,
  } = {}) => {
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

      const updatedRecord = updateSE14Record(
        currentRecord,
        formOverride || se14,
      );

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

  const startNewSE14 = async (roundMode = "current") => {
    setActiveSE14RecordId(null);

    const prepareForm = (source) => {
      const draft = roundMode === "next" ? emptySE14 : source;
      const round = resolveSE14RoundAssignment({ records: se14InProgressRef.current, form: draft, roundMode });
      return applyProfileDefaults(attachJob(applySE14RoundAssignment(draft, round), activeJob, "projectNumber"), formProfile, "se14", activeJob);
    };

    try {
      const savedDraft = await AsyncStorage.getItem(
        jobStorageKey(SE14_DRAFT_KEY, activeJob),
      );
      setSE14(prepareForm(savedDraft ? normaliseSE14Form(JSON.parse(savedDraft)) : emptySE14));
    } catch (error) {
      reportDevelopmentError("Could not load the SE-14 draft", error);
      setSE14(prepareForm(emptySE14));
    }
  };

  // Runs a change against ONE job's saved GNSS sessions, whichever job is open
  // right now. A finished SharePoint upload can complete after the user has
  // moved to a different job; its result must be saved against the job it
  // belongs to, never against the records of the job now on screen.
  const withSE14RecordsForJob = async (jobNumber, apply) => {
    const same = (a, b) =>
      String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
    const wanted = String(jobNumber || "").trim();

    if (!wanted || same(wanted, activeJobRef.current?.number)) {
      // The job on screen: use the live records and keep the screen in step.
      return apply({
        records: se14InProgressRef.current,
        persistRecords: persistSE14Records,
      });
    }

    // Another job: read, change and write ITS stored records only.
    const target = jobs.find((item) => same(item.number, wanted));
    if (!target) return false; // the job was deleted; nothing to update
    const key = jobStorageKey(SE14_IN_PROGRESS_KEY, target);
    const stored = await parseStoredJson(key, await AsyncStorage.getItem(key), []);
    return apply({
      records: sortSE14Records(
        normaliseSE14Records(Array.isArray(stored) ? stored : []),
      ),
      persistRecords: async (next) => {
        const sorted = sortSE14Records(next);
        await AsyncStorage.setItem(key, JSON.stringify(sorted));
        return sorted;
      },
    });
  };

  const archiveSE14Record = (
    recordId,
    { reason = "manual", silent = false, jobNumber = "" } = {},
  ) => withSE14RecordsForJob(jobNumber, async ({ records, persistRecords }) => {
    const currentRecord = records.find((record) => record.id === recordId);

    if (!currentRecord) {
      if (!silent) {
        Alert.alert("Archive failed", "This GNSS session could not be found.");
      }
      return false;
    }

    const archivedRecord = archiveSE14RecordState(currentRecord, reason);

    if (archivedRecord === currentRecord) {
      return currentRecord.status === "archived";
    }

    try {
      await persistRecords(
        records.map((record) =>
          record.id === recordId ? archivedRecord : record,
        ),
      );

      if (!silent) {
        Alert.alert(
          "Session archived",
          `${archivedRecord.name} is available in Archived Sessions.`,
        );
      }

      return true;
    } catch (error) {
      if (!silent) {
        Alert.alert("Archive failed", String(error?.message || error));
      }
      return false;
    }
  });

  const saveSE14ForUploadDay = (pdf) => saveSE14ForUploadDayWithFeedback({
    form: se14, pdf, recordId: activeSE14RecordId, records: se14InProgress,
    persistRecords: persistSE14Records, updateFormStatus: updateCurrentFormStatus,
    alert: Alert.alert,
  });

  const handleSE14PendingUpload = async (upload) => {
    try {
      if (upload?.source === "se14-day" && Array.isArray(upload?.recordIds)) {
        await withSE14RecordsForJob(upload.jobNumber, ({ records, persistRecords }) =>
          persistSE14UploadCompletion({
            recordIds: upload.recordIds,
            records,
            persistRecords,
          }),
        );
      } else if (upload?.source === "se14" && upload?.recordId) {
        await archiveSE14Record(upload.recordId, {
          reason: "sharepoint",
          silent: true,
          jobNumber: upload.jobNumber,
        });
      }
    } catch (error) {
      reportDevelopmentError("Could not update the GNSS upload status", error);
    }
  };

  const restoreSE14Record = async (recordId) => {
    const currentRecord = se14InProgress.find(
      (record) => record.id === recordId,
    );

    if (!currentRecord) {
      Alert.alert("Restore failed", "This GNSS session could not be found.");
      return false;
    }

    const restoredRecord = restoreSE14RecordState(currentRecord);

    if (restoredRecord === currentRecord) {
      return currentRecord.status !== "archived";
    }

    try {
      await persistSE14Records(
        se14InProgress.map((record) =>
          record.id === recordId ? restoredRecord : record,
        ),
      );
      return true;
    } catch (error) {
      Alert.alert("Restore failed", String(error?.message || error));
      return false;
    }
  };

  const deleteSE14Record = async (recordId) => {
    const recordToDelete = se14InProgress.find(
      (record) => record.id === recordId,
    );

    if (!recordToDelete || recordToDelete.status !== "archived") {
      Alert.alert(
        "Delete unavailable",
        "Only an archived GNSS session can be permanently deleted.",
      );
      return false;
    }

    try {
      await persistSE14Records(
        se14InProgress.filter((record) => record.id !== recordId),
      );

      await deleteSE14FormPhotos(recordToDelete.data);

      if (activeSE14RecordId === recordId) {
        setActiveSE14RecordId(null);
        setSE14(emptySE14);
      }

      return true;
    } catch (error) {
      Alert.alert("Delete failed", String(error?.message || error));
      return false;
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
                reportDevelopmentError(
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
    const result = await exportS500PdfFile(s500, profileInitials(formProfile));
    if (result?.exported) {
      await updateCurrentFormStatus("s500", "complete", { date: s500.date });
    }
    return result;
  };

  const emailS500Pdf = async () => {
    const result = await emailS500PdfFile(s500, profileInitials(formProfile));
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

    const result = await exportSE14PdfFile(se14, onPrepared, profileInitials(formProfile));

    if (!result?.exported || !activeSE14RecordId) {
      return result;
    }

    const exportedAt = new Date().toISOString();
    const currentRecord = se14InProgress.find(
      (record) => record.id === activeSE14RecordId,
    );

    if (!currentRecord) return result;

    const remainsArchived = currentRecord.status === "archived";
    const completedAt = currentRecord.completedAt || exportedAt;

    try {
      await persistSE14Records(
        se14InProgress.map((record) =>
          record.id === activeSE14RecordId
            ? {
                ...updateSE14Record(record, se14),
                status: remainsArchived ? "archived" : "complete",
                completedAt,
                lastExportedAt: exportedAt,
              }
            : record,
        ),
      );
      // Mark the form complete only once the record is really saved.
      await updateCurrentFormStatus("se14", "complete", {
        date: se14.startDate,
        completedAt,
      });
    } catch (error) {
      Alert.alert(
        "PDF exported, but not recorded",
        `The PDF was created, but this session could not be marked complete on the phone: ${String(error?.message || error)}`,
      );
      return result;
    }

    Alert.alert(
      "Record exported",
      remainsArchived
        ? "The PDF was exported and this session remains available in Archived Sessions."
        : "The PDF was exported and this session is now marked complete. It remains available in Review & Complete until you archive it.",
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
    setNotificationUnreadCount(0);
  };

  const openNotification = async (notification, navigation) => {
    const target = notification?.target;
    if (target === "Jobs") {
      navigation.popTo("Jobs");
      return;
    }

    if (target === "FeedHome") {
      navigation.navigate("FeedHome", {
        channelKey: notification?.targetParams?.channelKey || "all",
      });
      return;
    }

    if (target === "JobChat") {
      const targetNumber = String(
        notification?.jobNumber || notification?.targetParams?.jobNumber || "",
      ).trim().toUpperCase();
      const targetJob = jobs.find(
        (job) => String(job?.number || "").trim().toUpperCase() === targetNumber,
      );

      if (!targetJob) {
        navigation.popTo("Jobs");
        return;
      }

      if (String(activeJob?.number || "").trim().toUpperCase() !== targetNumber) {
        await switchWorkspace(() => saveActiveJob(targetJob, jobs));
      }
      navigation.navigate("JobChat");
      return;
    }

    if (["TodaysJob", "JobFiles", "KmlEditor"].includes(target)) {
      const targetNumber = String(
        notification?.jobNumber || notification?.targetParams?.jobNumber || "",
      ).trim().toUpperCase();
      const targetJob = targetNumber
        ? jobs.find(
          (job) => String(job?.number || "").trim().toUpperCase() === targetNumber,
        )
        : activeJob;

      if (!targetJob) {
        navigation.popTo("Jobs");
        return;
      }

      const targetJobNumber = String(targetJob?.number || "").trim().toUpperCase();
      if (String(activeJob?.number || "").trim().toUpperCase() !== targetJobNumber) {
        await switchWorkspace(() => saveActiveJob(targetJob, jobs));
      }

      if (target === "KmlEditor") {
        navigation.navigate("KmlEditor");
        return;
      }

      openJobHubFromStack(
        navigation,
        target === "JobFiles" ? "files" : "workspace",
        target === "TodaysJob" ? notification?.targetParams || {} : {},
      );
    }
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
                  await switchWorkspace(() => createJob(values, jobs));
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
                  initials: profileInitials(profile),
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
                openTodaysJob={() => openJobHubFromStack(navigation, "workspace")}
                openJobs={() => navigation.popTo("Jobs")}
                continueWork={continueWork}
                continueSectionTitle={dashboardWorkflow.sectionTitle}
                preStartAction={dashboardWorkflow.preStartAction}
                recommendedQuickAction={dashboardWorkflow.recommendedQuickAction}
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

                  if (continueWork?.type === "workspace") {
                    openJobHubFromStack(navigation, "workspace");
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
                openForms={() => activeJob
                  ? openJobHubFromStack(navigation, "forms")
                  : navigation.popTo("Jobs")}
                openJobFiles={() => activeJob
                  ? openJobHubFromStack(navigation, "files")
                  : navigation.popTo("Jobs")}
                openFeed={() => navigation.navigate("FeedHome")}
                openChats={() => {
                  if (!activeJob) {
                    navigation.popTo("Jobs");
                    return;
                  }
                  navigation.navigate("JobChat");
                }}
                openNotifications={() => navigation.navigate("Notifications")}
                notificationCount={notificationUnreadCount}
                openWeather={() => {
                  recordRecentlyOpened("weather");
                  navigation.navigate("Weather");
                }}
                onRefreshWeather={refreshWeatherManually}
                weatherRefreshing={weatherRefreshing}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Notifications">
            {({ navigation }) => (
              <NotificationsScreen
                goBack={() => navigation.goBack()}
                onUnreadCountChange={setNotificationUnreadCount}
                onRefreshActivity={refreshNotificationActivity}
                onOpenNotification={(notification) => openNotification(notification, navigation)}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="FeedHome">
            {({ navigation, route }) => (
              <ChatHomeScreen
                profile={formProfile}
                account={microsoftAuth.account}
                profilePhotoUri={microsoftAuth.profilePhotoUri}
                profilePhotoRevision={microsoftAuth.profilePhotoRevision}
                getAccessToken={microsoftAuth.getAccessToken}
                initialFilter={route.params?.channelKey || "all"}
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

          <Stack.Screen
            name="JobHub"
            options={({ route }) => ({
              gestureEnabled: true,
              fullScreenGestureEnabled: false,
              animation: "fade",
            })}
          >
            {({ navigation, route }) => (
              <JobHubScreen
                job={activeJob}
                loading={loading}
                initialTab={route.params?.tab || "workspace"}
                navigationRequestKey={route.params?.requestKey || ""}
                pendingUpload={route.params?.pendingUpload || null}
                formLabel={route.params?.formLabel || ""}
                onPendingUploadHandled={handleSE14PendingUpload}
                goDashboard={() => navigation.popTo("Dashboard")}
                getAccessToken={microsoftAuth.getAccessToken}
                onRecentlyOpened={recordRecentlyOpened}
                updatedBy={
                  microsoftAuth.account?.displayName
                  || `${formProfile.firstName || ""} ${formProfile.lastName || ""}`.trim()
                }
                progressRefreshRequest={
                  route.params?.focus === "progress"
                    ? {
                      requestId: route.params?.requestKey || `${Date.now()}`,
                    }
                    : null
                }
                progressFocusRequest={
                  route.params?.focus === "progress"
                    ? {
                      requestId: route.params?.requestKey || `${Date.now()}`,
                      eventId: route.params?.progressEventId || "",
                      taskId: route.params?.progressTaskId || "",
                      taskName: route.params?.progressTaskName || "",
                      completed: route.params?.progressCompleted,
                      target: route.params?.progressTarget,
                      unit: route.params?.progressUnit || "",
                      fromRatio: route.params?.progressFromRatio || 0,
                    }
                    : null
                }
                jobDetailsFocusRequest={
                  route.params?.focus === "jobDetails"
                    ? {
                      requestId: route.params?.requestKey || `${Date.now()}`,
                      sectionId: route.params?.jobDetailsSectionId || "",
                    }
                    : null
                }
                onProgressNotificationsAdded={async () => {
                  setNotificationUnreadCount(await getUnreadNotificationCount());
                }}
                onBriefSaved={async (brief) => {
                  if (!activeJob?.number) return;
                  const nextJobs = await updateJob(
                    activeJob.number,
                    {
                      fieldWorkType: brief.workType,
                      fieldDetails: brief.details,
                      fieldDetailsUpdatedAt: brief.updatedAt,
                      fieldDetailsUpdatedBy: brief.updatedBy,
                    },
                    jobs,
                  );
                  const updated = nextJobs.find(
                    (item) => item.number === activeJob.number,
                  );
                  if (!updated) return;
                  const result = await saveActiveJob(updated, nextJobs);
                  setActiveJob(result.active);
                  setJobs(result.jobs);
                }}
                onUpdateJob={async (changes) => {
                  if (!activeJob?.number) return;
                  const nextJobs = await updateJob(
                    activeJob.number,
                    changes,
                    jobs,
                  );
                  const updated = nextJobs.find(
                    (item) => item.number === activeJob.number,
                  );
                  if (!updated) return;
                  const result = await saveActiveJob(updated, nextJobs);
                  setActiveJob(result.active);
                  setJobs(result.jobs);
                }}
                openKml={() => navigation.navigate("KmlEditor")}
                openTmrFeatureGuide={() => {
                  recordRecentlyOpened("tmrFeatureGuide");
                  setSelectedTmrFeature(null);
                  navigation.navigate("TmrFeatureGuide", {
                    backLabel: "Workspace",
                  });
                }}
                openCapture={() => {
                  recordRecentlyOpened("surveyPhoto");
                  navigation.navigate("SurveyPhoto", {
                    backLabel: "Workspace",
                    initialTab: "capture",
                    launchCameraAt: Date.now(),
                  });
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
              />
            )}
          </Stack.Screen>

          <Stack.Screen
            name="KmlEditor"
            options={{
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
              animation: "slide_from_right",
            }}
          >
            {({ navigation }) => (
              <KmlEditorScreen
                job={activeJob}
                getAccessToken={microsoftAuth.getAccessToken}
                goBack={() => navigation.goBack()}
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
                openDiagnostics={() => navigation.navigate("Diagnostics")}
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
                  const savedProfile = await saveAccountProfile(cleanProfile);
                  setProfile(savedProfile);
                  setS500((current) => applyProfileDefaults(
                    current,
                    savedProfile,
                    "s500",
                    activeJob,
                  ));
                  setSE14((current) => applyProfileDefaults(
                    current,
                    savedProfile,
                    "se14",
                    activeJob,
                  ));
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Diagnostics">
            {({ navigation }) => (
              <DiagnosticsScreen
                profile={formProfile}
                microsoftAccount={microsoftAuth.account}
                activeJob={activeJob}
                getAccessToken={microsoftAuth.getAccessToken}
                goBack={() => navigation.goBack()}
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
                  if (!FEATURE_SCANNER_ENABLED) {
                    Alert.alert(
                      "Feature Scanner under development",
                      "This tool is temporarily locked while we build and test the Meshroom 3D processing workflow. It will return when the complete scan pipeline is ready.",
                      [{ text: "OK" }],
                    );
                    return;
                  }
                  navigation.navigate("FeatureScanner");
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="FeatureScanner">
            {({ navigation }) => (
              <FeatureScannerScreen
                activeJob={activeJob} accountProfile={formProfile}
                getAccessToken={microsoftAuth.getAccessToken}
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
                getAccessToken={microsoftAuth.getAccessToken}
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
                onFormStatusChange={updateCurrentFormStatus}
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
                    return;
                  }

                  if (targetScreen === "jobFiles") {
                    openJobHubFromStack(navigation, "files");
                  }
                }}
                openJobFiles={(payload = {}) => (
                  openJobHubFromStack(navigation, "files", payload)
                )}
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
                openJobFiles={(payload = {}) => (
                  openJobHubFromStack(navigation, "files", payload)
                )}
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
                openJobFiles={(payload = {}) => (
                  openJobHubFromStack(navigation, "files", payload)
                )}
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
                recordId={activeSE14RecordId}
                saveSE14DraftProgress={saveSE14DraftProgress}
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
                saveSE14ForUploadDay={saveSE14ForUploadDay}
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
                setScreen={async (targetScreen) => {
                  if (targetScreen === "formMenu") {
                    if (activeSE14RecordId) {
                      await saveActiveSE14Record({ silent: true });
                    }
                    navigation.goBack();
                    return;
                  }

                  if (targetScreen === "se14MeasurementGuide") {
                    navigation.navigate("SE14MeasurementGuide");
                    return;
                  }

                  if (targetScreen === "jobFiles") {
                    openJobHubFromStack(navigation, "files");
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
                accountProfile={formProfile}
                startSession={async ({ roundMode = "current" } = {}) => {
                  await startNewSE14(roundMode);
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
                archiveRecord={archiveSE14Record}
                restoreRecord={restoreSE14Record}
                deleteRecord={deleteSE14Record}
                editSessionNumbers={(options) => saveSE14BulkSessionNumberEdit({ ...options, records: se14InProgressRef.current, persistRecords: persistSE14Records, alert: Alert.alert })}
                uploadDay={(payload = {}) => openJobHubFromStack(navigation, "files", {
                  formLabel: `${payload.folderName || "GNSS day"} · ${payload.assets?.length || 0} PDFs`, pendingUpload: payload,
                })}
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
            {({ navigation, route }) => (
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
                backLabel={route.params?.backLabel || "Field Tools"}
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
      <View style={{ flex: 1 }}>
        <AppContent />
        <AppPrivacyShield />
      </View>
    </SafeAreaProvider>
  );
}