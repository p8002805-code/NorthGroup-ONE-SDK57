import { useCallback, useEffect, useState } from 'react';

import { listFolderItems, moveJobItem } from '../jobFilesService';

export const useJobFileMove = ({
  currentFolder,
  driveId,
  getAccessToken,
  isActiveJobOperation,
  jobKey,
  rootFolder,
  setItems,
}) => {
  const [request, setRequest] = useState(null);
  const [trail, setTrail] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  const destination = trail[trail.length - 1] || rootFolder || null;

  useEffect(() => {
    setRequest(null);
    setTrail([]);
    setFolders([]);
    setLoading(false);
    setMoving(false);
    setError('');
  }, [jobKey]);

  const loadDestination = useCallback(async (folder, nextTrail, operationJobKey) => {
    if (!driveId || !folder?.id) return;
    setLoading(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      const nextItems = await listFolderItems({
        accessToken,
        driveId,
        folderId: folder.id,
      });
      if (!isActiveJobOperation(operationJobKey)) return;
      setTrail(nextTrail);
      setFolders(nextItems.filter((item) => item.folder));
    } catch (loadError) {
      if (!isActiveJobOperation(operationJobKey)) return;
      setError(loadError?.message || 'This destination could not be opened.');
    } finally {
      if (isActiveJobOperation(operationJobKey)) setLoading(false);
    }
  }, [driveId, getAccessToken, isActiveJobOperation]);

  const open = useCallback((item) => {
    if (!item?.id || !currentFolder?.id || !rootFolder?.id || !driveId) return;
    const nextRequest = { item, sourceParentId: currentFolder.id };
    setRequest(nextRequest);
    setTrail([]);
    setFolders([]);
    setMoving(false);
    setError('');
    loadDestination(rootFolder, [], jobKey);
  }, [currentFolder?.id, driveId, jobKey, loadDestination, rootFolder]);

  const close = useCallback(() => {
    if (moving) return;
    setRequest(null);
    setTrail([]);
    setFolders([]);
    setError('');
  }, [moving]);

  const openFolder = useCallback((folder) => {
    if (!folder?.id || loading || moving) return;
    loadDestination(folder, [...trail, folder], jobKey);
  }, [jobKey, loadDestination, loading, moving, trail]);

  const goBack = useCallback(() => {
    if (!trail.length || loading || moving || !rootFolder) return;
    const nextTrail = trail.slice(0, -1);
    const parent = nextTrail[nextTrail.length - 1] || rootFolder;
    loadDestination(parent, nextTrail, jobKey);
  }, [jobKey, loadDestination, loading, moving, rootFolder, trail]);

  const moveHere = useCallback(async () => {
    if (!request?.item?.id || !destination?.id || !driveId || moving) return;
    if (destination.id === request.sourceParentId) return;
    const operationJobKey = jobKey;
    try {
      setMoving(true);
      setError('');
      const accessToken = await getAccessToken();
      await moveJobItem({
        accessToken,
        driveId,
        itemId: request.item.id,
        destinationFolderId: destination.id,
      });
      if (!isActiveJobOperation(operationJobKey)) return;
      setItems((current) => current.filter((item) => item.id !== request.item.id));
      setRequest(null);
      setTrail([]);
      setFolders([]);
    } catch (moveError) {
      if (!isActiveJobOperation(operationJobKey)) return;
      setError(moveError?.message || 'This item could not be moved.');
    } finally {
      if (isActiveJobOperation(operationJobKey)) setMoving(false);
    }
  }, [destination?.id, driveId, getAccessToken, isActiveJobOperation, jobKey, moving, request, setItems]);

  return {
    close,
    destination,
    error,
    folders,
    goBack,
    loading,
    moveHere,
    moving,
    open,
    openFolder,
    request,
    trail,
  };
};
