import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import HomeScreen from '../../../screens/HomeScreen';
import { useTheme } from '../../../theme/ThemeContext';
import JobFilesScreen from '../../jobFiles/screens/JobFilesScreen';
import JobWorkspaceScreen from './JobWorkspaceScreen';

const HUB_TABS = new Set(['workspace', 'forms', 'files']);
const normaliseTab = (value) => (
  HUB_TABS.has(value) ? value : 'workspace'
);

function HubPane({
  tab,
  activeTab,
  children,
}) {
  const active = activeTab === tab;

  return (
    <View
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[styles.pane, !active && styles.paneHidden]}
    >
      {children}
    </View>
  );
}

export default function JobHubScreen({
  job,
  loading,
  initialTab = 'workspace',
  navigationRequestKey = '',
  pendingUpload = null,
  formLabel = '',
  onPendingUploadHandled,
  getAccessToken,
  onRecentlyOpened,
  updatedBy,
  progressRefreshRequest = null,
  progressFocusRequest = null,
  jobDetailsFocusRequest = null,
  onProgressNotificationsAdded,
  onBriefSaved,
  onUpdateJob,
  goDashboard,
  openForm,
  openKml,
  openCapture,
  openTmrFeatureGuide,
}) {
  const { colors } = useTheme();
  const requestedTab = normaliseTab(pendingUpload ? 'files' : initialTab);
  const [activeTab, setActiveTab] = useState(requestedTab);
  const activeTabRef = useRef(requestedTab);
  const [visitedTabs, setVisitedTabs] = useState({ [requestedTab]: true });
  const [queuedUpload, setQueuedUpload] = useState(pendingUpload);
  const [queuedFormLabel, setQueuedFormLabel] = useState(formLabel);
  const mountedRef = useRef(true);
  const showTab = useCallback((nextValue) => {
    const nextTab = normaliseTab(nextValue);
    const currentTab = activeTabRef.current;
    if (currentTab === nextTab) return;

    activeTabRef.current = nextTab;
    setVisitedTabs((current) => (
      current[nextTab] ? current : { ...current, [nextTab]: true }
    ));
    setActiveTab(nextTab);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setQueuedUpload(pendingUpload || null);
    setQueuedFormLabel(formLabel || '');
    showTab(pendingUpload ? 'files' : initialTab);
  }, [formLabel, initialTab, navigationRequestKey, pendingUpload, showTab]);

  const clearQueuedUpload = useCallback(async (upload) => {
    if (mountedRef.current && !upload?.partial) {
      setQueuedUpload(null);
      setQueuedFormLabel('');
    }
    await onPendingUploadHandled?.(upload);
  }, [onPendingUploadHandled]);

  const returnToDashboard = useCallback(() => goDashboard?.(), [goDashboard]);

  const pageBackground = useMemo(() => ({
    backgroundColor: colors.pageBackground,
  }), [colors.pageBackground]);

  return (
    <View style={[styles.page, pageBackground]}>
      {visitedTabs.workspace ? (
        <HubPane
          tab="workspace"
          activeTab={activeTab}
        >
          <JobWorkspaceScreen
            job={job}
            active={activeTab === 'workspace'}
            goBack={returnToDashboard}
            transitionProgress={null}
            getAccessToken={getAccessToken}
            updatedBy={updatedBy}
            progressRefreshRequest={progressRefreshRequest}
            progressFocusRequest={progressFocusRequest}
            jobDetailsFocusRequest={jobDetailsFocusRequest}
            onProgressNotificationsAdded={onProgressNotificationsAdded}
            onBriefSaved={onBriefSaved}
            onUpdateJob={onUpdateJob}
            openKml={openKml}
            openCapture={openCapture}
            openTmrFeatureGuide={openTmrFeatureGuide}
            openForms={() => showTab('forms')}
            openJobFiles={() => showTab('files')}
          />
        </HubPane>
      ) : null}

      {visitedTabs.forms ? (
        <HubPane
          tab="forms"
          activeTab={activeTab}
        >
          <HomeScreen
            loading={loading}
            job={job}
            openForm={openForm}
            openWorkspace={() => showTab('workspace')}
            openJobFiles={() => showTab('files')}
            openCapture={openCapture}
          />
        </HubPane>
      ) : null}

      {visitedTabs.files ? (
        <HubPane
          tab="files"
          activeTab={activeTab}
        >
          <JobFilesScreen
            key={`job-files-${job?.number || 'none'}`}
            job={job}
            getAccessToken={getAccessToken}
            onRecentlyOpened={onRecentlyOpened}
            openWorkspace={() => showTab('workspace')}
            openForms={() => showTab('forms')}
            openCapture={openCapture}
            pendingUpload={queuedUpload}
            formLabel={queuedFormLabel}
            onPendingUploadHandled={clearQueuedUpload}
          />
        </HubPane>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  pane: {
    flex: 1,
  },
  paneHidden: { display: 'none' },
});
