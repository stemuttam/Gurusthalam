import {
  NotificationFailureClassification,
} from './notification-provider-result.types.js';

export type NotificationProviderFailureMode =
  | 'disabled'
  | 'success'
  | 'retryable'
  | 'rate_limited'
  | 'non_retryable'
  | 'permanent';

export interface NotificationProviderFailureSimulationConfig {
  readonly mode:
    NotificationProviderFailureMode;

  readonly retryAfterMs:
    number;

  readonly errorCode:
    string;

  readonly errorMessage:
    string;
}

const DEFAULT_RETRY_AFTER_MS =
  10_000;

const DEFAULT_ERROR_CODE =
  'SIMULATED_PROVIDER_FAILURE';

const DEFAULT_ERROR_MESSAGE =
  'Notification provider failure was simulated for testing.';

const ALLOWED_MODES:
  ReadonlySet<
    NotificationProviderFailureMode
  > =
  new Set([
    'disabled',
    'success',
    'retryable',
    'rate_limited',
    'non_retryable',
    'permanent',
  ]);

function normalizeMode(
  value:
    string | undefined,
):
  NotificationProviderFailureMode {
  if (
    value &&
    ALLOWED_MODES.has(
      value as NotificationProviderFailureMode,
    )
  ) {
    return value as NotificationProviderFailureMode;
  }

  return 'disabled';
}

function normalizeRetryAfterMs(
  value:
    string | undefined,
):
  number {
  const parsed =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <
      0
  ) {
    return DEFAULT_RETRY_AFTER_MS;
  }

  return Math.floor(
    parsed,
  );
}

export class NotificationProviderFailureSimulator {
  private readonly config:
    NotificationProviderFailureSimulationConfig;

  constructor(
    config:
      Partial<NotificationProviderFailureSimulationConfig> = {},
  ) {
    const configuredMode =
      config.mode ??
      normalizeMode(
        process.env.NOTIFICATION_PROVIDER_FAILURE_MODE,
      );

    const configuredRetryAfterMs =
      config.retryAfterMs ??
      normalizeRetryAfterMs(
        process.env.NOTIFICATION_PROVIDER_RETRY_AFTER_MS,
      );

    const configuredErrorCode =
      config.errorCode ??
      process.env.NOTIFICATION_PROVIDER_FAILURE_CODE ??
      DEFAULT_ERROR_CODE;

    const configuredErrorMessage =
      config.errorMessage ??
      process.env.NOTIFICATION_PROVIDER_FAILURE_MESSAGE ??
      DEFAULT_ERROR_MESSAGE;

    this.config = {
      mode:
        configuredMode,

      retryAfterMs:
        configuredRetryAfterMs,

      errorCode:
        configuredErrorCode,

      errorMessage:
        configuredErrorMessage,
    };
  }

  get mode():
    NotificationProviderFailureMode {
    return this.config.mode;
  }

  isEnabled():
    boolean {
    return (
      this.config.mode !==
      'disabled' &&
      this.config.mode !==
      'success'
    );
  }

  simulate(
    provider:
      string,

    channel:
      string,

    notificationId:
      string,
  ):
    {
      readonly accepted: boolean;
      readonly provider: string;
      readonly channel: string;
      readonly notificationId: string;
      readonly classification: NotificationFailureClassification;
      readonly errorCode?: string;
      readonly errorMessage?: string;
      readonly retryAfterMs?: number;
    } | null {
    switch (
      this.config.mode
    ) {
      case 'disabled':
      case 'success':
        return null;

      case 'retryable':
        return {
          accepted:
            false,

          provider,

          channel,

          notificationId,

          classification:
            NotificationFailureClassification.RETRYABLE,

          errorCode:
            this.config.errorCode,

          errorMessage:
            this.config.errorMessage,
        };

      case 'rate_limited':
        return {
          accepted:
            false,

          provider,

          channel,

          notificationId,

          classification:
            NotificationFailureClassification.RATE_LIMITED,

          errorCode:
            this.config.errorCode,

          errorMessage:
            this.config.errorMessage,

          retryAfterMs:
            this.config.retryAfterMs,
        };

      case 'non_retryable':
        return {
          accepted:
            false,

          provider,

          channel,

          notificationId,

          classification:
            NotificationFailureClassification.NON_RETRYABLE,

          errorCode:
            this.config.errorCode,

          errorMessage:
            this.config.errorMessage,
        };

      case 'permanent':
        return {
          accepted:
            false,

          provider,

          channel,

          notificationId,

          classification:
            NotificationFailureClassification.PERMANENT,

          errorCode:
            this.config.errorCode,

          errorMessage:
            this.config.errorMessage,
        };
    }
  }
}