import { useCallback, useRef, useState } from 'react';

import {
  buildKmlUserViewSettings,
  emptyKmlUserViewSettings,
  resolveKmlUserViewSettings,
  saveKmlUserViewSettings,
} from '../kmlUserViewSettings';

const defaultLiveState = () => ({
  layerVisibility: { pins: true, lines: true, polygons: true },
  hiddenLayers: {},
  hiddenFeatures: {},
});

export default function useKmlUserViewSettings({ job, layers, features }) {
  const initial = defaultLiveState();
  const [layerVisibility, setLayerVisibility] = useState(initial.layerVisibility);
  const [hiddenLayers, setHiddenLayers] = useState(initial.hiddenLayers);
  const [hiddenFeatures, setHiddenFeatures] = useState(initial.hiddenFeatures);
  const settingsRef = useRef(emptyKmlUserViewSettings());
  const liveRef = useRef(initial);
  const saveChainRef = useRef(Promise.resolve());

  const queueSave = useCallback((nextLiveState) => {
    liveRef.current = nextLiveState;
    const snapshot = buildKmlUserViewSettings({
      ...nextLiveState,
      layers,
      features,
      previousSettings: settingsRef.current,
    });
    settingsRef.current = snapshot;
    saveChainRef.current = saveChainRef.current
      .catch(() => {})
      .then(() => saveKmlUserViewSettings(job, snapshot))
      .catch(() => {});
  }, [features, job, layers]);

  const hydrate = useCallback((settings, nextLayers = [], nextFeatures = []) => {
    const resolved = resolveKmlUserViewSettings(settings, nextLayers, nextFeatures);
    const live = {
      layerVisibility: resolved.layerVisibility,
      hiddenLayers: resolved.hiddenLayers,
      hiddenFeatures: resolved.hiddenFeatures,
    };
    settingsRef.current = resolved.settings;
    liveRef.current = live;
    setLayerVisibility(live.layerVisibility);
    setHiddenLayers(live.hiddenLayers);
    setHiddenFeatures(live.hiddenFeatures);
    return resolved;
  }, []);

  const updateLayerVisibility = useCallback((nextVisibility) => {
    const next = {
      pins: nextVisibility?.pins !== false,
      lines: nextVisibility?.lines !== false,
      polygons: nextVisibility?.polygons !== false,
    };
    setLayerVisibility(next);
    queueSave({ ...liveRef.current, layerVisibility: next });
  }, [queueSave]);

  const setLayerHidden = useCallback((id, hidden) => {
    const next = { ...liveRef.current.hiddenLayers };
    if (hidden) next[id] = true;
    else delete next[id];
    setHiddenLayers(next);
    queueSave({ ...liveRef.current, hiddenLayers: next });
  }, [queueSave]);

  const setFeatureHidden = useCallback((id, hidden) => {
    const next = { ...liveRef.current.hiddenFeatures };
    if (hidden) next[id] = true;
    else delete next[id];
    setHiddenFeatures(next);
    queueSave({ ...liveRef.current, hiddenFeatures: next });
  }, [queueSave]);

  const isLayerHidden = useCallback((id) => Boolean(liveRef.current.hiddenLayers[id]), []);
  const isFeatureHidden = useCallback((id) => Boolean(liveRef.current.hiddenFeatures[id]), []);

  return {
    layerVisibility,
    hiddenLayers,
    hiddenFeatures,
    hydrate,
    updateLayerVisibility,
    setLayerHidden,
    setFeatureHidden,
    isLayerHidden,
    isFeatureHidden,
  };
}
