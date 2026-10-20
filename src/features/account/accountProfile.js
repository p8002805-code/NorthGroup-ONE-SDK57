import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_THEME_ID,
  resolveAppearanceMode,
  resolveThemeId,
} from '../../theme/themePresets';
import { accountStorageKey } from '../../services/account/accountIdentity';
import { secureRandomId } from '../../services/security/secureRandom';
import { resolveUserInitials } from '../../utils/userInitials';

export const ACCOUNT_PROFILE_KEY = 'northgroup_user_profile';
export const JOB_PREFERENCES_KEY = 'northgroup_job_preferences_v1';
export const PROFILE_SETUP_KEY = 'northgroup_profile_setup_complete_v181';

export const emptyAccountProfile = {
  userId: '',
  identitySource: 'local',
  profileVersion: 1,
  firstName: '',
  lastName: '',
  initials: '',
  role: '',
  office: '',
  email: '',
  phone: '',
  vehicle: '',
  vehicleRego: '',
  defaultJob: '',
  defaultJobName: '',
  jobs: [],
  signature: '',
  signatureStyle: 'original',
  themeId: DEFAULT_THEME_ID,
  appearanceMode: 'light',
};

const SIGNATURE_STYLE_ALIASES = {
  plain: 'original',
  signature1: 'signature',
  signature2: 'handwritten',
  signature3: 'classic',
  script: 'signature',
};

export const normaliseProfile = (profile = {}) => {
  const fullName = String(profile.fullName || '').trim();
  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const firstName = String(profile.firstName || nameParts[0] || '').trim();
  const lastName = String(profile.lastName || nameParts.slice(1).join(' ') || '').trim();
  const initials = resolveUserInitials({
    firstName,
    lastName,
    initials: profile.initials,
    fallback: '',
  });

  // Older builds stored registration in `vehicle` and make/model in
  // `vehicleMake`. New builds use `vehicle` for make/model and `vehicleRego`
  // for registration. Prefer the new fields whenever vehicleRego exists.
  const isLegacyVehicleProfile = Object.prototype.hasOwnProperty.call(profile, 'vehicleMake')
    && !Object.prototype.hasOwnProperty.call(profile, 'vehicleRego');
  const vehicle = String(
    isLegacyVehicleProfile
      ? profile.vehicleMake || ''
      : profile.vehicle || profile.vehicleMake || ''
  ).trim();
  const vehicleRego = String(
    isLegacyVehicleProfile
      ? profile.vehicle || ''
      : profile.vehicleRego || ''
  ).trim().toUpperCase();

  const defaultJob = String(profile.defaultJob || '').trim();
  const defaultJobName = String(profile.defaultJobName || '').trim();
  const jobs = Array.isArray(profile.jobs) ? profile.jobs : [];
  const hasDefaultJob = jobs.some((job) => String(job?.number || '').trim() === defaultJob);
  const requestedSignatureStyle = profile.signatureStyle
    || profile.signatureFont
    || profile.signatureVariant
    || 'original';
  const signatureStyle = SIGNATURE_STYLE_ALIASES[requestedSignatureStyle]
    || requestedSignatureStyle;

  return {
    ...emptyAccountProfile,
    ...profile,
    userId: String(profile.userId || '').trim(),
    identitySource: String(profile.identitySource || 'local').trim() || 'local',
    profileVersion: Number(profile.profileVersion) || 1,
    firstName,
    lastName,
    initials,
    vehicle,
    vehicleRego,
    defaultJob,
    defaultJobName,
    jobs: defaultJob && !hasDefaultJob
      ? [{ number: defaultJob, name: defaultJobName, source: profile.jobSource || 'employee' }, ...jobs]
      : jobs,
    signature: String(profile.signature || `${firstName} ${lastName}`.trim()).trim(),
    signatureStyle: ['original', 'signature', 'classic', 'handwritten'].includes(signatureStyle)
      ? signatureStyle
      : 'original',
    themeId: resolveThemeId(profile.themeId),
    appearanceMode: resolveAppearanceMode(profile.appearanceMode),
  };
};

export const profileFullName = (profile) => {
  const clean = normaliseProfile(profile);
  return `${clean.firstName} ${clean.lastName}`.trim();
};

