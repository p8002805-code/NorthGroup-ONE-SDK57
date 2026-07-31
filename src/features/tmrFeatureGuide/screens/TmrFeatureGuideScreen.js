import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  StyleSheet,
  Image,
  ImageBackground,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../../theme/colours";
import { SPACING, RADIUS } from "../../../theme/spacing";
import { TMR_FEATURE_CODES } from "../data/tmrFeatureCodes";
import { getTmrFeatureImages } from "../data/tmrFeatureImages";
import AppBackButton from "../../../components/AppBackButton";

const FAVOURITES_KEY = "tmr_feature_favourites";
const RECENTS_KEY = "tmr_feature_recents";
const USAGE_KEY = "tmr_feature_usage";
const NAVY = "#061A2D";
const GOLD = "#D6A84F";
const WHITE = "#FFFFFF";
const PAGE = "#F2F5F7";
const aliases = {
  PCRM: "concrete road marker road marker reference mark",
  PCSM: "peg survey mark",
  PGPP: "drainage pit gully pit",
  PLBX: "communications pit comms pit",
  PPRF: "property fence",
};
const normalise = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = next;
    }
  }
  return row[b.length];
};
const searchable = (feature) =>
  normalise(
    [
      feature.code,
      feature.description,
      feature.model,
      feature.pickupMethod,
      feature.standardComment,
      ...(feature.exampleComments || []),
      feature.fieldNotes,
      aliases[feature.code] || "",
    ].join(" "),
  );
