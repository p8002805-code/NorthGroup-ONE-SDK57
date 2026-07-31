import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

const NAVY = '#061A2D';
const NAVY2 = '#09233C';
const GOLD = '#D6A84F';
const LOCATION_SEARCH_DEBOUNCE_MS = 350;
const LOCATION_SEARCH_MIN_CHARS = 2;
const INACTIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MESSAGES = [
  "G'DAY, MATE",
  "LET'S GET IT",
  'ANOTHER DAY, ANOTHER DOLLAR',
  "LET'S GET TO WORK",
  'BACK INTO IT',
  "LET'S HAVE A GOOD ONE",
  'READY FOR THE DAY?',
  'TIME TO GET MOVING',
];
let lastMessage = -1;

const blank = { number: '', name: '', location: '' };

const nextMessage = () => {
  let index = Math.floor(Math.random() * MESSAGES.length);
  if (index === lastMessage) index = (index + 1) % MESSAGES.length;
  lastMessage = index;
  return MESSAGES[index];
};

const hasCoordinates = (result) => Number.isFinite(Number(result?.latitude))
  && Number.isFinite(Number(result?.longitude));

const isQueensland = (result) => (
  String(result?.admin1 || '').toLowerCase().includes('queensland')
  || String(result?.admin1_code || '').toUpperCase() === 'QLD'
);

const suggestionLabel = (result) => [
  result?.name,
  result?.admin1,
].filter(Boolean).join(', ');

