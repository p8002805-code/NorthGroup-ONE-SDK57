import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { prepareSE14DayUpload } from '../se14DailyUpload';

const EMPTY_PREPARATION = Object.freeze({
  visible: false,
  dayKey: '',
  folderName: '',
  progress: 0,
  status: '',
  detail: '',
});

const nextPaint = () => new Promise((resolve) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => resolve());
    return;
  }
  setTimeout(resolve, 0);
});

const shortPause = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const preparationStatus = ({ phase, current, total }) => {
  if (phase === 'checking') return 'Checking saved sessions…';
  if (phase === 'prepared') return `${current} of ${total} PDFs ready`;
  if (phase === 'ready') return 'All session PDFs are ready';
  return `Preparing PDF ${current} of ${total}…`;
};

export const useSE14DayPreparation = ({
  initials = '',
  onReady,
  recordTitle,
}) => {
  const activeDayRef = useRef('');
  const [preparation, setPreparation] = useState(EMPTY_PREPARATION);

  const uploadArchivedDay = useCallback(async (group) => {
    if (!group || activeDayRef.current) return;

    activeDayRef.current = group.key;
    setPreparation({
      visible: true,
      dayKey: group.key,
      folderName: group.folderName,
      progress: 0.03,
      status: 'Starting saved batch preparation…',
      detail: `${group.pendingCount || group.records?.length || 0} saved session PDFs will be prepared before SharePoint opens.`,
    });
    await nextPaint();

    try {
      const result = await prepareSE14DayUpload({
        group,
        initials,
        onProgress: async (update) => {
          setPreparation({
            visible: true,
            dayKey: group.key,
            folderName: group.folderName,
            progress: update.progress,
            status: preparationStatus(update),
            detail: update.record
              ? recordTitle?.(update.record) || update.record.name || 'GNSS session'
              : 'Confirming every saved session is complete and ready.',
          });
          await nextPaint();
        },
      });

      if (result.state === 'empty') {
        Alert.alert('Batch already uploaded', `${group.folderName} has no session files waiting for SharePoint.`);
      } else if (result.state === 'incomplete') {
        Alert.alert('Session needs attention', `${recordTitle?.(result.record) || 'This session'} cannot be uploaded yet. ${result.issue.message}`);
      } else if (typeof onReady === 'function') {
        setPreparation((current) => ({
          ...current,
          progress: 1,
          status: 'Opening SharePoint Job Files…',
          detail: 'The PDFs are ready. Next, choose where this saved session batch should be uploaded.',
        }));
        await shortPause(350);
        setPreparation(EMPTY_PREPARATION);
        await nextPaint();
        onReady(result.payload);
      } else {
        throw new Error('SharePoint Job Files could not be opened.');
      }
    } catch (error) {
      Alert.alert('Could not prepare this batch', String(error?.message || error));
    } finally {
      activeDayRef.current = '';
      setPreparation(EMPTY_PREPARATION);
    }
  }, [initials, onReady, recordTitle]);

  return {
    preparation,
    uploadingDayKey: preparation.dayKey,
    uploadArchivedDay,
  };
};
