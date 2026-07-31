import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Linking,
  Modal,
  NativeModules,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SURVEY_IMAGE_TYPES } from "../constants/imageTypes";
import {
  formatFileSize,
  GOLD,
  NAVY,
  PHOTO_BOTTOM_NAV_HEIGHT,
  ZIP_EMAIL_WARNING_BYTES,
} from "../constants/photoTheme";
import { STAFF_NAMES } from "../../../constants/staffNames";
import AppHeader from "../../../components/AppHeader";
import PhotoCameraView from "../components/PhotoCameraView";
import PhotoDeleteConfirmModal from "../components/PhotoDeleteConfirmModal";
import PhotoExportView from "../components/PhotoExportView";
import PhotoGalleryView from "../components/PhotoGalleryView";
import PhotoHomeView from "../components/PhotoHomeView";
import PhotoMoreView from "../components/PhotoMoreView";
import PhotoReviewModal from "../components/PhotoReviewModal";
import PhotoViewerModal from "../components/PhotoViewerModal";
import {
  DoneButton,
  GoldButton,
  Input,
  Label,
} from "../components/PhotoUi";
import SurveyPhotoBottomBar from "../components/SurveyPhotoBottomBar";
import SurveyPhotoHeader from "../components/SurveyPhotoHeader";
import SurveyorPickerModal from "../components/SurveyorPickerModal";
import styles from "../styles/surveyPhotoStyles";
import {
  createProject,
  emptyPhotoBin,
  exportProjectZip,
  exportSelectedPhotosZip,
  listProjects,
  movePhotoToBin,
  movePhotosToBin,
  permanentlyDeletePhoto,
  permanentlyDeletePhotos,
  restorePhotoFromBin,
  getPhotoDateKey,
  getSurveyorInitials,
  saveCapturedPhoto,
  saveProject,
} from "../services/surveyPhotoStorage";

const isDownwardSingleFingerGesture = (
  gesture,
  minimumDistance = 10,
  directionRatio = 1.12,
) => {
  const activeTouches = gesture.numberActiveTouches || 1;
  return (
    activeTouches <= 1 &&
    gesture.dy > minimumDistance &&
    gesture.dy > Math.abs(gesture.dx) * directionRatio
  );
};

const shouldFinishDownwardDismiss = (gesture) => {
  const mostlyVertical = gesture.dy > Math.abs(gesture.dx) * 1.04;
  return (
    mostlyVertical && (gesture.dy > 52 || (gesture.dy > 30 && gesture.vy > 0.6))
  );
};

