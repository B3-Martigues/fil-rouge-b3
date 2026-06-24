import { useCallback, useState } from "react";

import type { ApiResult } from "../api/api.types";
import {
  mediaApi,
  type MediaUploadResponse,
  type MediaUploadTarget,
} from "../api/media.api";

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (
      file: File,
      target: MediaUploadTarget,
    ): Promise<ApiResult<MediaUploadResponse>> => {
      setIsUploading(true);
      setError(null);
      const result = await mediaApi.uploadFile(file, target);
      setIsUploading(false);
      if (!result.ok) {
        setError(result.error.message);
      }
      return result;
    },
    [],
  );

  return {
    error,
    isUploading,
    uploadFile,
  };
}