export const profileInitials = (profile) => {
  const clean = normaliseProfile(profile);
  return resolveUserInitials({
    firstName: clean.firstName,
    lastName: clean.lastName,
    initials: clean.initials,
  });
};

export const createLocalUserId = () => (
  secureRandomId('local')
);

export const isProfileSetupComplete = (profile) => {
  const clean = normaliseProfile(profile);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email);

  return Boolean(
    clean.firstName
      && clean.lastName
      && clean.initials
      && clean.office
      && emailLooksValid
  );
};

export const firstName = (profile) => normaliseProfile(profile).firstName || 'Team';

export const activeJobFromProfile = (profile) => {
  const clean = normaliseProfile(profile);
  return clean.jobs.find((job) => String(job?.number || '').trim() === clean.defaultJob) || {
    number: clean.defaultJob,
    name: clean.defaultJobName,
    source: 'employee',
  };
};

export const loadAccountProfile = async () => {
  const saved = await AsyncStorage.getItem(accountStorageKey(ACCOUNT_PROFILE_KEY));
  return saved ? normaliseProfile(JSON.parse(saved)) : null;
};

export const saveAccountProfile = async (profile) => {
  const clean = { ...normaliseProfile(profile), updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(accountStorageKey(ACCOUNT_PROFILE_KEY), JSON.stringify(clean));
  return clean;
};

export const loadJobPreferences = async () => {
  const saved = await AsyncStorage.getItem(accountStorageKey(JOB_PREFERENCES_KEY));
  return saved ? JSON.parse(saved) : {};
};

export const saveJobPreference = async (jobNumber, values) => {
  const cleanJobNumber = String(jobNumber || '').trim();
  if (!cleanJobNumber) return;
  const current = await loadJobPreferences();
  const next = {
    ...current,
    [cleanJobNumber]: {
      ...(current[cleanJobNumber] || {}),
      ...values,
    },
  };
  await AsyncStorage.setItem(accountStorageKey(JOB_PREFERENCES_KEY), JSON.stringify(next));
};

export const welcomeUserFromProfile = (profile) => {
  const clean = normaliseProfile(profile);
  return {
    firstName: clean.firstName || 'Team',
    currentJob: {
      number: clean.defaultJob || 'No job selected',
      name: clean.defaultJobName || 'Set a default job in Profile Settings',
    },
  };
};

export const applyProfileDefaults = (form, profile, kind, activeJob = null) => {
  if (!profile) return form;
  const clean = normaliseProfile(profile);
  const fullName = profileFullName(clean);
  const next = { ...form };
  const setIfBlank = (key, value) => {
    if (!String(next[key] || '').trim() && value) next[key] = value;
  };

  if (kind === 's500') {
    setIfBlank('completedBy', fullName);
    setIfBlank('jobNumber', activeJob?.number || clean.defaultJob);
  }
  if (kind === 'se14') {
    setIfBlank('observer', fullName);
    setIfBlank('projectNumber', activeJob?.number || clean.defaultJob);
  }
  if (kind === 's501') {
    setIfBlank('completedBy', fullName);
    setIfBlank('vehicleMake', clean.vehicle);
    setIfBlank('registration', clean.vehicleRego);
  }
  if (kind === 's506') {
    setIfBlank('drivers', fullName);
    setIfBlank('vehicleRegistration', clean.vehicleRego);
    setIfBlank('jobNumber', activeJob?.number || clean.defaultJob);
    setIfBlank('departureFrom', clean.office);
  }

  return {
    ...next,
    jobId: activeJob?.id || activeJob?.number || next.jobId || '',
    jobSnapshot: activeJob ? { ...activeJob } : next.jobSnapshot || null,
    employeeProfile: {
      userId: clean.userId,
      identitySource: clean.identitySource,
      fullName,
      initials: clean.initials,
      role: clean.role,
      office: clean.office,
      email: clean.email,
      phone: clean.phone,
      vehicle: clean.vehicle,
      vehicleRego: clean.vehicleRego,
      signature: clean.signature,
      signatureStyle: clean.signatureStyle,
    },
  };
};
