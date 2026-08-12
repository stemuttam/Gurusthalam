export interface ApiMeta {
  readonly requestId?: string;
  readonly timestamp: string;
  readonly version: string;
}

export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: ApiMeta;
}

export interface ApiErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly ApiErrorDetail[];
  };
  readonly meta: ApiMeta;
}

export type ApiResponse<T> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse;