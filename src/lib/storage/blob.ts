// lib/storage/blob.ts — upload images to the Azure Storage static website ($web)
// via the Blob REST API + container SAS (no SDK). Returns public URLs.

import "server-only";
import { randomUUID } from "node:crypto";

const SAS = process.env.ANUNCIO_BLOB_SAS;
const BLOB = process.env.ANUNCIO_BLOB_ENDPOINT;
const WEB = process.env.ANUNCIO_WEB_ENDPOINT;

export function blobConfigured(): boolean {
  return Boolean(SAS && BLOB && WEB);
}

/** Upload image data URLs; returns the public URLs (skips any that fail). */
export async function uploadImageDataUrls(dataUrls: string[]): Promise<string[]> {
  if (!blobConfigured()) return [];
  const folder = randomUUID();
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrls[i] ?? "");
    if (!m) continue;
    const ct = m[1];
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const name = `cars/${folder}/${i}.${ext}`;
    try {
      const res = await fetch(`${BLOB!.replace(/\/$/, "")}/$web/${name}?${SAS}`, {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "x-ms-blob-content-type": ct, "x-ms-blob-cache-control": "public, max-age=31536000" },
        body: Buffer.from(m[2], "base64"),
      });
      if (res.ok) urls.push(`${WEB!.replace(/\/$/, "")}/${name}`);
    } catch { /* skip this image */ }
  }
  return urls;
}
