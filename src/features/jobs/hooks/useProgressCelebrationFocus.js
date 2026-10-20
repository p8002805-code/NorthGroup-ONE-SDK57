import { useCallback, useEffect, useRef, useState } from 'react';

import { reportDevelopmentError } from '../../../services/security/securityLogger';
import {
  consumeProgressCelebration,
  peekProgressCelebration,
} from '../progressCompletionService';

export const useProgressCelebrationFocus = ({
  active,
  jobNumber,
  routeRequest,
  scrollRef,
  layoutYRef,
  topInset,
  onExpand,
}) => {
  const timerRef = useRef(null);
  const handledRouteRef = useRef('');
  const [progressFocus, setProgressFocus] = useState(null);
  const [activeCelebration, setActiveCelebration] = useState(null);

  const requestProgressFocus = useCallback((event) => {
    const taskId = String(event?.taskId || event?.progressTaskId || '').trim();
    if (!taskId) return;
    onExpand?.();
    setProgressFocus({
      ...event,
      requestId: String(event?.requestId || event?.eventId || `${taskId}-${Date.now()}`),
      eventId: event?.eventId || event?.progressEventId || '',
      taskId,
      taskName: event?.taskName || event?.progressTaskName || '',
      completed: event?.completed ?? event?.progressCompleted,
      target: event?.target ?? event?.progressTarget,
      unit: event?.unit || event?.progressUnit || '',
      fromRatio: event?.fromRatio ?? event?.progressFromRatio ?? 0,
    });
  }, [onExpand]);

  useEffect(() => {
    let current = true;
    if (!active || !jobNumber) return undefined;

    (async () => {
      const taskId = String(routeRequest?.taskId || '').trim();
      const requestId = String(routeRequest?.requestId || '').trim();
      if (taskId && requestId && handledRouteRef.current === requestId) return;
      const pending = await peekProgressCelebration(jobNumber, taskId);
      if (!current) return;
      if (taskId) {
        handledRouteRef.current = requestId;
        requestProgressFocus({ ...(pending || {}), ...routeRequest });
      } else if (pending) {
        requestProgressFocus(pending);
      }
    })().catch((error) => {
      reportDevelopmentError('Could not prepare the progress celebration', error);
    });

    return () => {
      current = false;
    };
  }, [
    active,
    jobNumber,
    requestProgressFocus,
    routeRequest?.requestId,
    routeRequest?.taskId,
  ]);

  useEffect(() => {
    handledRouteRef.current = '';
    setProgressFocus(null);
    setActiveCelebration(null);
  }, [jobNumber]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleProgressFocusReady = useCallback((celebration) => {
    const targetY = Math.max(0, Number(layoutYRef.current || 0) - topInset - 78);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveCelebration(celebration);
      timerRef.current = null;
    }, 420);
    if (celebration?.eventId) {
      consumeProgressCelebration(celebration.eventId).catch((error) => {
        reportDevelopmentError('Could not finish the progress celebration', error);
      });
    }
  }, [layoutYRef, scrollRef, topInset]);

  const finishProgressCelebration = useCallback(() => {
    setActiveCelebration(null);
    setProgressFocus(null);
  }, []);

  return {
    activeCelebration,
    finishProgressCelebration,
    handleProgressFocusReady,
    progressFocus,
    requestProgressFocus,
  };
};
