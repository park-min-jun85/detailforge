import "server-only";
import { IMAGE_MIME_TYPES, MAX_FILE_BYTES, validateFile, validateSignature, type ImageMime } from "@/features/assets/schemas";
import { ImportError } from "./errors";

// Only the explicit binary MIME may be inferred. A declared image MIME must match.
// This is a magic-signature check, not a full image decoder or malware scanner.
export function validateRemoteImage(mime: string, bytes: Uint8Array): ImageMime {
  if (!bytes.byteLength || bytes.byteLength > MAX_FILE_BYTES) throw new ImportError("too_large");
  let actualMime = mime;
  if (mime === "application/octet-stream") {
    const detected = IMAGE_MIME_TYPES.find(candidate => {
      try { validateSignature(bytes, candidate); return true; }
      catch { return false; }
    });
    if (!detected) throw new ImportError("unsupported");
    actualMime = detected;
  }
  try {
    const validated = validateFile(actualMime, bytes.byteLength);
    validateSignature(bytes, validated);
    return validated;
  } catch { throw new ImportError("unsupported"); }
}