export default function SurveyPhotoScreen({
  goBack,
  accountProfile,
  activeJob,
  initialFeature,
  initialTab,
  launchCameraAt,
  backLabel = "Dashboard",
}) {
  const insets = useSafeAreaInsets();
  const { width: viewerWidth, height: viewerHeight } = useWindowDimensions();
  const requestedTab = [
    "home",
    "capture",
    "gallery",
    "qa",
    "more",
  ].includes(initialTab)
    ? initialTab
    : "home";
  const cameraRef = useRef(null);
  const captureInFlightRef = useRef(false);
  const captureHandlerRef = useRef(null);
  const lastVolumeShutterAtRef = useRef(0);
  const permissionAlertShown = useRef(false);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [projectNumber, setProjectNumber] = useState(activeJob?.number || "");
  const [startPhotoId, setStartPhotoId] = useState("1000");
  const [surveyor, setSurveyor] = useState(accountProfile?.fullName || "");
  const [photoId, setPhotoId] = useState("");
  const [pointId, setPointId] = useState("");
  const [imageType, setImageType] = useState("");
  const [customType, setCustomType] = useState("");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [flash, setFlash] = useState("off");
  const [tab, setTab] = useState(requestedTab);
  const [surveyorPicker, setSurveyorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveToPhotos, setSaveToPhotos] = useState(false);
  const [repeatLastType, setRepeatLastType] = useState(true);
  const [lastSaved, setLastSaved] = useState("");
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const saveConfirmationTimerRef = useRef(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [previewPhotos, setPreviewPhotos] = useState([]);
  const [galleryType, setGalleryType] = useState("All");
  const [libraryMode, setLibraryMode] = useState("library");
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const selectedPhotoIdsRef = useRef([]);
  const selectionModeRef = useRef(false);
  const galleryScrollRef = useRef(null);
  const galleryScrollYRef = useRef(0);
  const galleryViewportRef = useRef({ top: 0, height: 0 });
  const galleryGridLayoutRef = useRef({ x: 0, y: 0 });
  const galleryAutoScrollFrameRef = useRef(null);
  const galleryDragConfigRef = useRef({
    photos: [],
    tileSize: 1,
    columns: 3,
    gap: 3,
  });
  const galleryDragRef = useRef({
    active: false,
    selecting: true,
    anchorIndex: -1,
    currentIndex: -1,
    baseline: new Set(),
    pageX: 0,
    pageY: 0,
  });
  const [cameraZoom, setCameraZoom] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraZoomRef = useRef(0);
  const [exportWholeProject, setExportWholeProject] = useState(true);
  const [selectedExportDates, setSelectedExportDates] = useState([]);
  const [pendingShot, setPendingShot] = useState(null);
  const [savingText, setSavingText] = useState("Preparing camera…");
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(0);
  const cameraDismissY = useRef(new Animated.Value(0)).current;

  selectionModeRef.current = selectionMode;
  selectedPhotoIdsRef.current = selectedPhotoIds;

  const photoIndexAtPoint = (x, y) => {
    const config = galleryDragConfigRef.current;
    const pitch = config.tileSize + config.gap;
    const column = Math.floor(x / pitch);
    const row = Math.floor(y / pitch);
    if (
      column < 0 ||
      column >= config.columns ||
      row < 0 ||
      x - column * pitch > config.tileSize ||
      y - row * pitch > config.tileSize
    )
      return -1;

    const index = row * config.columns + column;
    return config.photos[index] ? index : -1;
  };

  const applyIphoneSelectionRange = (index) => {
    const drag = galleryDragRef.current;
    const photos = galleryDragConfigRef.current.photos;
    if (!drag.active || index < 0 || index === drag.currentIndex) return;

    drag.currentIndex = index;
    const first = Math.min(drag.anchorIndex, index);
    const last = Math.max(drag.anchorIndex, index);
    const nextSet = new Set(drag.baseline);
    for (let photoIndex = first; photoIndex <= last; photoIndex += 1) {
      const photo = photos[photoIndex];
      if (!photo) continue;
      if (drag.selecting) nextSet.add(photo.id);
      else nextSet.delete(photo.id);
    }
    const next = [...nextSet];
    selectedPhotoIdsRef.current = next;
    setSelectedPhotoIds(next);
  };

  const updateDragSelectionFromPagePoint = (pageX, pageY) => {
    const viewport = galleryViewportRef.current;
    const grid = galleryGridLayoutRef.current;
    const contentX = pageX - viewport.left - grid.x;
    const contentY =
      pageY - viewport.top + galleryScrollYRef.current - grid.y;
    applyIphoneSelectionRange(photoIndexAtPoint(contentX, contentY));
  };

  const stopGalleryAutoScroll = () => {
    if (galleryAutoScrollFrameRef.current != null) {
      cancelAnimationFrame(galleryAutoScrollFrameRef.current);
      galleryAutoScrollFrameRef.current = null;
    }
  };

  const runGalleryAutoScroll = () => {
    stopGalleryAutoScroll();
    const tick = () => {
      const drag = galleryDragRef.current;
      const viewport = galleryViewportRef.current;
      if (!drag.active || !viewport.height) return;

      const edge = 76;
      const distanceFromTop = drag.pageY - viewport.top;
      const distanceFromBottom =
        viewport.top + viewport.height - drag.pageY;
      let delta = 0;
      if (distanceFromTop < edge)
        delta = -Math.max(2, ((edge - distanceFromTop) / edge) * 15);
      else if (distanceFromBottom < edge)
        delta = Math.max(2, ((edge - distanceFromBottom) / edge) * 15);

      if (delta) {
        const nextY = Math.max(0, galleryScrollYRef.current + delta);
        galleryScrollYRef.current = nextY;
        galleryScrollRef.current?.scrollTo({ y: nextY, animated: false });
        updateDragSelectionFromPagePoint(drag.pageX, drag.pageY);
      }
      galleryAutoScrollFrameRef.current = requestAnimationFrame(tick);
    };
    galleryAutoScrollFrameRef.current = requestAnimationFrame(tick);
  };

  const gallerySelectionResponder = useRef(
    PanResponder.create({
      // Leave taps to each thumbnail and vertical swipes to the ScrollView.
      // A deliberate sideways/diagonal movement starts iPhone-style range
      // selection without locking normal Gallery scrolling in Select mode.
      onStartShouldSetPanResponderCapture: () => false,
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (!selectionModeRef.current) return false;
        const horizontal = Math.abs(gesture.dx);
        const vertical = Math.abs(gesture.dy);
        return horizontal > 7 && horizontal > vertical * 0.85;
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (!selectionModeRef.current) return false;
        const horizontal = Math.abs(gesture.dx);
        const vertical = Math.abs(gesture.dy);
        return horizontal > 7 && horizontal > vertical * 0.85;
      },
      onPanResponderGrant: (event, gesture) => {
        const pageX = Number.isFinite(gesture.x0)
          ? gesture.x0
          : event.nativeEvent.pageX;
        const pageY = Number.isFinite(gesture.y0)
          ? gesture.y0
          : event.nativeEvent.pageY;
        const viewport = galleryViewportRef.current;
        const grid = galleryGridLayoutRef.current;
        const contentX = pageX - viewport.left - grid.x;
        const contentY =
          pageY - viewport.top + galleryScrollYRef.current - grid.y;
        const index = photoIndexAtPoint(contentX, contentY);
        const photo = galleryDragConfigRef.current.photos[index];
        const baseline = new Set(selectedPhotoIdsRef.current);
        galleryDragRef.current = {
          active: true,
          selecting: photo
            ? !selectedPhotoIdsRef.current.includes(photo.id)
            : true,
          anchorIndex: index,
          currentIndex: -1,
          baseline,
          pageX,
          pageY,
        };
        applyIphoneSelectionRange(index);
        runGalleryAutoScroll();
      },
      onPanResponderMove: (event) => {
        if (!galleryDragRef.current.active) return;
        const { pageX, pageY } = event.nativeEvent;
        galleryDragRef.current.pageX = pageX;
        galleryDragRef.current.pageY = pageY;
        updateDragSelectionFromPagePoint(pageX, pageY);
      },
      onPanResponderRelease: () => {
        galleryDragRef.current.active = false;
        stopGalleryAutoScroll();
      },
      onPanResponderTerminate: () => {
        galleryDragRef.current.active = false;
        stopGalleryAutoScroll();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const exitCameraToWorkspace = () => {
    setCameraReady(false);
    setTab("home");
  };

  const cameraPinchResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          event.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponder: (event) =>
          event.nativeEvent.touches.length === 2,
        onPanResponderGrant: (event) => {
          const [a, b] = event.nativeEvent.touches;
          if (!a || !b) return;
          pinchStartDistance.current = Math.hypot(
            a.pageX - b.pageX,
            a.pageY - b.pageY,
          );
          pinchStartZoom.current = cameraZoomRef.current;
        },
        onPanResponderMove: (event) => {
          const [a, b] = event.nativeEvent.touches;
          if (!a || !b || !pinchStartDistance.current) return;
          const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          const change = (distance - pinchStartDistance.current) / 300;
          const nextZoom = Math.max(
            0,
            Math.min(1, pinchStartZoom.current + change),
          );
          cameraZoomRef.current = nextZoom;
          setCameraZoom(nextZoom);
        },
        onPanResponderRelease: () => {
          pinchStartDistance.current = 0;
        },
        onPanResponderTerminate: () => {
          pinchStartDistance.current = 0;
        },
      }),
    [],
  );

  const cameraDismissResponder = useMemo(() => {
    const shouldDismiss = (_, gesture) =>
      !keyboardVisible && isDownwardSingleFingerGesture(gesture);
    const resetCameraPosition = () =>
      Animated.spring(cameraDismissY, {
        toValue: 0,
        speed: 24,
        bounciness: 5,
        useNativeDriver: true,
      }).start();
    const finishCameraDismiss = () =>
      Animated.timing(cameraDismissY, {
        toValue: Math.max(viewerHeight, 700),
        duration: 170,
        useNativeDriver: true,
      }).start(exitCameraToWorkspace);

    return PanResponder.create({
      // The camera keeps the same deliberate one-finger vertical gesture as
      // the photo viewer; two fingers remain available for camera pinch zoom.
      onMoveShouldSetPanResponderCapture: shouldDismiss,
      onMoveShouldSetPanResponder: shouldDismiss,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => cameraDismissY.setValue(0),
      onPanResponderMove: (_, gesture) =>
        cameraDismissY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (shouldFinishDownwardDismiss(gesture)) finishCameraDismiss();
        else resetCameraPosition();
      },
      onPanResponderTerminate: (_, gesture) => {
        if (shouldFinishDownwardDismiss(gesture)) finishCameraDismiss();
        else resetCameraPosition();
      },
    });
  }, [cameraDismissY, exitCameraToWorkspace, keyboardVisible, viewerHeight]);

  useEffect(() => {
    cameraDismissY.setValue(0);
    if (tab !== "capture") setCameraReady(false);
  }, [cameraDismissY, tab]);

  useEffect(() => {
    if (
      requestedTab === "capture" &&
      (initialTab === "capture" || launchCameraAt)
    ) {
      setTab("capture");
    }
  }, [initialTab, launchCameraAt, requestedTab]);

  const closePreview = () => {
    setPreviewPhoto(null);
    setPreviewPhotos([]);
  };

  const closePreviewToGallery = () => {
    closePreview();
    setLibraryMode("library");
    setGalleryType("All");
    setTab("gallery");
  };

  const openPreview = (photo, collection) => {
    setPreviewPhotos(collection);
    setPreviewPhoto(photo);
  };

  const sharePhoto = async (photo) => {
    if (!photo?.uri) return;
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is not available on this device.");
      await Sharing.shareAsync(photo.uri, {
        mimeType: "image/jpeg",
        dialogTitle: photo.fileName || "Share survey photo",
      });
    } catch (error) {
      Alert.alert("Photo not shared", error.message || "Please try again.");
    }
  };

  const savePhotoCopy = async (photo) => {
    if (!photo?.uri) return;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photos permission required",
          "Allow Photos access to save a convenience copy. The official photo remains safely stored in the project.",
        );
        return;
      }
      await MediaLibrary.createAssetAsync(photo.uri);
      Alert.alert(
        "Copy saved",
        "A convenience copy was saved to iPhone Photos. The project copy remains the official record.",
      );
    } catch (error) {
      Alert.alert("Copy not saved", error.message || "Please try again.");
    }
  };

  const requestProtectedDelete = (photo, permanent = false) => {
    setDeleteConfirmation("");
    if (!permanent) {
      Alert.alert(
        "Move to Bin?",
        `${photo?.fileName || "This photo"} will be removed from the project library and can be restored from the Bin.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move to Bin",
            style: "destructive",
            onPress: async () => {
              try {
                const next = await movePhotoToBin(project, photo);
                setProject(next);
                closePreview();
              } catch (error) {
                Alert.alert("Photo not moved", error.message || "Please try again.");
              }
            },
          },
        ],
      );
      return;
    }
    setDeleteRequest({ photo, permanent: true, action: "single" });
  };

  const confirmProtectedDelete = async () => {
    if (
      deleteConfirmation.trim().toUpperCase() !== "DELETE" ||
      !deleteRequest
    )
      return;
    try {
      let next;
      if (deleteRequest.action === "empty") {
        next = await emptyPhotoBin(project);
      } else if (deleteRequest.action === "multiple") {
        next = await permanentlyDeletePhotos(project, deleteRequest.photos);
      } else {
        next = await permanentlyDeletePhoto(project, deleteRequest.photo);
      }
      setProject(next);
      closePreview();
      setDeleteRequest(null);
      setDeleteConfirmation("");
      setSelectionMode(false);
      setSelectedPhotoIds([]);
    } catch (error) {
      Alert.alert("Photo not deleted", error.message || "Please try again.");
    }
  };

  const exitSelectionMode = () => {
    selectionModeRef.current = false;
    selectedPhotoIdsRef.current = [];
    setSelectionMode(false);
    setSelectedPhotoIds([]);
  };

  const openWorkspaceTab = (nextTab) => {
    Keyboard.dismiss();
    setTab(nextTab);
    if (nextTab !== "gallery") {
      exitSelectionMode();
      setLibraryMode("library");
      setGalleryType("All");
    }
  };

  const openCamera = () => {
    Keyboard.dismiss();
    setTab("capture");
  };

  const togglePhotoSelection = (photo) => {
    setSelectedPhotoIds((current) => {
      const next = current.includes(photo.id)
        ? current.filter((id) => id !== photo.id)
        : [...current, photo.id];
      selectedPhotoIdsRef.current = next;
      return next;
    });
  };

  const moveSelectedToBin = () => {
    if (!selectedGalleryPhotos.length) return;
    Alert.alert(
      "Move to Bin?",
      `Move ${selectedGalleryPhotos.length} selected photo${selectedGalleryPhotos.length === 1 ? "" : "s"} to the Bin?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Bin",
          style: "destructive",
          onPress: async () => {
            try {
              const next = await movePhotosToBin(project, selectedGalleryPhotos);
              setProject(next);
              exitSelectionMode();
            } catch (error) {
              Alert.alert("Photos not moved", error.message || "Please try again.");
            }
          },
        },
      ],
    );
  };

  const requestDeleteSelectedFromBin = () => {
    if (!selectedGalleryPhotos.length) return;
    setDeleteConfirmation("");
    setDeleteRequest({
      permanent: true,
      action: "multiple",
      photos: selectedGalleryPhotos,
    });
  };

  const restoreSelectedFromBin = async () => {
    if (!selectedGalleryPhotos.length) return;
    try {
      let next = project;
      for (const photo of selectedGalleryPhotos) {
        next = await restorePhotoFromBin(next, photo);
      }
      setProject(next);
      exitSelectionMode();
    } catch (error) {
      Alert.alert(
        "Photos not restored",
        error.message || "Please try again.",
      );
    }
  };

  const requestEmptyBin = () => {
    if (!binnedPhotos.length) return;
    setDeleteConfirmation("");
    setDeleteRequest({ permanent: true, action: "empty", photos: binnedPhotos });
  };

  const exportSelectedPhotos = async () => {
    if (!selectedGalleryPhotos.length) return;
    try {
      setSavingText("Compiling selected photos…");
      setSaving(true);
      const result = await exportSelectedPhotosZip(project, selectedGalleryPhotos);
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is not available on this device.");
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/zip",
        dialogTitle: `${project.projectNumber} selected photos`,
        UTI: "public.zip-archive",
      });
    } catch (error) {
      Alert.alert("Selected photos not exported", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const restoreBinnedPhoto = async (photo) => {
    try {
      const next = await restorePhotoFromBin(project, photo);
      setProject(next);
      closePreview();
    } catch (error) {
      Alert.alert("Photo not restored", error.message || "Please try again.");
    }
  };

  useEffect(() => {
    const openActiveProject = async () => {
      const all = await listProjects();
      setProjects(all);
      if (!activeJob?.number) return;
      const existing = all.find(
        (item) => item.projectNumber === activeJob.number,
      );
      const next =
        existing ||
        (await createProject(
          activeJob.number,
          "1000",
          accountProfile?.fullName || "",
        ));
      selectProject(next);
    };
    openActiveProject().catch((error) =>
      Alert.alert("Photo workspace unavailable", error.message),
    );
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
      if (saveConfirmationTimerRef.current) {
        clearTimeout(saveConfirmationTimerRef.current);
      }
    };
  }, [activeJob?.number]);

  useEffect(() => {
    setProjectNumber(activeJob?.number || "");
    setSurveyor((current) => current.trim() || accountProfile?.fullName || "");
  }, [accountProfile, activeJob]);

  useEffect(() => {
    if (!initialFeature) return;
    setComment(
      initialFeature.exampleComments?.[0] ||
        initialFeature.standardComment ||
        "",
    );
    const model = String(initialFeature.model || "").toLowerCase();
    const type = model.includes("drain")
      ? "Drainage"
      : model.includes("road") || model.includes("sign")
        ? "Signs"
        : model.includes("water")
          ? "Water"
          : model.includes("electric") || model.includes("power")
            ? "Power Poles"
            : "General Features";
    setImageType(type);
  }, [initialFeature?.code]);

  useEffect(() => {
    let subscription;
    let mounted = true;

    const startLocation = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      setLocationPermission(permission);

      if (!permission.granted) {
        if (!permissionAlertShown.current) {
          permissionAlertShown.current = true;
          Alert.alert(
            "Location required",
            "Survey Photo Capture requires location access to record approximate GPS details with project photos. Enable While Using the App and Precise Location in iPhone Settings.",
            [
              { text: "Not Now", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ],
          );
        }
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (result) =>
          setLocation({ ...result.coords, timestamp: result.timestamp }),
      );
    };

    startLocation().catch(() => setLocationPermission({ granted: false }));
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  const selectProject = (next) => {
    setProject(next);
    setPhotoId(String(next.nextPhotoId));
    setLibraryMode("library");
    setGalleryType("All");
    setTab(requestedTab);
  };

  const addProject = async () => {
    Keyboard.dismiss();
    try {
      const next = await createProject(projectNumber, startPhotoId, surveyor);
      setProjects(await listProjects());
      selectProject(next);
    } catch (error) {
      Alert.alert("Project not created", error.message);
    }
  };

  const openLocationSettings = () => {
    Alert.alert(
      "Location required",
      "Select While Using the App and turn Precise Location ON. Then return to NorthGroup One.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ],
    );
  };

  const chooseSurveyor = async (name) => {
    setSurveyor(name);
    setSurveyorPicker(false);
    if (!project) return;
    try {
      const updated = await saveProject({
        ...project,
        surveyor: name,
        surveyorInitials: getSurveyorInitials(name),
      });
      setProject(updated);
      setProjects((items) =>
        items.map((item) =>
          item.projectNumber === updated.projectNumber ? updated : item,
        ),
      );
    } catch (error) {
      Alert.alert("Surveyor not updated", error.message);
    }
  };

  const capture = async () => {
    Keyboard.dismiss();

    if (!project.surveyor || !project.surveyorInitials) {
      Alert.alert(
        "Surveyor required",
        "Select the surveyor in Project Details before taking photos.",
      );
      setSurveyorPicker(true);
      return;
    }
    if (!locationPermission?.granted) {
      openLocationSettings();
      return;
    }
    if (!photoId.trim()) {
      Alert.alert("Photo ID required", "Enter the mandatory Photo ID.");
      return;
    }
    if (!cameraReady || !cameraRef.current) {
      Alert.alert(
        "Camera is starting",
        "Wait a moment for the camera to become ready, then try again.",
      );
      return;
    }

    const preciseOff = locationPermission?.ios?.accuracy === "reduced";
    const poor = location?.accuracy > 8;
    const gpsWarningMessage =
      preciseOff || !location || poor
        ? preciseOff
          ? "Precise Location was off when this photo was taken."
          : !location
            ? "No GPS position was available for this photo."
            : `GPS accuracy was ±${location.accuracy.toFixed(1)} m, outside the 8 m tolerance.`
        : "";

    if (captureInFlightRef.current) return;

    const captureContext = {
      photoId: photoId.trim(),
      pointId: pointId.trim(),
      comment,
      location: location ? { ...location } : null,
      capturedAt: new Date().toISOString(),
    };

    try {
      captureInFlightRef.current = true;

      // Commit the native frame on touch-down before any React state, warning
      // or project file work. Awaiting the returned file does not delay which
      // frame is captured; it only waits for Expo Camera to provide its URI.
      const shot = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: false,
        skipProcessing: false,
      });

      const capturedUri = String(shot?.uri || "").trim();
      if (!capturedUri) {
        throw new Error(
          "The camera did not return a photo file. Please retake the photo.",
        );
      }
      const lastType = [...(project.photos || [])]
        .filter((photo) => !photo.deletedAt && photo.imageType)
        .sort((a, b) =>
          String(b.captureDateTime || b.id).localeCompare(
            String(a.captureDateTime || a.id),
          ),
        )[0]?.imageType;
      setImageType(
        (current) =>
          current || (repeatLastType && lastType ? lastType : ""),
      );
      setCustomType("");
      const capturedShot = { uri: capturedUri, ...captureContext };
      if (gpsWarningMessage) {
        Alert.alert(
          "GPS outside tolerance",
          gpsWarningMessage,
          [
            {
              text: "Continue to Review",
              onPress: () => setPendingShot(capturedShot),
            },
          ],
        );
      } else {
        setPendingShot(capturedShot);
      }
    } catch (error) {
      Alert.alert("Photo not captured", error.message || "Please try again.");
    } finally {
      captureInFlightRef.current = false;
      setSaving(false);
    }
  };

  captureHandlerRef.current = capture;

  useEffect(() => {
    if (
      tab !== "capture" ||
      Platform.OS !== "ios" ||
      !NativeModules.VolumeManager
    ) {
      return undefined;
    }

    // Available in development/TestFlight builds. Expo Go does not include
    // this native module, so the on-screen shutter remains its safe fallback.
    const { VolumeManager } = require("react-native-volume-manager");
    let volumeSubscription;

    VolumeManager.showNativeVolumeUI({ enabled: false }).catch(() => {});
    volumeSubscription = VolumeManager.addVolumeListener(() => {
      const now = Date.now();
      if (now - lastVolumeShutterAtRef.current < 350) return;
      lastVolumeShutterAtRef.current = now;
      captureHandlerRef.current?.();
    });

    return () => {
      volumeSubscription?.remove();
      VolumeManager.showNativeVolumeUI({ enabled: true }).catch(() => {});
    };
  }, [tab]);

  const savePendingShot = async () => {
    const selectedType = imageType === "Custom" ? customType.trim() : imageType;
    if (!pendingShot) return;
    if (!selectedType) {
      Alert.alert(
        "Image type required",
        "Select the image type before saving this photo.",
      );
      return;
    }

    try {
      setSavingText("Saving official project photo…");
      setSaving(true);
      const result = await saveCapturedPhoto({
        project,
        sourceUri: pendingShot.uri,
        photoId: pendingShot.photoId,
        pointId: pendingShot.pointId,
        imageType: selectedType,
        comment: pendingShot.comment,
        location: pendingShot.location,
        capturedAt: pendingShot.capturedAt,
      });

      if (saveToPhotos) {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (permission.granted)
          await MediaLibrary.createAssetAsync(result.record.uri);
      }

      setProject(result.project);
      setProjects((items) =>
        items.map((item) =>
          item.projectNumber === result.project.projectNumber
            ? result.project
            : item,
        ),
      );
      setPhotoId(String(result.project.nextPhotoId));
      setPointId("");
      setLastSaved(`${result.record.folder}/${result.record.fileName}`);
      setSaveConfirmation(`Photo ${result.record.photoId} saved`);
      if (saveConfirmationTimerRef.current) {
        clearTimeout(saveConfirmationTimerRef.current);
      }
      saveConfirmationTimerRef.current = setTimeout(
        () => setSaveConfirmation(""),
        2200,
      );
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setPendingShot(null);
      setImageType(repeatLastType ? selectedType : "");
      setCustomType("");
      setTab("capture");
    } catch (error) {
      Alert.alert(
        "Photo not saved",
        error.message ||
          "Please try again. The Photo ID was not incremented and the captured preview is still available.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!project) {
    return (
      <View style={styles.page}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={{ height: insets.top, backgroundColor: NAVY }} />
        <AppHeader
          eyebrow="FIELD DATABASE"
          title="Survey Photo Capture"
          subtitle="Create or select a project"
          onBack={goBack}
          backLabel={backLabel}
          showTopo
          compact
        />
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.projectDetailsCard}>
            <View style={styles.projectDetailsHeader}>
              <View>
                <Text style={styles.projectDetailsTitle}>Project Details</Text>
                <Text style={styles.projectDetailsSubtitle}>
                  Remembered for every photo in this project
                </Text>
              </View>
            </View>
            <Label text="Project Number" />
            <Input
              value={projectNumber}
              onChangeText={setProjectNumber}
              placeholder="MR105610"
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <View style={styles.formPair}>
              <View style={styles.formPairItem}>
                <Label text="Start Photo ID" />
                <Input
                  value={startPhotoId}
                  onChangeText={setStartPhotoId}
                  placeholder="1000"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.formPairItem}>
                <Label text="Surveyor" />
                <Pressable
                  style={styles.inputPicker}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSurveyorPicker(true);
                  }}
                >
                  <Text numberOfLines={1} style={styles.inputPickerText}>
                    {surveyor || "Select"}
                  </Text>
                  <Text style={styles.inputPickerArrow}>⌄</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.filenamePreview}>
              Filename preview: {getSurveyorInitials(surveyor) || "XX"}_
              {startPhotoId || "1000"}_Drainage.jpg
            </Text>
            {keyboardVisible ? <DoneButton /> : null}
            <GoldButton label="Create Project" onPress={addProject} />
          </View>
          <Text style={styles.sectionTitle}>EXISTING PROJECTS</Text>
          {projects.length ? (
            projects.map((item) => (
              <Pressable
                key={item.projectNumber}
                style={styles.projectRow}
                onPress={() => selectProject(item)}
              >
                <View>
                  <Text style={styles.projectName}>{item.projectNumber}</Text>
                  <Text style={styles.muted}>
                    {item.photos.length} photos · Next ID {item.nextPhotoId}
                  </Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.empty}>
              No photo projects on this phone yet.
            </Text>
          )}
        </ScrollView>
        <Modal
          visible={surveyorPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setSurveyorPicker(false)}
        >
          <Pressable
            style={styles.modalShade}
            onPress={() => setSurveyorPicker(false)}
          >
            <View style={styles.picker}>
              <Text style={styles.pickerTitle}>Select Surveyor</Text>
              <ScrollView>
                {STAFF_NAMES.map((name) => (
                  <Pressable
                    key={name}
                    style={styles.typeRow}
                    onPress={() => chooseSurveyor(name)}
                  >
                    <View>
                      <Text style={styles.typeText}>{name}</Text>
                      <Text style={styles.initialsText}>
                        {getSurveyorInitials(name)}
                      </Text>
                    </View>
                    {surveyor === name ? (
                      <Text style={styles.selectedTick}>✓</Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  const accuracy = location?.accuracy;
  const activePhotos = project.photos.filter((photo) => !photo.deletedAt);
  const binnedPhotos = project.photos.filter((photo) =>
    Boolean(photo.deletedAt),
  );
  const capturedTypes = [
    ...new Set(activePhotos.map((photo) => photo.imageType).filter(Boolean)),
  ];
  const availableGalleryTypes = [
    "All",
    ...SURVEY_IMAGE_TYPES.filter((type) => capturedTypes.includes(type)),
    ...capturedTypes
      .filter((type) => !SURVEY_IMAGE_TYPES.includes(type))
      .sort(),
  ];
  const visibleGalleryPhotos =
    libraryMode === "bin"
      ? binnedPhotos
      : activePhotos.filter(
          (photo) => galleryType === "All" || photo.imageType === galleryType,
        );
  const galleryPhotos = [...visibleGalleryPhotos].sort((a, b) => {
    const aDate =
      libraryMode === "bin"
        ? a.deletedAt || a.captureDateTime
        : a.captureDateTime;
    const bDate =
      libraryMode === "bin"
        ? b.deletedAt || b.captureDateTime
        : b.captureDateTime;
    return String(bDate || b.id).localeCompare(String(aDate || a.id));
  });
  const galleryViewerPhotos = galleryPhotos;
  const selectedGalleryPhotos = galleryPhotos.filter((photo) =>
    selectedPhotoIds.includes(photo.id),
  );
  const recentImageTypes = [
    ...new Set(
      [...activePhotos]
        .sort((a, b) =>
          String(b.captureDateTime || b.id).localeCompare(
            String(a.captureDateTime || a.id),
          ),
        )
        .map((photo) => photo.imageType)
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const galleryTileSize = Math.max(1, Math.floor((viewerWidth - 30) / 3));
  galleryDragConfigRef.current = {
    photos: galleryPhotos,
    tileSize: galleryTileSize,
    columns: 3,
    gap: 3,
  };
  const photoDateKeys = [...new Set(activePhotos.map(getPhotoDateKey))]
    .sort()
    .reverse();
  const photosByDate = Object.fromEntries(
    photoDateKeys.map((dateKey) => [
      dateKey,
      [...activePhotos]
        .filter((photo) => getPhotoDateKey(photo) === dateKey)
        .sort((a, b) =>
          String(b.captureDateTime).localeCompare(String(a.captureDateTime)),
        ),
    ]),
  );
  const formatDateFolder = (dateKey) => {
    if (dateKey === "Unknown Date") return dateKey;
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const exportProject = async () => {
    if (!exportWholeProject && !selectedExportDates.length) {
      Alert.alert(
        "Select a capture day",
        "Choose at least one date to export.",
      );
      return;
    }

    try {
      setSavingText("Compiling photos…");
      setSaving(true);
      const result = await exportProjectZip(
        project,
        exportWholeProject ? null : selectedExportDates,
      );
      const shareExport = async () => {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("Sharing is not available on this device.");
        }
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/zip",
          dialogTitle: `Export ${project.projectNumber}`,
        });
      };

      if (result.sizeBytes > ZIP_EMAIL_WARNING_BYTES) {
        Alert.alert(
          "Large ZIP file",
          `This ZIP is ${formatFileSize(result.sizeBytes)}. Email limits vary and the message itself counts, so it may not send as an attachment. A OneDrive or other file link may be safer.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Share Anyway",
              onPress: () =>
                shareExport().catch((error) =>
                  Alert.alert(
                    "Export not shared",
                    error.message || "Please try again.",
                  ),
                ),
            },
          ],
        );
      } else {
        await shareExport();
      }
    } catch (error) {
      Alert.alert("Export failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.page}>
      <StatusBar
        barStyle="light-content"
        translucent={tab === "capture"}
        backgroundColor={tab === "capture" ? "transparent" : NAVY}
      />
      {tab !== "capture" ? (
        <SurveyPhotoHeader
          insets={insets}
          activeJob={activeJob}
          photoCount={activePhotos.length}
          accuracy={accuracy}
          locationPermission={locationPermission}
          onBack={goBack}
          backLabel={backLabel}
        />
      ) : null}

      {tab === "home" ? (
        <PhotoHomeView
          project={project}
          activePhotos={activePhotos}
          accuracy={accuracy}
          locationPermission={locationPermission}
          lastSaved={lastSaved}
          onOpenGallery={() => openWorkspaceTab("gallery")}
          openPreview={openPreview}
        />
      ) : null}

      {tab === "capture" ? (
        <PhotoCameraView
          accuracy={accuracy}
          cameraDismissResponder={cameraDismissResponder}
          cameraDismissY={cameraDismissY}
          cameraPermission={cameraPermission}
          cameraPinchResponder={cameraPinchResponder}
          cameraReady={cameraReady}
          cameraRef={cameraRef}
          cameraZoom={cameraZoom}
          flash={flash}
          keyboardVisible={keyboardVisible}
          locationPermission={locationPermission}
          onCapture={capture}
          onClose={exitCameraToWorkspace}
          onOpenLocationSettings={openLocationSettings}
          photoId={photoId}
          pointId={pointId}
          requestCameraPermission={requestCameraPermission}
          safeAreaTop={insets.top}
          saveConfirmation={saveConfirmation}
          saving={saving}
          setCameraReady={setCameraReady}
          setCameraZoom={(nextZoom) => {
            cameraZoomRef.current = nextZoom;
            setCameraZoom(nextZoom);
          }}
          setFlash={setFlash}
          setPhotoId={setPhotoId}
          setPointId={setPointId}
        />
      ) : null}

      {tab === "gallery" ? (
        <PhotoGalleryView
          activePhotos={activePhotos}
          availableGalleryTypes={availableGalleryTypes}
          binnedPhotos={binnedPhotos}
          bottomActionOffset={
            PHOTO_BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, 7)
          }
          exitSelectionMode={exitSelectionMode}
          exportSelectedPhotos={exportSelectedPhotos}
          galleryGridLayoutRef={galleryGridLayoutRef}
          galleryPhotos={galleryPhotos}
          galleryScrollRef={galleryScrollRef}
          galleryScrollYRef={galleryScrollYRef}
          gallerySelectionResponder={gallerySelectionResponder}
          galleryTileSize={galleryTileSize}
          galleryType={galleryType}
          galleryViewerPhotos={galleryViewerPhotos}
          galleryViewportRef={galleryViewportRef}
          libraryMode={libraryMode}
          moveSelectedToBin={moveSelectedToBin}
          openPreview={openPreview}
          requestDeleteSelectedFromBin={requestDeleteSelectedFromBin}
          requestEmptyBin={requestEmptyBin}
          restoreSelectedFromBin={restoreSelectedFromBin}
          selectedGalleryPhotos={selectedGalleryPhotos}
          selectedPhotoIds={selectedPhotoIds}
          selectionMode={selectionMode}
          setGalleryType={setGalleryType}
          setLibraryMode={setLibraryMode}
          setSelectionMode={setSelectionMode}
          togglePhotoSelection={togglePhotoSelection}
        />
      ) : null}

      {tab === "qa" ? (
        <PhotoExportView
          activePhotos={activePhotos}
          exportWholeProject={exportWholeProject}
          formatDateFolder={formatDateFolder}
          onExport={exportProject}
          photoDateKeys={photoDateKeys}
          photosByDate={photosByDate}
          selectedExportDates={selectedExportDates}
          setExportWholeProject={setExportWholeProject}
          setSelectedExportDates={setSelectedExportDates}
        />
      ) : null}

      {tab === "more" ? (
        <PhotoMoreView
          accuracy={accuracy}
          activePhotos={activePhotos}
          binnedPhotos={binnedPhotos}
          locationPermission={locationPermission}
          onOpenBin={() => {
            exitSelectionMode();
            setLibraryMode("bin");
            setGalleryType("All");
            setTab("gallery");
          }}
          onOpenLocationSettings={openLocationSettings}
          onOpenSurveyorPicker={() => setSurveyorPicker(true)}
          project={project}
          repeatLastType={repeatLastType}
          saveToPhotos={saveToPhotos}
          setRepeatLastType={setRepeatLastType}
          setSaveToPhotos={setSaveToPhotos}
        />
      ) : null}

      {tab !== "capture" ? (
        <SurveyPhotoBottomBar
          activeTab={tab}
          bottomInset={insets.bottom}
          onChangeTab={openWorkspaceTab}
          onCapture={openCamera}
        />
      ) : null}

      <SurveyorPickerModal
        getSurveyorInitials={getSurveyorInitials}
        onChooseSurveyor={chooseSurveyor}
        projectSurveyor={project?.surveyor}
        setSurveyorPicker={setSurveyorPicker}
        surveyor={surveyor}
        surveyorPicker={surveyorPicker}
      />

      <PhotoReviewModal
        customType={customType}
        imageType={imageType}
        insets={insets}
        onDiscard={() => {
          setPendingShot(null);
          setImageType(repeatLastType ? recentImageTypes[0] || "" : "");
          setCustomType("");
        }}
        onSave={savePendingShot}
        pendingShot={pendingShot}
        recentImageTypes={recentImageTypes}
        repeatLastType={repeatLastType}
        saving={saving}
        savingText={savingText}
        setCustomType={setCustomType}
        setImageType={setImageType}
        setRepeatLastType={setRepeatLastType}
      />

      <PhotoViewerModal
        insets={insets}
        onClose={closePreview}
        onCloseToGallery={closePreviewToGallery}
        onPhotoChange={setPreviewPhoto}
        onRequestDelete={requestProtectedDelete}
        onRestore={restoreBinnedPhoto}
        onSaveCopy={savePhotoCopy}
        onShare={sharePhoto}
        previewPhoto={previewPhoto}
        previewPhotos={previewPhotos}
      />

      <PhotoDeleteConfirmModal
        binnedPhotoCount={binnedPhotos.length}
        confirmation={deleteConfirmation}
        deleteRequest={deleteRequest}
        onCancel={() => {
          setDeleteRequest(null);
          setDeleteConfirmation("");
        }}
        onConfirm={confirmProtectedDelete}
        setConfirmation={setDeleteConfirmation}
      />

      {saving ? (
        <View style={styles.saving}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.savingText}>{savingText}</Text>
        </View>
      ) : null}
    </View>
  );
}
