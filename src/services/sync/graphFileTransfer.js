import * as FileSystem from 'expo-file-system/legacy';

import { resolveTrustedGraphUrl } from './graphClient';
import {
  buildBearerRequestHeaders,
  sanitiseCallerHeaders,
} from '../security/secureRequestHeaders';
import { isSecureMicrosoftTransferUrl } from '../security/trustedExternalUrl';

export const createAuthenticatedGraphUploadTask = ({
  accessToken,
  urlOrPath,
  fileUri,
  options = {},
  onProgress,
}) => {
  if (!String(fileUri || '').trim()) {
    throw new Error('The local upload file could not be identified.');
  }
  const { headers, ...safeOptions } = options;
  return FileSystem.createUploadTask(
    resolveTrustedGraphUrl(urlOrPath),
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      ...safeOptions,
      headers: buildBearerRequestHeaders({
        accessToken,
        defaults: { Accept: 'application/json' },
        headers,
      }),
    },
    onProgress,
  );
};

export const downloadAuthenticatedGraphFile = ({
  accessToken,
  urlOrPath,
  destination,
  options = {},
}) => {
  if (!String(destination || '').trim()) {
    throw new Error('The local download destination could not be identified.');
  }
  const { headers, ...safeOptions } = options;
  return FileSystem.downloadAsync(
    resolveTrustedGraphUrl(urlOrPath),
    destination,
    {
      ...safeOptions,
      headers: buildBearerRequestHeaders({
        accessToken,
        defaults: { Accept: 'application/json' },
        headers,
      }),
    },
  );
};

// Graph normally supplies a short-lived preauthenticated URL for file bytes.
// Microsoft may introduce new delivery hosts, so an unknown-but-legitimate
// address must not lock users out: fall back to the authenticated /content
// endpoint on graph.microsoft.com. Authentication is never added to the
// preauthenticated URL.
export const downloadMicrosoftGraphFile = async ({
  accessToken,
  graphUrlOrPath,
  preauthenticatedUrl,
  destination,
  options = {},
}) => {
  if (isSecureMicrosoftTransferUrl(preauthenticatedUrl)) {
    if (!String(destination || '').trim()) {
      throw new Error('The local download destination could not be identified.');
    }
    const { headers, ...safeOptions } = options;
    try {
      const directDownload = await FileSystem.downloadAsync(
        preauthenticatedUrl,
        destination,
        {
          ...safeOptions,
          headers: sanitiseCallerHeaders(headers),
        },
      );
      if (directDownload?.status >= 200 && directDownload.status < 300) {
        return directDownload;
      }
    } catch (_error) {
      // The address may have expired between the Graph response and download.
      // Request the same item again through Graph below.
    }
  }

  return downloadAuthenticatedGraphFile({
    accessToken,
    urlOrPath: graphUrlOrPath,
    destination,
    options,
  });
};
