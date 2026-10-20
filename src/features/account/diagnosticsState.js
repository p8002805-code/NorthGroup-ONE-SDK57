import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountStorageKey } from '../../services/account/accountIdentity';

const DIAGNOSTICS_KEY = 'northgroup_one_diagnostics_v1';

const emptyState = {
  lastCheckedAt: '',
  lastSuccessfulMicrosoftAt: '',
  lastSuccessfulSharePointAt: '',
  lastSharePointFolder: '',
};

const normaliseState = (value) => ({
  ...emptyState,
  ...(value && typeof value === 'object' ? value : {}),
});

export const loadDiagnosticsState = async () => {
  try {
    const saved = await AsyncStorage.getItem(accountStorageKey(DIAGNOSTICS_KEY));
    return normaliseState(saved ? JSON.parse(saved) : null);
  } catch {
    return { ...emptyState };
  }
};

export const saveDiagnosticsState = async (changes) => {
  const current = await loadDiagnosticsState();
  const next = normaliseState({ ...current, ...changes });
  await AsyncStorage.setItem(
    accountStorageKey(DIAGNOSTICS_KEY),
    JSON.stringify(next),
  );
  return next;
};
