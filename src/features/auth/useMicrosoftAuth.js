import { useCallback, useEffect, useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  MICROSOFT_CLIENT_ID,
  MICROSOFT_DISCOVERY,
  MICROSOFT_GRAPH_ME,
  MICROSOFT_REDIRECT_URI,
  MICROSOFT_SCOPES,
} from './microsoftConfig';
import {
  downloadMicrosoftProfilePhoto,
  readCachedMicrosoftProfilePhoto,
} from '../account/microsoftProfilePhoto';

WebBrowser.maybeCompleteAuthSession();

const SESSION_KEY = 'northgroup_microsoft_session_v1';
const EXPIRY_MARGIN_SECONDS = 120;
const SCOPE_FINGERPRINT = MICROSOFT_SCOPES.join(' ');

const expiresAt = (token) => (
  Number(token?.issuedAt || Math.floor(Date.now() / 1000))
  + Number(token?.expiresIn || 0)
);

const readMicrosoftProfile = async (accessToken) => {
  const response = await fetch(
    `${MICROSOFT_GRAPH_ME}?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,officeLocation`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error(`Microsoft Graph profile request failed (${response.status}).`);
  }

  const user = await response.json();
  return {
    id: user.id,
    displayName: user.displayName || '',
    firstName: user.givenName || '',
    lastName: user.surname || '',
    email: user.mail || user.userPrincipalName || '',
    role: user.jobTitle || '',
    office: user.officeLocation || '',
  };
};

const saveSession = async (session) => {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
};

export default function useMicrosoftAuth() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [profilePhotoUri, setProfilePhotoUri] = useState('');
  const [profilePhotoRevision, setProfilePhotoRevision] = useState(0);
  const [profilePhotoLoading, setProfilePhotoLoading] = useState(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: MICROSOFT_CLIENT_ID,
      responseType: AuthSession.ResponseType.Code,
      redirectUri: MICROSOFT_REDIRECT_URI,
      scopes: MICROSOFT_SCOPES,
      usePKCE: true,
      prompt: AuthSession.Prompt.SelectAccount,
    },
    MICROSOFT_DISCOVERY,
  );



  const refreshSession = useCallback(async (current) => {
    if (!current?.refreshToken) throw new Error('Your Microsoft session has expired.');

    const token = await AuthSession.refreshAsync(
      {
        clientId: MICROSOFT_CLIENT_ID,
        refreshToken: current.refreshToken,
        scopes: MICROSOFT_SCOPES,
      },
      MICROSOFT_DISCOVERY,
    );

    const next = {
      ...current,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken || current.refreshToken,
      issuedAt: token.issuedAt,
      expiresIn: token.expiresIn,
      scopeFingerprint: SCOPE_FINGERPRINT,
    };
    await saveSession(next);
    return next;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(SESSION_KEY);
        if (!saved) return;
        let restored = JSON.parse(saved);
        const now = Math.floor(Date.now() / 1000);
        if (
          expiresAt(restored) <= now + EXPIRY_MARGIN_SECONDS
          || restored.scopeFingerprint !== SCOPE_FINGERPRINT
        ) {
          restored = await refreshSession(restored);
        }
        if (mounted) setSession(restored);
      } catch {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!response) return;

    if (response.type === 'cancel' || response.type === 'dismiss') {
      setBusy(false);
      return;
    }

    if (response.type !== 'success') {
      setBusy(false);
      setError(response.error?.message || 'Microsoft sign-in was not completed.');
      return;
    }

    (async () => {
      try {
        if (!request?.codeVerifier) throw new Error('The secure sign-in verifier is unavailable.');
        const token = await AuthSession.exchangeCodeAsync(
          {
            clientId: MICROSOFT_CLIENT_ID,
            code: response.params.code,
            redirectUri: MICROSOFT_REDIRECT_URI,
            extraParams: { code_verifier: request.codeVerifier },
          },
          MICROSOFT_DISCOVERY,
        );
        const user = await readMicrosoftProfile(token.accessToken);
        const next = {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          issuedAt: token.issuedAt,
          expiresIn: token.expiresIn,
          scopeFingerprint: SCOPE_FINGERPRINT,
          user,
        };
        await saveSession(next);
        setSession(next);
        setError('');
      } catch (authError) {
        setError(authError?.message || 'NorthGroup One could not complete Microsoft sign-in.');
      } finally {
        setBusy(false);
        setReady(true);
      }
    })();
  }, [request, response]);

  const signIn = useCallback(async () => {
    if (!request || busy) return;
    setError('');
    setBusy(true);
    try {
      await promptAsync();
    } catch (authError) {
      setBusy(false);
      setError(authError?.message || 'Microsoft sign-in could not be opened.');
    }
  }, [busy, promptAsync, request]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
    setError('');
  }, []);

  const getAccessToken = useCallback(async () => {
    if (!session) throw new Error('Sign in with Microsoft before refreshing Teams jobs.');
    const now = Math.floor(Date.now() / 1000);
    if (
      expiresAt(session) > now + EXPIRY_MARGIN_SECONDS
      && session.scopeFingerprint === SCOPE_FINGERPRINT
    ) {
      return session.accessToken;
    }
    const refreshed = await refreshSession(session);
    setSession(refreshed);
    return refreshed.accessToken;
  }, [refreshSession, session]);

  const refreshProfilePhoto = useCallback(async ({ quiet = false } = {}) => {
    const accountId = session?.user?.id;
    if (!accountId) return '';
    if (!quiet) setProfilePhotoLoading(true);

    try {
      const accessToken = await getAccessToken();
      const uri = await downloadMicrosoftProfilePhoto({
        accessToken,
        accountId,
      });
      setProfilePhotoUri(uri);
      setProfilePhotoRevision((current) => current + 1);
      return uri;
    } finally {
      if (!quiet) setProfilePhotoLoading(false);
    }
  }, [getAccessToken, session?.user?.id]);

  useEffect(() => {
    let mounted = true;
    const accountId = session?.user?.id;

    if (!accountId) {
      setProfilePhotoUri('');
      return () => {
        mounted = false;
      };
    }

    (async () => {
      const cached = await readCachedMicrosoftProfilePhoto(accountId);
      if (mounted && cached) {
        setProfilePhotoUri(cached);
        setProfilePhotoRevision((current) => current + 1);
      }

      try {
        const uri = await refreshProfilePhoto({ quiet: true });
        if (mounted) setProfilePhotoUri(uri);
      } catch {
        // Initials remain available when Microsoft has no photo or the device is offline.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshProfilePhoto, session?.user?.id]);

  const getJobChatAccessToken = useCallback(async () => {
    if (!session) throw new Error('Sign in with Microsoft before opening Job Chat.');

    // Chat permissions are included in the primary Microsoft sign-in scopes.
    // Reuse the same refreshed access token instead of opening a second login.
    return getAccessToken();
  }, [getAccessToken, session]);

  return useMemo(() => ({
    ready,
    busy,
    error,
    account: session?.user || null,
    profilePhotoUri,
    profilePhotoRevision,
    profilePhotoLoading,
    getAccessToken,
    getJobChatAccessToken,
    refreshProfilePhoto,
    signIn,
    signOut,
  }), [
    busy,
    error,
    getAccessToken,
    getJobChatAccessToken,
    profilePhotoLoading,
    profilePhotoUri,
    profilePhotoRevision,
    ready,
    refreshProfilePhoto,
    session,
    signIn,
    signOut,
  ]);
}
