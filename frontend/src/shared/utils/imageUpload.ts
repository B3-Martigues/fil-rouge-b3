export const IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";
export const IMAGE_UPLOAD_MAX_BYTES = 1024 * 1024;
export const IMAGE_UPLOAD_MAX_LABEL = "1 Mo";
export const IMAGE_UPLOAD_HELPER_TEXT = `PNG, JPG ou WebP, ${IMAGE_UPLOAD_MAX_LABEL} max.`;

const acceptedImageTypes = new Set(IMAGE_UPLOAD_ACCEPT.split(","));
const dataImagePattern = /^data:(image\/(?:jpeg|png|webp));base64,[a-zA-Z0-9+/]+={0,2}$/;
const uploadedImagePathPattern =
  /^\/uploads\/(?:events|organizations|scraped-events)\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp)$/;

export const isAcceptedImageType = (type: string) => acceptedImageTypes.has(type);

export const isAcceptedImageFile = (file: File) =>
  isAcceptedImageType(file.type) && file.size <= IMAGE_UPLOAD_MAX_BYTES;

export const isValidUploadedImageValue = (value: string) => {
  const trimmedValue = value.trim();
  if (uploadedImagePathPattern.test(trimmedValue)) return true;
  if (!dataImagePattern.test(trimmedValue)) return false;

  const [, payload = ""] = trimmedValue.split(",");
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const approximateBytes = Math.floor((payload.length * 3) / 4) - padding;

  return approximateBytes > 0 && approximateBytes <= IMAGE_UPLOAD_MAX_BYTES;
};

const isValidRemoteImageUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue || /\s/.test(trimmedValue)) return false;
  if (/\.svg(?:[?#]|$)/i.test(trimmedValue)) return false;

  try {
    const url = new URL(trimmedValue);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const isValidImageReferenceValue = (value: string) =>
  isValidUploadedImageValue(value) || isValidRemoteImageUrl(value);

export const isValidEventImageValue = isValidImageReferenceValue;

export const isDataImageValue = (value: string) =>
  dataImagePattern.test(value.trim());

export const getDataImageMimeType = (value: string) =>
  value.trim().match(dataImagePattern)?.[1] ?? null;

export const getImageUploadError = (file: File) => {
  if (!isAcceptedImageType(file.type)) {
    return "Format invalide. Choisissez une image PNG, JPG ou WebP.";
  }

  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return `Image trop lourde. La taille maximale est de ${IMAGE_UPLOAD_MAX_LABEL}.`;
  }

  return null;
};
