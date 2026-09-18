/* ============================================================================
   Cloud Messaging — push web para la PWA
   ----------------------------------------------------------------------------
   Flujo:
     1. requestNotificationPermission()  → permiso del navegador
     2. getFcmToken()                    → registra el SW de FCM y pide token
     3. saveFcmToken(uid, token)         → persiste en users/{uid}/fcmTokens
   El SW (public/firebase-messaging-sw.js) recibe la config por querystring
   para no hardcodear claves en un archivo estático.
   ============================================================================ */

import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from 'firebase/messaging';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig, getFirebaseApp, isBrowser, isFirebaseConfigured } from './client';
import { COLLECTIONS, getDb } from './firestore';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** true si este navegador puede recibir push (y hay proyecto configurado). */
export async function isPushSupported(): Promise<boolean> {
  if (!isBrowser() || !isFirebaseConfigured() || !VAPID_KEY) return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  return isSupported();
}

async function getMessagingClient(): Promise<Messaging | null> {
  if (!(await isPushSupported())) return null;
  const app = getFirebaseApp();
  return app ? getMessaging(app) : null;
}

/** Pide permiso de notificaciones al usuario. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowser() || !('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Registra el service worker de FCM pasándole la config por querystring
 * (el archivo estático no puede leer process.env).
 */
async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? '',
    authDomain: firebaseConfig.authDomain ?? '',
    projectId: firebaseConfig.projectId ?? '',
    storageBucket: firebaseConfig.storageBucket ?? '',
    messagingSenderId: firebaseConfig.messagingSenderId ?? '',
    appId: firebaseConfig.appId ?? '',
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
}

/** Obtiene el token FCM del dispositivo (null si no hay permiso/soporte). */
export async function getFcmToken(): Promise<string | null> {
  const messaging = await getMessagingClient();
  if (!messaging) return null;

  const registration = await registerMessagingServiceWorker();
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (error) {
    console.warn('[Castresana] No se pudo obtener el token FCM:', error);
    return null;
  }
}

/**
 * Persiste el token en users/{uid}/fcmTokens/{token}. Documento por token:
 * un usuario puede tener varios dispositivos y así se revocan uno a uno.
 */
export async function saveFcmToken(uid: string, token: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await setDoc(
    doc(db, COLLECTIONS.users, uid, 'fcmTokens', token),
    {
      token,
      userAgent: isBrowser() ? navigator.userAgent : 'unknown',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Mensajes push recibidos con la app en primer plano. */
export async function listenForegroundMessages(
  callback: (payload: MessagePayload) => void,
): Promise<() => void> {
  const messaging = await getMessagingClient();
  if (!messaging) return () => undefined;
  return onMessage(messaging, callback);
}
