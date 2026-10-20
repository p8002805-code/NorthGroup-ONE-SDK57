import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { reportDevelopmentError } from '../../../services/security/securityLogger';
import {
  assignedTeamJobSignature,
  isAssignedTeamCacheFresh,
  peekCachedAssignedTeam,
  readCachedAssignedTeam,
  writeCachedAssignedTeam,
} from '../assignedTeamCache';
import { loadJobShiftMembers } from '../teamsShiftsService';

const emptyAssignedTeam = () => ({
  count: 0,
  members: [],
  loading: false,
  loaded: false,
  resolved: false,
  error: '',
});

const assignedTeamFromCache = (cache) => cache ? ({
  count: cache.userIds.length,
  members: cache.members,
  loading: false,
  loaded: true,
  resolved: cache.directoryMembersResolved,
  error: cache.directoryError || '',
}) : emptyAssignedTeam();

export const useAssignedTeam = ({ active, job, getAccessToken }) => {
  const requestRef = useRef(0);
  const hydratedKeyRef = useRef('');
  const assignedTeamKey = assignedTeamJobSignature(job);
  const assignedTeamJob = useMemo(() => ({
    number: job?.number,
    microsoftTeamIds: Array.isArray(job?.microsoftTeamIds)
      ? [...job.microsoftTeamIds]
      : [],
  }), [assignedTeamKey]);
  const hasTeamsJob = Boolean(
    assignedTeamJob.number && assignedTeamJob.microsoftTeamIds.length,
  );
  const [assignedTeam, setAssignedTeam] = useState(() => (
    assignedTeamFromCache(peekCachedAssignedTeam({ job: assignedTeamJob }))
  ));

  const loadAssignedTeam = useCallback(async ({ background = false } = {}) => {
    if (!hasTeamsJob || typeof getAccessToken !== 'function') return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setAssignedTeam((current) => ({
      ...current,
      loading: background ? false : true,
      error: background ? current.error : '',
    }));

    try {
      const accessToken = await getAccessToken();
      const assignment = await loadJobShiftMembers({ accessToken, job: assignedTeamJob });
      if (requestRef.current !== requestId) return;

      setAssignedTeam({
        count: assignment.userIds.length,
        members: assignment.members,
        loading: false,
        loaded: true,
        resolved: assignment.directoryMembersResolved,
        error: assignment.directoryError || '',
      });
      writeCachedAssignedTeam({ job: assignedTeamJob, assignment }).catch((cacheError) => {
        reportDevelopmentError('Could not cache the assigned job team', cacheError);
      });
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setAssignedTeam((current) => ({
        ...current,
        loading: false,
        loaded: current.loaded || !background,
        resolved: current.loaded ? current.resolved : false,
        error: background && current.loaded
          ? current.error
          : error?.message || 'The assigned team could not be loaded.',
      }));
    }
  }, [assignedTeamJob, getAccessToken, hasTeamsJob]);

  useEffect(() => {
    requestRef.current += 1;
    hydratedKeyRef.current = '';
    setAssignedTeam(assignedTeamFromCache(
      peekCachedAssignedTeam({ job: assignedTeamJob }),
    ));
  }, [assignedTeamJob]);

  useEffect(() => {
    if (!active || !hasTeamsJob) return;
    if (hydratedKeyRef.current === assignedTeamKey) return;
    hydratedKeyRef.current = assignedTeamKey;
    const hydrationRequestId = requestRef.current + 1;
    requestRef.current = hydrationRequestId;

    const hydrateAssignedTeam = async () => {
      const memoryValue = peekCachedAssignedTeam({ job: assignedTeamJob });
      const cached = memoryValue || await readCachedAssignedTeam({ job: assignedTeamJob });
      if (requestRef.current !== hydrationRequestId) return;

      if (cached) {
        setAssignedTeam(assignedTeamFromCache(cached));
        if (!isAssignedTeamCacheFresh(cached)) {
          loadAssignedTeam({ background: true });
        }
        return;
      }

      loadAssignedTeam();
    };

    hydrateAssignedTeam().catch(() => {
      if (requestRef.current === hydrationRequestId) loadAssignedTeam();
    });
  }, [active, assignedTeamJob, assignedTeamKey, hasTeamsJob, loadAssignedTeam]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const refreshAssignedTeam = useCallback(() => loadAssignedTeam(), [loadAssignedTeam]);

  return {
    assignedTeam,
    hasTeamsJob,
    refreshAssignedTeam,
  };
};
