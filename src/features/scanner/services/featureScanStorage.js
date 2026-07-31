import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { jobStorageKey } from '../../jobs/jobContext';

const SCANS_KEY = 'northgroup_3d_feature_scans_v1';

const scanKey = (job) => jobStorageKey(SCANS_KEY, job);

const normaliseScan = (scan = {}) => ({
  id: String(scan.id || ''),
  jobNumber: String(scan.jobNumber || '').trim().toUpperCase(),
  featureId: String(scan.featureId || '').trim().toUpperCase(),
  notes: String(scan.notes || '').trim(),
  operator: String(scan.operator || '').trim(),
  modelUri: String(scan.modelUri || ''),
  scanDirectoryUri: String(scan.scanDirectoryUri || ''),
  createdAt: scan.createdAt || new Date().toISOString(),
  format: 'USDZ',
});

export const loadFeatureScans = async (job) => {
  if (!job?.number) return [];

  const saved = await AsyncStorage.getItem(scanKey(job));
  const scans = saved ? JSON.parse(saved) : [];
  const checked = await Promise.all(
    scans.map(async (value) => {
      const scan = normaliseScan(value);
      if (!scan.modelUri) return null;
      try {
        const info = await FileSystem.getInfoAsync(scan.modelUri);
        return info.exists
          ? { ...scan, size: Number(info.size || 0) }
          : null;
      } catch {
        return null;
      }
    }),
  );

  return checked
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const saveFeatureScan = async (job, scan) => {
  const current = await loadFeatureScans(job);
  const next = [
    normaliseScan(scan),
    ...current.filter((item) => item.id !== scan.id),
  ];
  await AsyncStorage.setItem(scanKey(job), JSON.stringify(next));
  return next;
};
