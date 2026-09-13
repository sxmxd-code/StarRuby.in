// ==============================================================================
// StarRuby.in Banking System — Cloudflare R2 Object Storage Service
// Uses AWS S3 SDK with transparent mock fallback for local instant testing.
// ==============================================================================

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = import.meta.env.VITE_CLOUDFLARE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = import.meta.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = import.meta.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'documents';
const R2_PUBLIC_DOMAIN = import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN || '';

const isR2Configured = Boolean(
  R2_ACCOUNT_ID &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY &&
  !R2_ACCESS_KEY_ID.includes('PASTE_YOUR')
);

let s3Client: S3Client | null = null;
if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Local mock storage store for offline/local development without cloud credentials
const localMockBlobStore = new Map<string, { dataUrl: string; size: number; type: string }>();

export interface UploadResult {
  bucket: string;
  objectKey: string;
  publicUrl?: string;
  sizeBytes: number;
  isLiveCloud: boolean;
  cloudError?: string;
}

/**
 * Uploads file to Cloudflare R2 or local mock storage
 */
export async function uploadToR2(
  file: File,
  prefix: 'documents' | 'statements',
  identifier: string
): Promise<UploadResult> {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `${prefix}/${identifier}/${timestamp}/${safeFilename}`;

  let cloudError: string | undefined;

  if (isR2Configured && s3Client) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: objectKey,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || 'application/octet-stream',
      });
      await s3Client.send(command);

      const publicUrl = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${objectKey}` : undefined;

      return {
        bucket: R2_BUCKET,
        objectKey,
        publicUrl,
        sizeBytes: file.size,
        isLiveCloud: true,
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || err?.name === 'TypeError') {
        cloudError = 'CORS Blocked: Please add CORS policy to "documents" bucket in Cloudflare dashboard.';
      } else {
        cloudError = `Cloudflare R2 Error: ${msg}`;
      }
      console.error('Cloudflare R2 Upload Failed:', cloudError, err);
    }
  }

  // Fallback: Read as data URL for instant preview and browser storage
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      localMockBlobStore.set(objectKey, {
        dataUrl,
        size: file.size,
        type: file.type,
      });

      resolve({
        bucket: R2_BUCKET,
        objectKey,
        publicUrl: dataUrl,
        sizeBytes: file.size,
        isLiveCloud: false,
        cloudError: cloudError || (!isR2Configured ? 'R2 credentials missing' : undefined),
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generates a presigned download URL for an R2 object or returns local mock URL
 */
export async function getR2DownloadUrl(bucket: string, objectKey: string): Promise<string> {
  if (isR2Configured && s3Client) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      });
      return await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 mins
    } catch (err) {
      console.error('Failed to generate presigned R2 URL:', err);
    }
  }

  const localItem = localMockBlobStore.get(objectKey);
  if (localItem) {
    return localItem.dataUrl;
  }

  return '#';
}
