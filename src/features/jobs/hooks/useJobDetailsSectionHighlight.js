import { useEffect, useRef, useState } from 'react';

export const useJobDetailsSectionHighlight = ({
  active,
  expanded,
  focusRequest,
  manifestReady,
  activeSections,
  jobNumber,
}) => {
  const focusTimerRef = useRef(null);
  const lastFocusRequestRef = useRef('');
  const [highlightedSectionId, setHighlightedSectionId] = useState('');

  useEffect(() => {
    const requestId = String(focusRequest?.requestId || '').trim();
    const sectionId = String(focusRequest?.sectionId || '').trim().toLowerCase();
    if (!expanded || !manifestReady || !requestId || !sectionId) return undefined;
    if (requestId === lastFocusRequestRef.current) return undefined;

    const matchingSection = activeSections.find((section) => (
      String(section?.id || '').trim().toLowerCase() === sectionId
    ));
    if (!matchingSection) return undefined;

    lastFocusRequestRef.current = requestId;
    setHighlightedSectionId(matchingSection.id);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      setHighlightedSectionId('');
      focusTimerRef.current = null;
    }, 2400);

    return () => {
      if (!focusTimerRef.current) return;
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    };
  }, [activeSections, expanded, focusRequest?.requestId, focusRequest?.sectionId, manifestReady]);

  useEffect(() => {
    if (active) return;
    setHighlightedSectionId('');
  }, [active]);

  useEffect(() => {
    lastFocusRequestRef.current = '';
    setHighlightedSectionId('');
  }, [jobNumber]);

  return highlightedSectionId;
};