export default function JobsScreen({
  jobs = [],
  activeJob,
  selectJob,
  addJob,
  editJob,
  deleteJob,
  openDashboard,
  microsoftConnected,
  refreshTeamsJobs,
}) {
  const insets = useSafeAreaInsets();
  const [greeting, setGreeting] = useState(nextMessage());
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [teamsRefreshing, setTeamsRefreshing] = useState(false);
  const [teamsMessage, setTeamsMessage] = useState('');
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;
  const locationRequestId = useRef(0);

  const inactiveCutoff = Date.now() - INACTIVE_AFTER_MS;
  const otherJobs = jobs.filter((job) => job.number !== activeJob?.number);
  const inactiveJobs = otherJobs.filter((job) => {
    const lastAccessed = Date.parse(job.lastOpenedAt || job.createdAt || '');
    return Number.isFinite(lastAccessed) && lastAccessed < inactiveCutoff;
  });
  const existingJobs = otherJobs.filter((job) => !inactiveJobs.includes(job));

  const replayEntrance = useCallback(() => {
    setGreeting(nextMessage());
    entrance.stopAnimation();
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    replayEntrance();
    return () => entrance.stopAnimation();
  }, [entrance, replayEntrance]);

  const syncTeams = useCallback(async (quiet = false) => {
    if (!microsoftConnected || teamsRefreshing || !refreshTeamsJobs) return;
    setTeamsRefreshing(true);
    if (!quiet) setTeamsMessage('');
    try {
      const count = await refreshTeamsJobs();
      setTeamsMessage(count
        ? `${count} assigned ${count === 1 ? 'job' : 'jobs'} refreshed from Teams.`
        : 'No published Teams shifts matched the job number + location rule.');
    } catch (syncError) {
      setTeamsMessage(syncError?.status === 403
        ? 'Teams access needs Microsoft administrator approval.'
        : (syncError?.message || 'Teams jobs could not be refreshed.'));
    } finally {
      setTeamsRefreshing(false);
    }
  }, [microsoftConnected, refreshTeamsJobs, teamsRefreshing]);

  const initialTeamsSync = useRef(false);
  useEffect(() => {
    if (!microsoftConnected || initialTeamsSync.current) return;
    initialTeamsSync.current = true;
    syncTeams(true);
  }, [microsoftConnected, syncTeams]);

  useEffect(() => {
    const query = draft.location.trim();
    if (
      !editor
      || query.length < LOCATION_SEARCH_MIN_CHARS
      || selectedLocation?.label === query
    ) {
      setLocationSuggestions([]);
      setLocationSearchLoading(false);
      return undefined;
    }

    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    const timer = setTimeout(async () => {
      setLocationSearchLoading(true);
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json&countryCode=AU`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Location search failed');
        const data = await response.json();
        const australianResults = (data?.results || [])
          .filter((result) => result?.country_code === 'AU' && hasCoordinates(result))
          .map((result) => ({
            id: `${result.id || result.name}-${result.latitude}-${result.longitude}`,
            label: suggestionLabel(result),
            latitude: Number(result.latitude),
            longitude: Number(result.longitude),
            queensland: isQueensland(result),
          }));
        const queenslandResults = australianResults.filter((result) => result.queensland);
        const results = (queenslandResults.length ? queenslandResults : australianResults).slice(0, 6);

        if (requestId === locationRequestId.current) {
          setLocationSuggestions(results);
        }
      } catch (_error) {
        if (requestId === locationRequestId.current) setLocationSuggestions([]);
      } finally {
        if (requestId === locationRequestId.current) setLocationSearchLoading(false);
      }
    }, LOCATION_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft.location, editor, selectedLocation]);

  const openCreate = () => {
    setError('');
    setDraft(blank);
    setSelectedLocation(null);
    setLocationSuggestions([]);
    setEditor({ mode: 'create' });
  };

  const openEdit = (job) => {
    const location = job.location || '';
    setError('');
    setDraft({ number: job.number, name: job.name, location });
    setSelectedLocation(
      Number.isFinite(Number(job.latitude)) && Number.isFinite(Number(job.longitude))
        ? {
          label: location,
          latitude: Number(job.latitude),
          longitude: Number(job.longitude),
        }
        : null
    );
    setLocationSuggestions([]);
    setEditor({ mode: 'edit', job });
  };

  const closeEditor = () => {
    setEditor(null);
    setError('');
    setSelectedLocation(null);
    setLocationSuggestions([]);
    Keyboard.dismiss();
  };

  const chooseLocation = (suggestion) => {
    setDraft((current) => ({ ...current, location: suggestion.label }));
    setSelectedLocation(suggestion);
    setLocationSuggestions([]);
    setLocationSearchLoading(false);
    Keyboard.dismiss();
  };

  const submit = async () => {
    try {
      setError('');
      let values = { ...draft };
      const chosenLocation = selectedLocation?.label === draft.location
        ? selectedLocation
        : null;

      if (chosenLocation) {
        values = {
          ...values,
          latitude: chosenLocation.latitude,
          longitude: chosenLocation.longitude,
        };
      } else {
        try {
          const matches = await Location.geocodeAsync(draft.location);
          if (matches[0]) {
            values = {
              ...values,
              latitude: matches[0].latitude,
              longitude: matches[0].longitude,
            };
          }
        } catch (_error) {
          // The typed location can still be saved and resolved by weather later.
        }
      }

      if (editor?.mode === 'edit') await editJob(editor.job, values);
      else await addJob(values);
      closeEditor();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const confirmDelete = (job) => Alert.alert(
    'Permanently delete this job?',
    `${job.number} · ${job.name}\n\nWARNING: This permanently deletes all information stored under this job, including saved forms, drafts, SE-14 sessions and survey photos. This cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: () => deleteJob(job) },
    ]
  );

  return (
    <ImageBackground
      source={require('../../../../assets/topo-bg-vertical.png')}
      style={styles.page}
      imageStyle={styles.background}
    >
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.scrim} />
      <Animated.View
        style={[
          styles.shell,
          {
            paddingTop: insets.top + 12,
            opacity: entrance,
            transform: [{
              translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            }],
          },
        ]}
      >
        <Pressable
          onPress={replayEntrance}
          accessibilityRole="button"
          accessibilityLabel="Replay the Choose your job introduction"
        >
          <View style={styles.brandRow}>
            <Image
              source={require('../../../../assets/logo-transparent.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brand}>NORTHGROUP</Text>
              <Text style={styles.one}>ONE</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.heading}>Choose your job</Text>
            <Text style={styles.sub}>One job. One workspace. Everything exactly where it belongs.</Text>
          </View>
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}
        >
          {activeJob?.number ? (
            <>
              <Text style={styles.label}>CURRENT JOB</Text>
              <View style={styles.active}>
                <View style={styles.activeTop}>
                  <View style={styles.liveDot} />
                  <Text style={styles.live}>ACTIVE WORKSPACE</Text>
                </View>
                <Text style={styles.number}>{activeJob.number}</Text>
                <Text style={styles.name}>{activeJob.name}</Text>
                {String(activeJob.source || '').includes('teams-shifts') ? <Text style={styles.teamsBadge}>TEAMS SHIFT</Text> : null}
                {activeJob.location ? <Text style={styles.location}>⌖  {activeJob.location}</Text> : null}
                <View style={styles.activeActions}>
                  <Pressable style={styles.activeActionButton} onPress={() => openEdit(activeJob)}>
                    <Text style={styles.activeActionText}>EDIT DETAILS</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.activeFooter} onPress={openDashboard}>
                  <Text style={styles.continueText}>CONTINUE TO DASHBOARD</Text>
                  <Text style={styles.continueArrow}>›</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <View style={styles.newJobRow}>
            <Pressable
              style={({ pressed }) => [styles.newJobButton, pressed && styles.pressed]}
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel="Create a new job"
            >
              <Text style={styles.newJobButtonText}>＋ NEW JOB</Text>
            </Pressable>
          </View>

          {microsoftConnected ? (
            <View style={styles.teamsSyncArea}>
              <Pressable
                style={({ pressed }) => [styles.teamsSyncButton, pressed && styles.pressed]}
                onPress={() => syncTeams(false)}
                disabled={teamsRefreshing}
              >
                <Text style={styles.teamsSyncText}>
                  {teamsRefreshing ? 'REFRESHING TEAMS…' : '↻  REFRESH FROM TEAMS'}
                </Text>
              </Pressable>
              {teamsMessage ? <Text style={styles.teamsMessage}>{teamsMessage}</Text> : null}
            </View>
          ) : null}

          <View style={styles.sectionRow}>
            <Text style={styles.label}>EXISTING JOBS</Text>
          </View>

          {existingJobs.map((job) => (
            <View key={job.number} style={styles.job}>
              <Pressable style={styles.jobOpen} onPress={() => selectJob(job)}>
                <Text style={styles.jobNumber}>{job.number}</Text>
                <Text style={styles.jobName}>{job.name}</Text>
                {String(job.source || '').includes('teams-shifts') ? <Text style={styles.listTeamsBadge}>TEAMS</Text> : null}
                <Text style={styles.jobLocation}>⌖  {job.location || 'Location not added'}</Text>
              </Pressable>
              <View style={styles.jobActions}>
                <Pressable style={styles.iconButton} onPress={() => openEdit(job)}>
                  <Text style={styles.iconText}>EDIT</Text>
                </Pressable>
                <Pressable style={[styles.iconButton, styles.deleteButton]} onPress={() => confirmDelete(job)}>
                  <Text style={styles.deleteText}>DELETE</Text>
                </Pressable>
                <Pressable onPress={() => selectJob(job)}>
                  <Text style={styles.arrow}>›</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {activeJob?.number && !otherJobs.length ? (
            <View style={styles.noExisting}>
              <Text style={styles.noExistingText}>No other jobs saved yet.</Text>
            </View>
          ) : null}

          {inactiveJobs.length ? (
            <View style={styles.inactiveSection}>
              <Pressable
                style={({ pressed }) => [styles.inactiveFolder, pressed && styles.pressed]}
                onPress={() => setInactiveOpen((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={`${inactiveOpen ? 'Close' : 'Open'} inactive jobs`}
              >
                <View style={styles.inactiveFolderIcon}>
                  <Text style={styles.inactiveFolderIconText}>▰</Text>
                </View>
                <View style={styles.inactiveFolderCopy}>
                  <Text style={styles.inactiveFolderTitle}>Inactive Jobs</Text>
                  <Text style={styles.inactiveFolderSub}>
                    Not accessed in the last 30 days · {inactiveJobs.length} {inactiveJobs.length === 1 ? 'job' : 'jobs'}
                  </Text>
                </View>
                <Text style={styles.inactiveChevron}>{inactiveOpen ? '⌃' : '⌄'}</Text>
              </Pressable>

              {inactiveOpen ? inactiveJobs.map((job) => (
                <View key={job.number} style={[styles.job, styles.inactiveJob]}>
                  <Pressable style={styles.jobOpen} onPress={() => selectJob(job)}>
                    <Text style={styles.jobNumber}>{job.number}</Text>
                    <Text style={styles.jobName}>{job.name}</Text>
                    {String(job.source || '').includes('teams-shifts') ? <Text style={styles.listTeamsBadge}>TEAMS</Text> : null}
                    <Text style={styles.jobLocation}>⌖  {job.location || 'Location not added'}</Text>
                  </Pressable>
                  <View style={styles.jobActions}>
                    <Pressable style={styles.iconButton} onPress={() => openEdit(job)}>
                      <Text style={styles.iconText}>EDIT</Text>
                    </Pressable>
                    <Pressable style={[styles.iconButton, styles.deleteButton]} onPress={() => confirmDelete(job)}>
                      <Text style={styles.deleteText}>DELETE</Text>
                    </Pressable>
                    <Pressable onPress={() => selectJob(job)}>
                      <Text style={styles.arrow}>›</Text>
                    </Pressable>
                  </View>
                </View>
              )) : null}
            </View>
          ) : null}

          {!jobs.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⌖</Text>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptyText}>Create your first job to open a clean workspace.</Text>
              <Pressable style={styles.emptyButton} onPress={openCreate}>
                <Text style={styles.emptyButtonText}>CREATE FIRST JOB</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>

      <Modal visible={Boolean(editor)} transparent animationType="slide" onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={[styles.shade, editor?.mode === 'edit' && styles.shadeTop]}
            onPress={Keyboard.dismiss}
          >
            <View
              style={[
                styles.sheet,
                editor?.mode === 'edit' && styles.sheetTop,
                { paddingBottom: insets.bottom + 22 },
              ]}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetEyebrow}>
                {editor?.mode === 'edit' ? 'UPDATE WORKSPACE' : 'NEW WORKSPACE'}
              </Text>
              <Text style={styles.sheetTitle}>{editor?.mode === 'edit' ? 'Edit Job' : 'Create Job'}</Text>
              <Text style={styles.sheetSub}>Job details automatically flow into forms, photos, filenames and weather.</Text>

              {[
                ['number', 'Job Number', '205672'],
                ['name', 'Job Name', 'Bruce Highway Upgrade'],
                ['location', 'Job Location', 'Rockhampton, QLD'],
              ].map(([key, label, placeholder]) => (
                <View key={key}>
                  <Text style={styles.inputLabel}>
                    {label}{editor?.mode === 'edit' && key === 'number' ? ' · LOCKED' : ''}
                  </Text>
                  <TextInput
                    editable={!(editor?.mode === 'edit' && key === 'number')}
                    style={[styles.input, editor?.mode === 'edit' && key === 'number' && styles.inputLocked]}
                    value={draft[key]}
                    onChangeText={(value) => {
                      setDraft({ ...draft, [key]: key === 'number' ? value.toUpperCase() : value });
                      if (key === 'location') {
                        setSelectedLocation(null);
                        setLocationSuggestions([]);
                      }
                    }}
                    placeholder={placeholder}
                    placeholderTextColor="#71808C"
                    autoCorrect={false}
                  />

                  {key === 'location' && (locationSearchLoading || locationSuggestions.length > 0) ? (
                    <View style={styles.locationSuggestions}>
                      {locationSearchLoading ? (
                        <Text style={styles.locationSearchHint}>SEARCHING QUEENSLAND FIRST…</Text>
                      ) : null}
                      {locationSuggestions.map((suggestion) => (
                        <Pressable
                          key={suggestion.id}
                          style={({ pressed }) => [styles.locationSuggestion, pressed && styles.suggestionPressed]}
                          onPress={() => chooseLocation(suggestion)}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${suggestion.label} as the job location`}
                        >
                          <Text style={styles.locationSuggestionTitle}>{suggestion.label}</Text>
                          <Text style={styles.locationSuggestionSubtitle}>Tap to use this location</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable style={styles.createButton} onPress={submit}>
                <Text style={styles.createText}>{editor?.mode === 'edit' ? 'SAVE JOB DETAILS' : 'CREATE & OPEN JOB'}</Text>
              </Pressable>
              <Pressable onPress={closeEditor}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: NAVY },
  background: { opacity: 0.55 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,20,34,.68)' },
  shell: { flex: 1, paddingHorizontal: 20 },
  brandRow: { height: 46, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 42, height: 42, marginRight: 8 },
  brand: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  one: { color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 3 },
  hero: { paddingTop: 26, paddingBottom: 26 },
  greeting: { color: GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  heading: { color: '#FFF', fontSize: 33, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  sub: { color: 'rgba(255,255,255,.7)', fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 330 },
  label: { color: 'rgba(255,255,255,.55)', fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginBottom: 10 },
  active: { backgroundColor: 'rgba(8,35,58,.94)', borderRadius: 22, padding: 19, marginBottom: 4, borderWidth: 1, borderColor: GOLD, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  activeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#45C878', marginRight: 7 },
  live: { color: '#70DA98', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  number: { color: '#FFF', fontSize: 29, fontWeight: '900' },
  name: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 2 },
  location: { color: '#B8C4D0', fontSize: 12, marginTop: 8 },
  activeActions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  activeActionButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,.2)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  activeActionText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  teamsBadge: { alignSelf: 'flex-start', color: NAVY, backgroundColor: GOLD, borderRadius: 5, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 9 },
  activeFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.12)', marginTop: 13, paddingTop: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  continueText: { color: GOLD, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  continueArrow: { color: GOLD, fontSize: 24 },
  newJobRow: { alignItems: 'center', marginTop: 22, marginBottom: 24 },
  newJobButton: { minWidth: 172, borderRadius: 13, backgroundColor: GOLD, paddingHorizontal: 24, paddingVertical: 13, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  newJobButtonText: { color: NAVY, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  teamsSyncArea: { alignItems: 'center', marginTop: -10, marginBottom: 22 },
  teamsSyncButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', borderRadius: 11, paddingHorizontal: 17, paddingVertical: 10, backgroundColor: 'rgba(5,28,47,.58)' },
  teamsSyncText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  teamsMessage: { color: 'rgba(255,255,255,.68)', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  sectionRow: { marginBottom: 10 },
  job: { backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 17, marginBottom: 10, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  jobOpen: { flex: 1, padding: 15 },
  jobNumber: { color: NAVY, fontSize: 17, fontWeight: '900' },
  jobName: { color: '#354B5B', fontSize: 13, fontWeight: '700', marginTop: 2 },
  listTeamsBadge: { alignSelf: 'flex-start', color: '#8B6828', backgroundColor: '#F7EACD', borderRadius: 5, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, fontWeight: '900', letterSpacing: 0.7, marginTop: 6 },
  jobLocation: { color: '#71808C', fontSize: 11, marginTop: 5 },
  jobActions: { alignItems: 'center', flexDirection: 'row', paddingRight: 10, gap: 5 },
  iconButton: { backgroundColor: '#EDF1F3', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 7 },
  iconText: { color: NAVY2, fontSize: 8, fontWeight: '900' },
  deleteButton: { backgroundColor: '#FFF0F0' },
  deleteText: { color: '#B43636', fontSize: 8, fontWeight: '900' },
  arrow: { color: GOLD, fontSize: 27, paddingLeft: 2 },
  noExisting: { alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)', borderRadius: 15, paddingVertical: 17, marginBottom: 10 },
  noExistingText: { color: 'rgba(255,255,255,.58)', fontSize: 12 },
  inactiveSection: { marginTop: 8, marginBottom: 10 },
  inactiveFolder: { minHeight: 72, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', backgroundColor: 'rgba(5,28,47,.78)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 10 },
  inactiveFolderIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(214,168,79,.16)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  inactiveFolderIconText: { color: GOLD, fontSize: 19, transform: [{ rotate: '180deg' }] },
  inactiveFolderCopy: { flex: 1 },
  inactiveFolderTitle: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  inactiveFolderSub: { color: 'rgba(255,255,255,.58)', fontSize: 10, lineHeight: 14, marginTop: 3 },
  inactiveChevron: { color: GOLD, fontSize: 20, marginLeft: 10 },
  inactiveJob: { opacity: 0.9, marginLeft: 8, width: 'auto' },
  empty: { alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', borderRadius: 20, padding: 28, backgroundColor: 'rgba(5,28,47,.64)' },
  emptyIcon: { color: GOLD, fontSize: 34 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 8 },
  emptyText: { color: 'rgba(255,255,255,.62)', fontSize: 12, marginTop: 4 },
  emptyButton: { backgroundColor: GOLD, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 12, marginTop: 17 },
  emptyButtonText: { color: NAVY, fontSize: 10, fontWeight: '900' },
  keyboardAvoider: { flex: 1 },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', justifyContent: 'flex-end' },
  shadeTop: { justifyContent: 'flex-start', paddingTop: 52 },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 24, paddingTop: 10 },
  sheetTop: { borderRadius: 24, marginHorizontal: 12 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D5DCE1', alignSelf: 'center', marginBottom: 18 },
  sheetEyebrow: { color: '#9A742E', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  sheetTitle: { color: NAVY, fontSize: 26, fontWeight: '900', marginTop: 4 },
  sheetSub: { color: '#657684', lineHeight: 18, marginTop: 4, marginBottom: 10 },
  inputLabel: { color: NAVY, fontSize: 10, fontWeight: '900', marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: '#F1F4F6', borderWidth: 1, borderColor: '#D8E0E5', borderRadius: 12, padding: 13, color: NAVY, fontSize: 15 },
  inputLocked: { backgroundColor: '#E5EAED', color: '#697984' },
  locationSuggestions: { marginTop: 6, borderWidth: 1, borderColor: '#D8E0E5', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF' },
  locationSearchHint: { color: '#71808C', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 12, paddingVertical: 9 },
  locationSuggestion: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8E0E5', paddingHorizontal: 12, paddingVertical: 10 },
  suggestionPressed: { backgroundColor: '#F1F4F6' },
  locationSuggestionTitle: { color: NAVY, fontSize: 13, fontWeight: '800' },
  locationSuggestionSubtitle: { color: '#71808C', fontSize: 10, marginTop: 2 },
  error: { color: '#C43C3C', fontWeight: '700', marginTop: 11 },
  createButton: { backgroundColor: GOLD, borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 17 },
  createText: { color: NAVY, fontWeight: '900', fontSize: 12, letterSpacing: 0.7 },
  cancel: { textAlign: 'center', color: '#6C7B86', fontWeight: '700', paddingTop: 14 },
});
