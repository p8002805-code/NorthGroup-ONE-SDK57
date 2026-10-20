import { useCallback, useEffect, useRef, useState } from 'react';

export const useJobDetailsHubDisclosure = ({
  active,
  jobNumber,
  focusRequest,
  heroHeight,
  topInset,
  scrollRef,
}) => {
  const lastFocusRequestRef = useRef('');
  const [expanded, setExpanded] = useState(false);
  const [layoutY, setLayoutY] = useState(0);

  const setDisclosure = useCallback((nextExpanded) => {
    setExpanded(nextExpanded);
  }, []);

  const toggle = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  const onLayout = useCallback(({ nativeEvent }) => {
    setLayoutY(heroHeight + Number(nativeEvent.layout?.y || 0));
  }, [heroHeight]);

  useEffect(() => {
    if (active) return;
    setDisclosure(false);
  }, [active, setDisclosure]);

  useEffect(() => {
    const requestId = String(focusRequest?.requestId || '').trim();
    if (!active || !requestId || requestId === lastFocusRequestRef.current) return;
    lastFocusRequestRef.current = requestId;
    setDisclosure(true);
  }, [active, focusRequest?.requestId, setDisclosure]);

  useEffect(() => {
    const requestId = String(focusRequest?.requestId || '').trim();
    if (!active || !requestId || layoutY <= 0) return;
    const targetY = Math.max(0, layoutY - topInset);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: targetY, animated: true }));
  }, [active, focusRequest?.requestId, layoutY, scrollRef, topInset]);

  useEffect(() => {
    lastFocusRequestRef.current = '';
    setLayoutY(0);
    setDisclosure(false);
  }, [jobNumber, setDisclosure]);

  return { expanded, toggle, onLayout };
};