const modelLabel = (model = "") =>
  model
    .replace(/^SURVEY\s+/i, "")
    .replace(/^DBYD\s+/i, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Other";
const imageFor = (feature) => getTmrFeatureImages(feature.code)[0];

function TmrGuideHeader({ insets, onBack }) {
  return (
    <ImageBackground
      source={require("../../../../assets/topo-bg.png")}
      style={styles.tmrHeaderBanner}
      imageStyle={styles.tmrHeaderBannerImage}
    >
      <View pointerEvents="none" style={styles.tmrHeaderShade} />
      <View style={[styles.tmrHeaderTop, { paddingTop: insets.top + 8 }]}>
        <AppBackButton
          label="Field Tools"
          style={styles.tmrBackButton}
          onPress={onBack}
        />
        <View style={styles.tmrHeaderBadge}>
          <Text style={styles.tmrHeaderBadgeIcon}>▦</Text>
          <Text style={styles.tmrHeaderBadgeLabel}>CODE</Text>
        </View>
      </View>
      <View style={styles.tmrHeaderTitleRow}>
        <View style={styles.tmrHeaderTitleCopy}>
          <Text style={styles.tmrHeaderEyebrow}>TMR FEATURE GUIDE</Text>
          <Text style={styles.tmrHeaderTitle}>TMR Feature Guide</Text>
          <Text style={styles.tmrHeaderSubtitle}>
            Identify, confirm and record the right feature.
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

export default function TmrFeatureGuideScreen({
  setScreen,
  openFeatureDetails,
  openCamera,
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState([]);
  const [recents, setRecents] = useState([]);
  const [browseLayer, setBrowseLayer] = useState(null);
  const [browseSectionY, setBrowseSectionY] = useState(0);
  const [usage, setUsage] = useState({});
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(FAVOURITES_KEY),
      AsyncStorage.getItem(RECENTS_KEY),
      AsyncStorage.getItem(USAGE_KEY),
    ]).then(([f, r, u]) => {
      if (f) setFavourites(JSON.parse(f));
      if (r) setRecents(JSON.parse(r));
      if (u) setUsage(JSON.parse(u));
    });
  }, []);
  const layers = useMemo(
    () =>
      [...new Set(TMR_FEATURE_CODES.map((f) => modelLabel(f.model)))].sort(),
    [],
  );
  const results = useMemo(() => {
    const q = normalise(query);
    return TMR_FEATURE_CODES.filter((feature) => {
      if (browseLayer && modelLabel(feature.model) !== browseLayer)
        return false;
      if (!q) return true;
      const text = searchable(feature);
      return (
        text.includes(q) ||
        q
          .split(" ")
          .some(
            (word) =>
              word.length > 3 &&
              text
                .split(" ")
                .some(
                  (token) => distance(word, token) <= (word.length > 6 ? 2 : 1),
                ),
          )
      );
    });
  }, [query, browseLayer]);
  const recentFeatures = recents
    .map((code) => TMR_FEATURE_CODES.find((f) => f.code === code))
    .filter(Boolean);
  const favouriteFeatures = favourites
    .map((code) => TMR_FEATURE_CODES.find((f) => f.code === code))
    .filter(Boolean);
  const toggleFavourite = (feature) => {
    const next = favourites.includes(feature.code)
      ? favourites.filter((c) => c !== feature.code)
      : [feature.code, ...favourites];
    setFavourites(next);
    AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
  };
  const open = (feature) => {
    const next = [
      feature.code,
      ...recents.filter((c) => c !== feature.code),
    ].slice(0, 8);
    const nextUsage = {
      ...usage,
      [feature.code]: (usage[feature.code] || 0) + 1,
    };
    setRecents(next);
    setUsage(nextUsage);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    AsyncStorage.setItem(USAGE_KEY, JSON.stringify(nextUsage));
    openFeatureDetails(feature);
  };
  const card = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => open(item)}
      activeOpacity={0.84}
    >
      <View style={styles.thumbWrap}>
        {imageFor(item) ? (
          <Image source={imageFor(item)} style={styles.thumb} />
        ) : (
          <Text style={styles.noImage}>◎</Text>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardLine}>
          <Text style={styles.code}>{item.code}</Text>
          <TouchableOpacity onPress={() => toggleFavourite(item)} hitSlop={12}>
            <Text style={styles.star}>
              {favourites.includes(item.code) ? "★" : "☆"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{item.description}</Text>
        <Text style={styles.layer}>
          {modelLabel(item.model).toUpperCase()} · Pick up at{" "}
          {item.pickupMethod || "feature centre"}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
  const shortcuts = [
    [
      "▦",
      "Browse",
      "Explore by model layer",
      () => {
        setQuery("");
        setBrowseLayer(null);
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, browseSectionY - 14),
            animated: true,
          });
        });
      },
    ],
    ["◉", "Camera Compare", "Compare the object with guide images", openCamera],
  ];
  const section = (title, data) =>
    data.length ? (
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {data.slice(0, 4).map((item) => (
          <View key={`${title}-${item.code}`}>{card({ item })}</View>
        ))}
      </View>
    ) : null;
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <TmrGuideHeader insets={insets} onBack={() => setScreen("home")} />
      <FlatList
        ref={listRef}
        data={query || browseLayer ? results : []}
        keyExtractor={(item) => item.code}
        renderItem={card}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setBrowseLayer(null);
              }}
              placeholder="Search code, feature, alias or pickup..."
              placeholderTextColor="#8093A5"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.search}
            />
            <View style={styles.shortcuts}>
              {shortcuts.map(([icon, title, detail, action]) => (
                <TouchableOpacity
                  key={title}
                  style={styles.shortcut}
                  onPress={action}
                >
                  <Text style={styles.shortcutIcon}>{icon}</Text>
                  <Text style={styles.shortcutTitle}>{title}</Text>
                  <Text style={styles.shortcutDetail}>{detail}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!query && !browseLayer && (
              <>
                {section("RECENTLY VIEWED", recentFeatures)}
                {section("FAVOURITES", favouriteFeatures)}
                <View
                  onLayout={(event) =>
                    setBrowseSectionY(event.nativeEvent.layout.y)
                  }
                >
                  <Text style={styles.sectionTitle}>BROWSE BY MODEL LAYER</Text>
                  <View style={styles.layers}>
                    {layers.map((layer) => (
                      <TouchableOpacity
                        key={layer}
                        style={styles.layerButton}
                        onPress={() => setBrowseLayer(layer)}
                      >
                        <Text style={styles.layerButtonText}>{layer}</Text>
                        <Text style={styles.layerCount}>
                          {
                            TMR_FEATURE_CODES.filter(
                              (f) => modelLabel(f.model) === layer,
                            ).length
                          }
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}
            {(query || browseLayer) && (
              <Text style={styles.resultsLabel}>
                {results.length} matching feature
                {results.length === 1 ? "" : "s"}
                {browseLayer ? ` · ${browseLayer}` : ""}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          query || browseLayer ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No exact match</Text>
              <Text style={styles.emptyText}>
                Try a code, plain-language description, alias, comment or pickup
                instruction.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setQuery("");
                  setBrowseLayer(null);
                }}
              >
                <Text style={styles.clear}>Back to guide home</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE },
  content: { padding: 16, paddingBottom: 40 },
  tmrHeaderBanner: { backgroundColor: NAVY, overflow: "hidden" },
  tmrHeaderBannerImage: { opacity: 0.58 },
  tmrHeaderShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,18,33,0.62)",
  },
  tmrHeaderTop: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tmrHeaderTitleRow: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  tmrHeaderTitleCopy: { flex: 1, paddingRight: 12 },
  tmrHeaderEyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  tmrHeaderTitle: {
    color: WHITE,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 3,
  },
  tmrHeaderSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  tmrHeaderBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.42)",
  },
  tmrHeaderBadgeIcon: {
    color: NAVY,
    fontSize: 25,
    lineHeight: 26,
    fontWeight: "900",
  },
  tmrHeaderBadgeLabel: {
    color: NAVY,
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1,
  },
  tmrBackButton: { alignSelf: "flex-start", minWidth: 112 },
  job: {
    backgroundColor: COLORS.navy2,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  jobLabel: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  jobNumber: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  jobName: { color: COLORS.textMuted, marginTop: 2 },
  search: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingHorizontal: SPACING.lg,
    minHeight: 52,
    color: COLORS.textPrimary,
    fontSize: 15,
    marginBottom: SPACING.md,
  },
  shortcuts: { gap: 8 },
  shortcut: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    paddingLeft: 52,
    minHeight: 70,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  shortcutIcon: {
    position: "absolute",
    left: 16,
    top: 18,
    color: COLORS.gold,
    fontSize: 25,
  },
  shortcutTitle: { color: COLORS.textPrimary, fontWeight: "900", fontSize: 15 },
  shortcutDetail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  sectionTitle: {
    color: COLORS.goldDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  layers: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  layerButton: {
    width: "48%",
    backgroundColor: COLORS.navy2,
    borderRadius: RADIUS.md,
    padding: 13,
    borderWidth: 1,
    borderColor: "#29445A",
  },
  layerButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 13 },
  layerCount: { color: COLORS.textMuted, marginTop: 4, fontSize: 12 },
  resultsLabel: {
    color: COLORS.textSecondary,
    fontWeight: "800",
    marginTop: 22,
    marginBottom: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  thumbWrap: {
    width: 62,
    height: 62,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E8EDF1",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  noImage: { color: COLORS.textSecondary, fontSize: 26 },
  cardBody: { flex: 1, paddingHorizontal: 12 },
  cardLine: { flexDirection: "row", justifyContent: "space-between" },
  code: { color: COLORS.navy, fontWeight: "900", fontSize: 16 },
  star: { color: COLORS.goldDark, fontSize: 21 },
  name: { color: COLORS.textPrimary, fontWeight: "700", marginTop: 3 },
  layer: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 7,
  },
  chevron: { color: COLORS.goldDark, fontSize: 28 },
  empty: { alignItems: "center", padding: 32 },
  emptyTitle: { color: COLORS.white, fontSize: 18, fontWeight: "900" },
  emptyText: { color: COLORS.textMuted, textAlign: "center", marginTop: 8 },
  clear: { color: COLORS.gold, fontWeight: "900", marginTop: 18 },
});
