export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
  timestamp: string;
};

export type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
  timestamp: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type DeviceClass = "mobile" | "tablet" | "desktop" | "tv";
export type NetworkType = "wifi" | "cellular" | "ethernet" | "unknown";
