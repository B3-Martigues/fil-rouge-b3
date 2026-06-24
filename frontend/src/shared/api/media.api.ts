import {
  createApiError,
  type ApiResult,
} from "./api.types";
import { apiRequest } from "./httpClient";
import { toBackendId } from "./idMapping";
import {
  getDataImageMimeType,
  isDataImageValue,
} from "../utils/imageUpload";

export type MediaEntityType = "organization" | "event";

export type MediaUploadResponse = {
  id: number;
  url: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
};

export type MediaUploadTarget = {
  entityType: MediaEntityType;
  entityId?: number;
  organizationId?: number;
};

const MEDIA_API_ENDPOINTS = {
  upload: "/api/media/upload",
  delete: (mediaId: number) => `/api/media/${toBackendId(mediaId)}`,
  organizationLogo: (organizationId: number) =>
    `/api/organizations/${toBackendId(organizationId)}/logo`,
  eventImage: (eventId: number) => `/api/events/${toBackendId(eventId)}/image`,
} as const;

const dataImageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const dataUrlToBlob = (value: string) => {
  const [metadata = "", payload = ""] = value.split(",");
  const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1] ?? "";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

const appendTarget = (formData: FormData, target: MediaUploadTarget) => {
  formData.append("entity_type", target.entityType);
  if (target.entityId) {
    formData.append("entity_id", String(toBackendId(target.entityId)));
  }
  if (target.organizationId) {
    formData.append("organization_id", String(toBackendId(target.organizationId)));
  }
};

const fileNameForValue = (value: string, fallback: string) => {
  const mimeType = getDataImageMimeType(value);
  const extension = mimeType ? dataImageExtensionByMimeType[mimeType] : null;

  return extension ? `${fallback}.${extension}` : null;
};

export const mediaApi = {
  uploadFile(
    file: File,
    target: MediaUploadTarget,
  ): Promise<ApiResult<MediaUploadResponse>> {
    const formData = new FormData();
    formData.append("image", file);
    appendTarget(formData, target);

    return apiRequest<MediaUploadResponse>(MEDIA_API_ENDPOINTS.upload, {
      body: formData,
      method: "POST",
    });
  },

  uploadImageValue(
    value: string,
    target: MediaUploadTarget,
  ): Promise<ApiResult<MediaUploadResponse>> {
    if (!isDataImageValue(value)) {
      return Promise.resolve(
        createApiError("validation_error", "Le format de l'image est invalide"),
      );
    }

    const fileName = fileNameForValue(value, `${target.entityType}-image`);
    if (!fileName) {
      return Promise.resolve(
        createApiError("validation_error", "Le format de l'image est invalide"),
      );
    }

    const formData = new FormData();
    formData.append("image", dataUrlToBlob(value), fileName);
    appendTarget(formData, target);

    return apiRequest<MediaUploadResponse>(MEDIA_API_ENDPOINTS.upload, {
      body: formData,
      method: "POST",
    });
  },

  replaceOrganizationLogo(
    organizationId: number,
    value: string,
  ): Promise<ApiResult<MediaUploadResponse>> {
    const fileName = fileNameForValue(value, "organization-logo");
    if (!fileName) {
      return Promise.resolve(
        createApiError("validation_error", "Le format du logo est invalide"),
      );
    }

    const formData = new FormData();
    formData.append("image", dataUrlToBlob(value), fileName);

    return apiRequest<MediaUploadResponse>(
      MEDIA_API_ENDPOINTS.organizationLogo(organizationId),
      {
        body: formData,
        method: "POST",
      },
    );
  },

  replaceEventImage(
    eventId: number,
    value: string,
  ): Promise<ApiResult<MediaUploadResponse>> {
    const fileName = fileNameForValue(value, "event-image");
    if (!fileName) {
      return Promise.resolve(
        createApiError("validation_error", "Le format de l'image est invalide"),
      );
    }

    const formData = new FormData();
    formData.append("image", dataUrlToBlob(value), fileName);

    return apiRequest<MediaUploadResponse>(MEDIA_API_ENDPOINTS.eventImage(eventId), {
      body: formData,
      method: "POST",
    });
  },

  remove(mediaId: number): Promise<ApiResult<null>> {
    return apiRequest<null>(MEDIA_API_ENDPOINTS.delete(mediaId), {
      method: "DELETE",
    });
  },
};
