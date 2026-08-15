/* ============================================================================
   Storage — estructura de archivos del proyecto
   ----------------------------------------------------------------------------
   Rutas convenidas (los path builders son la única fuente de verdad):

     properties/{propertyId}/images/{fileName}     fotos del inmueble
     properties/{propertyId}/docs/{fileName}       dossier, nota simple, CEE…
     properties/{propertyId}/videos/{fileName}     tours y reels
     leads/{leadId}/docs/{fileName}                documentación del lead
     agents/{agentId}/avatar.jpg                   avatar del agente

   En esta fase no se suben archivos reales; los helpers dejan la API lista
   para conectar la galería y el dossier cuando toque.
   ============================================================================ */

import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
  type StorageReference,
  type UploadResult,
} from 'firebase/storage';
import { getFirebaseApp } from './client';

/** Storage del proyecto, o null en modo demo. */
export function getStorageClient(): FirebaseStorage | null {
  const app = getFirebaseApp();
  return app ? getStorage(app) : null;
}

/* -------------------------------------------------------------- Path builders */

export const storagePaths = {
  propertyImage: (propertyId: string, fileName: string) =>
    `properties/${propertyId}/images/${fileName}`,
  propertyDoc: (propertyId: string, fileName: string) =>
    `properties/${propertyId}/docs/${fileName}`,
  propertyVideo: (propertyId: string, fileName: string) =>
    `properties/${propertyId}/videos/${fileName}`,
  leadDoc: (leadId: string, fileName: string) => `leads/${leadId}/docs/${fileName}`,
  agentAvatar: (agentId: string) => `agents/${agentId}/avatar.jpg`,
} as const;

function storageRef(path: string): StorageReference {
  const storage = getStorageClient();
  if (!storage) throw new Error('Storage no está configurado (modo demo).');
  return ref(storage, path);
}

/** Sube un archivo a una ruta convenida y devuelve el resultado. */
export async function uploadFile(path: string, file: Blob | Uint8Array): Promise<UploadResult> {
  return uploadBytes(storageRef(path), file);
}

/** URL pública de descarga de un archivo ya subido. */
export async function fileUrl(path: string): Promise<string> {
  return getDownloadURL(storageRef(path));
}
