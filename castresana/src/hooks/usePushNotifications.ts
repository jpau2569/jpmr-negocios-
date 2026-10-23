'use client';

/**
 * usePushNotifications — activa push web (FCM) para el usuario actual.
 *
 * const { supported, permission, token, enabling, enable } = usePushNotifications();
 * <button onClick={enable} disabled={!supported}>Activar avisos</button>
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getFcmToken,
  isPushSupported,
  requestNotificationPermission,
  saveFcmToken,
} from '@/lib/firebase/messaging';
import { useAuth } from './useAuth';

export interface PushNotificationsState {
  /** El navegador y el proyecto soportan push (FCM + VAPID configurados). */
  supported: boolean;
  permission: NotificationPermission;
  token: string | null;
  enabling: boolean;
  error: string | null;
  /** Pide permiso, obtiene token y lo persiste para el usuario actual. */
  enable: () => Promise<void>;
}

export function usePushNotifications(): PushNotificationsState {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    isPushSupported().then((ok) => {
      if (cancelled) return;
      setSupported(ok);
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!supported || enabling) return;
    setEnabling(true);
    setError(null);
    try {
      const granted = await requestNotificationPermission();
      setPermission(granted);
      if (granted !== 'granted') {
        setError('Permiso de notificaciones denegado.');
        return;
      }

      const fcmToken = await getFcmToken();
      setToken(fcmToken);
      if (!fcmToken) {
        setError('No se pudo obtener el token de notificaciones.');
        return;
      }

      if (user) await saveFcmToken(user.uid, fcmToken);
    } catch (err) {
      console.warn('[Castresana] Error activando push:', err);
      setError('Error activando las notificaciones.');
    } finally {
      setEnabling(false);
    }
  }, [supported, enabling, user]);

  return { supported, permission, token, enabling, error, enable };
}
