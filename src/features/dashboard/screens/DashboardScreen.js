import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DEFAULT_WELCOME_DATA,
  formatWelcomeDate,
  getGreeting,
} from "../../welcome/utils/welcomeContent";
import { useTheme } from "../../../theme/ThemeContext";
import ProfileAvatar from "../../../components/ProfileAvatar";

const useDashboardStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
};

function Section({ title, actionLabel, children }) {
  const styles = useDashboardStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionLabel ? (
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function QuickAction({ icon, label, accent = false, onPress, wide = false }) {
  const styles = useDashboardStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        wide && styles.actionCardWide,
        accent && styles.actionCardAccent,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIcon, accent && styles.actionIconAccent]}>
        <Text style={styles.actionIconText}>{icon}</Text>
      </View>
      <Text style={[styles.actionLabel, accent && styles.actionLabelAccent]}>
        {label}
      </Text>
      <Text style={[styles.actionArrow, accent && styles.actionLabelAccent]}>
        ›
      </Text>
    </Pressable>
  );
}

const CONTINUE_WORK_ICONS = {
  se14: "\u2316",
  s500: "\u2713",
  s501: "\u2713",
  s506: "\u2197",
};

function ContinueWorkCard({ work, onPress }) {
  const styles = useDashboardStyles();
  const tone = ["progress", "complete"].includes(work?.tone)
    ? work.tone
    : "recommended";
  const icon = CONTINUE_WORK_ICONS[work?.type] || "\u2713";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.continueCard,
        styles[`continueCard_${tone}`],
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${work.title}. ${work.actionLabel}`}
    >
      <View style={[styles.continueIcon, styles[`continueIcon_${tone}`]]}>
        <Text style={styles.continueIconText}>{icon}</Text>
      </View>
      <View style={styles.continueCopy}>
        <Text style={styles.continueEyebrow}>{work.eyebrow}</Text>
        <Text style={styles.continueTitle}>{work.title}</Text>
        <Text style={styles.continueDetail}>{work.detail}</Text>
      </View>
      <View style={styles.continueActionWrap}>
        <Text style={[styles.continueAction, styles[`continueAction_${tone}`]]}>
          {work.actionLabel}
        </Text>
        <Text style={[styles.continueArrow, styles[`continueAction_${tone}`]]}>
          ›
        </Text>
      </View>
    </Pressable>
  );
}

function InfoCard({ icon, eyebrow, title, detail, badge, onPress }) {
  const styles = useDashboardStyles();
  const content = (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Text style={styles.infoIconText}>{icon}</Text>
      </View>
      <View style={styles.infoCopy}>
        {eyebrow ? <Text style={styles.infoEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.infoTitle}>{title}</Text>
        {detail ? <Text style={styles.infoDetail}>{detail}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  ) : (
    content
  );
}

export default function DashboardScreen({
  user = DEFAULT_WELCOME_DATA,
  openAccount,
  openTodaysJob,
  openJobs,
  continueWork,
  openContinueWork,
  openPreStart,
  openGNSS,
  openPhotoCapture,
  openMoreTools,
  openWeather,
  onRefreshWeather,
  weatherRefreshing = false,
  openFeed,
  openChats,
  profilePhotoUri,
  profilePhotoRevision,
  recentlyOpened = [],
  openRecentlyOpened,
}) {
  const { colors } = useTheme();
  const styles = useDashboardStyles();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollToTopAnimation = useRef(new Animated.Value(0)).current;
  const dashboardScrollRef = useRef(null);
  const scrollOffset = useRef(0);
  const scrollToTopListener = useRef(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const currentJob = user.currentJob || DEFAULT_WELCOME_DATA.currentJob;
  const hasActiveJob = Boolean(
    currentJob?.number && currentJob.number !== "No job selected",
  );
  const activeJobTitle = hasActiveJob
    ? `${currentJob.number}${currentJob.name ? ` · ${currentJob.name}` : ""}`
    : "No job selected";
  const activeJobLocation = hasActiveJob
    ? currentJob.location || "Location not added"
    : "Choose a job to begin";
  const activeJobChatDetail = hasActiveJob
    ? `${currentJob.number} · ${currentJob.location || currentJob.name || "Active job"}`
    : "Choose an active Teams Shifts job";
  const weather = user.weather || {};
  const safetyReminder = weather.fieldOutlook || {
    level: "warning",
    title: "Check conditions before departure",
    detail:
      "Review the forecast, site access and required PPE before leaving for site.",
  };
  const safetyLevel = ["good", "warning", "danger"].includes(
    safetyReminder.level,
  )
    ? safetyReminder.level
    : "warning";
  const updated = weather.updatedAt ? new Date(weather.updatedAt) : null;
  const updatedLabel =
    updated && !Number.isNaN(updated.getTime())
      ? `Updated ${updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "Updating forecast";
  const windDirection =
    weather.windDirectionLabel ||
    (Number.isFinite(weather.windDirection)
      ? `${weather.windDirection}°`
      : "Direction unavailable");
  const stickyOpacity = scrollY.interpolate({
    inputRange: [95, 160],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const stickyTranslateY = scrollY.interpolate({
    inputRange: [95, 160],
    outputRange: [-18, 0],
    extrapolate: "clamp",
  });
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (event) => {
          const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
          scrollOffset.current = nextOffset;
          const nextVisible = nextOffset > 120;
          setStickyVisible((current) =>
            current === nextVisible ? current : nextVisible,
          );
        },
      }),
    [scrollY],
  );

  const cancelScrollToTop = () => {
    if (scrollToTopListener.current) {
      scrollToTopAnimation.removeListener(scrollToTopListener.current);
      scrollToTopListener.current = null;
    }
    scrollToTopAnimation.stopAnimation();
  };

  const scrollDashboardToTop = () => {
    const startY = scrollOffset.current;
    if (startY <= 0) return;

    cancelScrollToTop();
    scrollToTopAnimation.setValue(startY);
    scrollToTopListener.current = scrollToTopAnimation.addListener(
      ({ value }) => {
        dashboardScrollRef.current?.scrollTo({
          y: Math.max(0, value),
          animated: false,
        });
      },
    );

    Animated.timing(scrollToTopAnimation, {
      toValue: 0,
      duration: Math.min(420, Math.max(260, startY * 0.22)),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (scrollToTopListener.current) {
        scrollToTopAnimation.removeListener(scrollToTopListener.current);
        scrollToTopListener.current = null;
      }
      if (!finished) return;

      dashboardScrollRef.current?.scrollTo({ y: 0, animated: false });
      scrollOffset.current = 0;
      scrollY.setValue(0);
      setStickyVisible(false);
    });
  };

  useEffect(
    () => () => {
      if (scrollToTopListener.current) {
        scrollToTopAnimation.removeListener(scrollToTopListener.current);
        scrollToTopListener.current = null;
      }
      scrollToTopAnimation.stopAnimation();
    },
    [scrollToTopAnimation],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />

      <Animated.ScrollView
        ref={dashboardScrollRef}
        onScroll={handleScroll}
        onScrollBeginDrag={cancelScrollToTop}
        scrollEventThrottle={16}
        bounces
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
      >
        <ImageBackground
          source={require("../../../../assets/topo-bg.png")}
          style={[styles.hero, { paddingTop: insets.top + 14 }]}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroShade} />

          <View style={[styles.topRow, { top: insets.top + 14 }]}>
            <View style={styles.brandRow}>
              <Image
                source={require("../../../../assets/logo-transparent.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brand}>NORTHGROUP</Text>
                <Text style={styles.one}>ONE</Text>
              </View>
            </View>

            <Pressable
              style={styles.profile}
              onPress={openAccount}
              accessibilityRole="button"
              accessibilityLabel="Open profile and settings"
            >
              <ProfileAvatar
                uri={profilePhotoUri}
                revision={profilePhotoRevision}
                initials={user.initials || user.firstName.charAt(0)}
                size={36}
                backgroundColor={colors.accent}
                textColor={colors.navy}
              />
            </Pressable>
          </View>

          <Text style={styles.greeting}>
            {getGreeting()}, {user.firstName}
          </Text>
          <Text style={styles.date}>{formatWelcomeDate()}</Text>

          <View style={styles.activeJobCard}>
            <Pressable
              onPress={openTodaysJob}
              style={({ pressed }) => [
                styles.activeJobMain,
                pressed && styles.activeJobMainPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`View active job ${currentJob.number}`}
              accessibilityHint="Opens the active job workspace"
            >
              <View style={styles.switchIcon}>
                <Text style={styles.switchIconText}>⌖</Text>
              </View>
              <View style={styles.switchCopy}>
                <Text style={styles.switchEyebrow}>
                  ACTIVE JOB · TAP TO VIEW
                </Text>
                <View style={styles.switchNumberRow}>
                  <Text
                    style={styles.switchJobText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.76}
                  >
                    {activeJobTitle}
                  </Text>
                  {hasActiveJob ? <Text style={styles.switchJobArrow}>›</Text> : null}
                </View>
                <Text style={styles.switchCurrent} numberOfLines={1}>
                  {activeJobLocation}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={openJobs}
              style={({ pressed }) => [
                styles.activeJobSwitch,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Switch active job"
            >
              <Text style={styles.activeJobSwitchText}>SWITCH</Text>
            </Pressable>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <Section title="Continue Working">
            <ContinueWorkCard work={continueWork} onPress={openContinueWork} />
          </Section>

          <Section title="Quick Actions">
            <View style={styles.actionGrid}>
              <QuickAction
                icon="✓"
                label="Start Pre-Start"
                accent={continueWork?.type !== "se14"}
                onPress={openPreStart}
              />
              <QuickAction
                icon="⌖"
                label="Start GNSS Session"
                accent={continueWork?.type === "se14"}
                onPress={openGNSS}
              />
              <QuickAction
                icon={"\u25c9"}
                label="Photo Capture"
                onPress={openPhotoCapture}
              />
              <QuickAction
                icon="+"
                label="More Tools"
                onPress={openMoreTools}
              />
            </View>
          </Section>

          <View style={styles.weatherCard}>
            <View style={styles.weatherHeader}>
              <Pressable
                onPress={openWeather}
                style={({ pressed }) => [
                  styles.weatherHeadingPressable,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open weather forecast for ${weather.locationLabel || "your location"}`}
              >
                <Text style={styles.weatherEyebrow}>TODAY&apos;S WEATHER</Text>
                <Text style={styles.weatherLocation}>
                  {weather.locationLabel || "Local forecast"}
                </Text>
              </Pressable>
              <Pressable
                onPress={onRefreshWeather}
                disabled={weatherRefreshing || !onRefreshWeather}
                style={({ pressed }) => [
                  styles.weatherRefresh,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Refresh weather"
              >
                {weatherRefreshing ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Text style={styles.weatherRefreshText}>↻</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={openWeather}
              style={({ pressed }) => [
                styles.weatherBody,
                pressed && styles.weatherCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`View full forecast for ${weather.locationLabel || "your location"}`}
            >
              <View style={styles.weatherMain}>
                <View style={styles.weatherCopy}>
                  <Text style={styles.temperature}>
                    {weather.temperature || "N/A"}
                  </Text>
                  <Text style={styles.condition}>
                    {weather.condition || "Weather unavailable"}
                  </Text>
                  <Text style={styles.weatherFeels}>
                    Feels like {weather.feelsLike || "—"}
                  </Text>
                </View>
                <View style={styles.weatherRight}>
                  <Text style={styles.weatherIcon}>{weather.icon || "☁"}</Text>
                  <Text style={styles.wind}>
                    {weather.wind || "N/A"} {windDirection}
                  </Text>
                </View>
              </View>

              <View style={styles.weatherMetrics}>
                <View style={styles.weatherMetric}>
                  <Text style={styles.weatherMetricValue}>
                    {weather.rainChance || "—"}
                  </Text>
                  <Text style={styles.weatherMetricLabel}>RAIN</Text>
                </View>
                <View style={styles.weatherMetric}>
                  <Text style={styles.weatherMetricValue}>
                    {weather.uvIndex || "—"}
                  </Text>
                  <Text style={styles.weatherMetricLabel}>UV</Text>
                </View>
                <View style={styles.weatherMetric}>
                  <Text style={styles.weatherMetricValue}>
                    {weather.visibility || "—"}
                  </Text>
                  <Text style={styles.weatherMetricLabel}>VISIBILITY</Text>
                </View>
                <View style={styles.weatherMetric}>
                  <Text style={styles.weatherMetricValue}>
                    {weather.gusts || "—"}
                  </Text>
                  <Text style={styles.weatherMetricLabel}>GUSTS</Text>
                </View>
              </View>

              <View style={styles.weatherFooter}>
                <Text style={styles.weatherDaylight}>
                  Sunrise {weather.sunrise || "—"} • Sunset{" "}
                  {weather.sunset || "—"}
                </Text>
                <Text style={styles.weatherOpen}>
                  {updatedLabel} • View forecast ›
                </Text>
              </View>
            </Pressable>
          </View>

          <Section title="Safety Reminder">
            <View
              style={[styles.safetyCard, styles[`safetyCard_${safetyLevel}`]]}
            >
              <View
                style={[styles.safetyIcon, styles[`safetyIcon_${safetyLevel}`]]}
              >
                <Text style={styles.safetyIconText}>
                  {safetyLevel === "good" ? "✓" : "!"}
                </Text>
              </View>
              <View style={styles.safetyCopy}>
                <Text style={styles.safetyTitle}>{safetyReminder.title}</Text>
                <Text style={styles.safetyText}>{safetyReminder.detail}</Text>
              </View>
            </View>
          </Section>

          <Section title="Recently Opened">
            {recentlyOpened.length ? (
              recentlyOpened.map((item) => (
                <InfoCard
                  key={item.id}
                  icon={item.icon}
                  eyebrow={item.eyebrow}
                  title={item.title}
                  detail={item.detail}
                  onPress={() => openRecentlyOpened?.(item)}
                />
              ))
            ) : (
              <InfoCard
                icon="↺"
                eyebrow="SHORTCUTS"
                title="No recent items yet"
                detail="Open a tool, form or settings page and it will appear here."
              />
            )}
          </Section>

          <Section title="NorthGroup One">
            <InfoCard
              icon="●"
              title="Feed"
              detail="NorthGroup and Daily channel updates"
              onPress={openFeed}
            />
            <InfoCard
              icon="◌"
              title="Chats"
              detail={activeJobChatDetail}
              onPress={openChats}
            />
          </Section>
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={stickyVisible ? "box-none" : "none"}
        style={[
          styles.stickyHeader,
          {
            opacity: stickyOpacity,
            transform: [{ translateY: stickyTranslateY }],
          },
        ]}
      >
        <ImageBackground
          source={require("../../../../assets/topo-bg.png")}
          style={[styles.stickyBackground, { paddingTop: insets.top }]}
          imageStyle={styles.stickyBackgroundImage}
        >
          <View style={styles.stickyShade} />
          <View style={styles.stickyRow}>
            <Pressable
              style={({ pressed }) => [
                styles.stickyBrandRow,
                pressed && styles.stickyControlPressed,
              ]}
              onPress={scrollDashboardToTop}
              accessibilityRole="button"
              accessibilityLabel="NorthGroup One, return to top of dashboard"
              accessibilityHint="Scrolls the dashboard back to the top"
              hitSlop={6}
            >
              <Image
                source={require("../../../../assets/logo-transparent.png")}
                style={styles.stickyLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.stickyBrand}>NORTHGROUP</Text>
                <Text style={styles.stickyOne}>ONE</Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.stickyJob,
                pressed && styles.stickyControlPressed,
              ]}
              onPress={openTodaysJob}
              accessibilityRole="button"
              accessibilityLabel={`Open active job ${currentJob.number}`}
              accessibilityHint="Opens the active job workspace"
            >
              <View style={styles.stickyJobCopy}>
                <Text style={styles.stickyJobLabel}>ACTIVE JOB</Text>
                <Text
                  style={styles.stickyJobNumber}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {activeJobTitle}
                </Text>
                <Text style={styles.stickyJobName} numberOfLines={1}>
                  {activeJobLocation}
                </Text>
              </View>
              <Text style={styles.stickyJobArrow}>›</Text>
            </Pressable>
            <View style={styles.stickyProfileSlot}>
              <Pressable
                style={styles.stickyProfile}
                onPress={openAccount}
                accessibilityRole="button"
                accessibilityLabel="Open profile and settings"
              >
                <ProfileAvatar
                  uri={profilePhotoUri}
                  revision={profilePhotoRevision}
                  initials={user.initials || user.firstName.charAt(0)}
                  size={35}
                  backgroundColor={colors.accent}
                  textColor={colors.navy}
                />
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.pageBackground },
    hero: {
      minHeight: 300,
      paddingHorizontal: 20,
      paddingBottom: 28,
      justifyContent: "flex-end",
      backgroundColor: colors.headerBackground,
    },
    heroImage: { opacity: 0.58 },
    heroShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(3,20,35,0.42)",
    },
    topRow: {
      position: "absolute",
      left: 20,
      right: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brandRow: { flexDirection: "row", alignItems: "center" },
    logo: { width: 43, height: 43, marginRight: 8 },
    brand: {
      color: colors.white,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.7,
    },
    one: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 3.2,
    },
    profile: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.55)",
    },
    profileText: { color: colors.navy, fontSize: 16, fontWeight: "900" },
    greeting: {
      color: "#FFFFFF",
      fontSize: 29,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    date: {
      color: "rgba(255,255,255,0.69)",
      fontSize: 13,
      marginTop: 4,
      marginBottom: 20,
    },
    activeJobCard: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.overlay,
    },
    activeJobMain: {
      flex: 1,
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    activeJobMainPressed: { backgroundColor: "rgba(255,255,255,0.08)" },
    switchIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    switchIconText: { color: colors.navy, fontSize: 23, fontWeight: "900" },
    switchCopy: { flex: 1, minWidth: 0, marginLeft: 13 },
    switchEyebrow: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.4,
    },
    switchNumberRow: {
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      marginTop: 1,
    },
    switchJobText: {
      flex: 1,
      minWidth: 0,
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "900",
    },
    switchJobArrow: {
      color: colors.accent,
      fontSize: 24,
      fontWeight: "900",
      lineHeight: 24,
      marginLeft: 7,
    },
    switchCurrent: {
      color: "rgba(255,255,255,0.65)",
      fontSize: 11,
      marginTop: 2,
    },
    activeJobSwitch: {
      minWidth: 84,
      minHeight: 48,
      marginLeft: 8,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    activeJobSwitchText: {
      color: colors.navy,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.6,
    },
    continueCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 18,
      borderLeftWidth: 4,
    },
    continueCard_recommended: {
      borderLeftColor: colors.accent,
      backgroundColor: colors.warningBackground,
    },
    continueCard_progress: {
      borderLeftColor: colors.success,
      backgroundColor: colors.successBackground,
    },
    continueCard_complete: {
      borderLeftColor: colors.success,
      backgroundColor: colors.successBackground,
    },
    continueIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    continueIcon_recommended: { backgroundColor: colors.accent },
    continueIcon_progress: { backgroundColor: colors.success },
    continueIcon_complete: { backgroundColor: colors.success },
    continueIconText: { color: colors.navy, fontSize: 20, fontWeight: "900" },
    continueCopy: { flex: 1, marginLeft: 12, paddingRight: 7 },
    continueEyebrow: {
      color: colors.accentDark,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.3,
    },
    continueTitle: {
      color: colors.bodyText,
      fontSize: 14,
      fontWeight: "900",
      marginTop: 3,
    },
    continueDetail: {
      color: colors.supportingText,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    continueActionWrap: {
      alignItems: "flex-end",
      justifyContent: "center",
      maxWidth: 84,
    },
    continueAction: { fontSize: 10, fontWeight: "900", textAlign: "right" },
    continueAction_recommended: { color: colors.accentDark },
    continueAction_progress: { color: colors.statusSuccessText },
    continueAction_complete: { color: colors.statusSuccessText },
    continueArrow: { fontSize: 22, lineHeight: 22, marginTop: 1 },
    body: { paddingHorizontal: 18 },
    section: { marginTop: 23 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 11,
    },
    sectionTitle: { color: colors.bodyText, fontSize: 17, fontWeight: "800" },
    sectionAction: {
      color: colors.accentDark,
      fontSize: 11,
      fontWeight: "700",
    },
    actionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 10,
    },
    actionCard: {
      width: "48.4%",
      minHeight: 104,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    actionCardWide: { width: "100%", minHeight: 84 },
    actionCardAccent: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
    actionIcon: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.raisedSurface,
    },
    actionIconAccent: { backgroundColor: "rgba(6,26,45,0.12)" },
    actionIconText: { fontSize: 19 },
    actionLabel: {
      color: colors.bodyText,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 12,
      paddingRight: 16,
    },
    actionLabelAccent: { color: colors.navy },
    actionArrow: {
      position: "absolute",
      right: 13,
      bottom: 9,
      color: colors.textMuted,
      fontSize: 21,
    },
    weatherCard: {
      marginTop: 23,
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.navy2,
    },
    weatherCardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
    weatherHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    weatherHeadingPressable: { flex: 1, paddingVertical: 2 },
    weatherRefresh: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    weatherRefreshText: {
      color: colors.accent,
      fontSize: 23,
      fontWeight: "800",
      lineHeight: 25,
    },
    weatherBody: { marginTop: 6, borderRadius: 14 },
    weatherMain: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    weatherCopy: { flex: 1, paddingRight: 10 },
    weatherEyebrow: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.3,
    },
    temperature: {
      color: "#FFFFFF",
      fontSize: 37,
      fontWeight: "800",
      marginTop: 3,
    },
    condition: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
    weatherLocation: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
    weatherFeels: {
      color: "rgba(255,255,255,0.64)",
      fontSize: 10,
      marginTop: 7,
    },
    weatherRight: { alignItems: "flex-end", justifyContent: "center" },
    weatherIcon: { color: "#FFFFFF", fontSize: 35 },
    wind: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 },
    weatherMetrics: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255,255,255,0.16)",
    },
    weatherMetric: { flex: 1, paddingRight: 6 },
    weatherMetricValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    weatherMetricLabel: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.7,
      marginTop: 3,
    },
    weatherFooter: { marginTop: 13 },
    weatherDaylight: {
      color: "rgba(255,255,255,0.62)",
      fontSize: 9,
      lineHeight: 14,
    },
    weatherOpen: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: "800",
      marginTop: 5,
    },
    safetyCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      borderRadius: 18,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
      backgroundColor: colors.warningBackground,
    },
    safetyCard_good: {
      borderLeftColor: colors.success,
      backgroundColor: colors.successBackground,
    },
    safetyCard_warning: {
      borderLeftColor: colors.accent,
      backgroundColor: colors.warningBackground,
    },
    safetyCard_danger: {
      borderLeftColor: colors.danger,
      backgroundColor: colors.dangerBackground,
    },
    safetyIcon: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: colors.accent,
    },
    safetyIcon_good: { backgroundColor: colors.success },
    safetyIcon_warning: { backgroundColor: colors.accent },
    safetyIcon_danger: { backgroundColor: colors.danger },
    safetyIconText: { color: colors.navy, fontSize: 20, fontWeight: "900" },
    safetyCopy: { flex: 1, marginLeft: 12 },
    safetyTitle: { color: colors.bodyText, fontSize: 14, fontWeight: "800" },
    safetyText: {
      color: colors.supportingText,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },
    infoCard: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 78,
      padding: 14,
      borderRadius: 17,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 9,
    },
    infoIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.raisedSurface,
    },
    infoIconText: { fontSize: 20 },
    infoCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
    infoEyebrow: {
      color: colors.accentDark,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginBottom: 3,
    },
    infoTitle: { color: colors.bodyText, fontSize: 14, fontWeight: "800" },
    infoDetail: { color: colors.supportingText, fontSize: 11, marginTop: 3 },
    badge: {
      minWidth: 25,
      height: 25,
      paddingHorizontal: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      backgroundColor: colors.accent,
    },
    badgeText: { color: colors.navy, fontSize: 11, fontWeight: "900" },
    stickyHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      elevation: 20,
      overflow: "hidden",
      backgroundColor: colors.headerBackground,
      shadowColor: colors.shadow,
      shadowOpacity: 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    stickyBackground: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    stickyBackgroundImage: { opacity: 0.58 },
    stickyShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(3,20,35,0.56)",
    },
    stickyRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stickyBrandRow: {
      width: 94,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      paddingRight: 4,
    },
    stickyLogo: { width: 30, height: 30, marginRight: 6 },
    stickyBrand: {
      color: colors.white,
      fontSize: 7,
      fontWeight: "800",
      letterSpacing: 1.1,
    },
    stickyOne: {
      color: colors.accent,
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 2,
    },
    stickyControlPressed: { backgroundColor: "rgba(255,255,255,0.10)" },
    stickyJob: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      borderRadius: 12,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    stickyJobCopy: { width: "100%", minWidth: 0, alignItems: "center" },
    stickyJobLabel: {
      color: colors.accent,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.2,
      textAlign: "center",
    },
    stickyJobNumber: {
      color: colors.white,
      fontSize: 16,
      fontWeight: "900",
      marginTop: 1,
      textAlign: "center",
    },
    stickyJobName: {
      color: "rgba(255,255,255,0.65)",
      fontSize: 9,
      marginTop: 1,
      textAlign: "center",
    },
    stickyJobArrow: {
      position: "absolute",
      right: 4,
      color: colors.accent,
      fontSize: 22,
      fontWeight: "900",
    },
    stickyProfileSlot: {
      width: 94,
      minHeight: 48,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    stickyProfile: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.55)",
    },
    stickyProfileText: { color: colors.navy, fontSize: 14, fontWeight: "900" },
  });
