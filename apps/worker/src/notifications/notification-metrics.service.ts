import {
  Redis,
} from 'ioredis';

import {
  getRedisConfig,
} from '@gurusthalam/config';

import {
  GurusthalamLogger,
} from '@gurusthalam/logger';

export interface NotificationMetricSnapshot {
  readonly queued: number;
  readonly processing: number;
  readonly retrying: number;
  readonly sent: number;
  readonly failed: number;
  readonly idempotentHits: number;
  readonly providerErrors: number;
  readonly totalLatencyMs: number;
  readonly latencySamples: number;
  readonly averageLatencyMs: number;
}

export interface NotificationProviderMetricSnapshot {
  readonly provider: string;
  readonly sent: number;
  readonly failed: number;
  readonly retrying: number;
  readonly idempotentHits: number;
  readonly providerErrors: number;
  readonly totalLatencyMs: number;
  readonly latencySamples: number;
  readonly averageLatencyMs: number;
}

const METRIC_NAMES = {
  QUEUED:
    'queued',

  PROCESSING:
    'processing',

  RETRYING:
    'retrying',

  SENT:
    'sent',

  FAILED:
    'failed',

  IDEMPOTENT_HITS:
    'idempotent_hits',

  PROVIDER_ERRORS:
    'provider_errors',

  LATENCY_TOTAL_MS:
    'latency_total_ms',

  LATENCY_SAMPLES:
    'latency_samples',
} as const;

const PROVIDER_METRIC_NAMES = {
  SENT:
    'sent',

  FAILED:
    'failed',

  RETRYING:
    'retrying',

  IDEMPOTENT_HITS:
    'idempotent_hits',

  PROVIDER_ERRORS:
    'provider_errors',

  LATENCY_TOTAL_MS:
    'latency_total_ms',

  LATENCY_SAMPLES:
    'latency_samples',
} as const;

export class NotificationMetricsService {
  private readonly redis:
    Redis;

  private readonly logger:
    GurusthalamLogger;

  private readonly prefix =
    'gurusthalam:metrics:notifications';

  private readonly providerPrefix =
    `${this.prefix}:provider`;

  private writeChain:
    Promise<void> =
    Promise.resolve();

  constructor(
    logger:
      GurusthalamLogger,
  ) {
    this.logger =
      logger;

    const config =
      getRedisConfig();

    this.redis =
      new Redis(
        config.url,
      );

    this.redis.on(
      'error',
      (
        error: Error,
      ) => {
        this.logger.error(
          'Notification metrics Redis error',
          error,
          {
            operation:
              'notification.metrics.redis.error',

            service:
              'notification-metrics',
          },
        );
      },
    );
  }

  /*
   * ---------------------------------------------------------
   * Global metrics
   * ---------------------------------------------------------
   */

  incrementQueued(): void {
    this.enqueueIncrement(
      this.key(
        METRIC_NAMES.QUEUED,
      ),
    );
  }

  incrementProcessing(): void {
    this.enqueueIncrement(
      this.key(
        METRIC_NAMES.PROCESSING,
      ),
    );
  }

  incrementRetrying(): void {
    this.enqueueIncrement(
      this.key(
        METRIC_NAMES.RETRYING,
      ),
    );
  }

  incrementSent(): void {
    this.enqueueIncrement(
      this.key(
        METRIC_NAMES.SENT,
      ),
    );
  }

  incrementFailed(): void {
    this.enqueueIncrement(
      this.key(
        METRIC_NAMES.FAILED,
      ),
    );
  }

  incrementIdempotentHits(): void {
    this.enqueueIncrement(
      this.key(
        METRIC_NAMES.IDEMPOTENT_HITS,
      ),
    );
  }

  incrementProviderErrors(): void {
    this.enqueueIncrement(
      this.key(
        METRIC_NAMES.PROVIDER_ERRORS,
      ),
    );
  }

  /*
   * ---------------------------------------------------------
   * Provider metrics
   * ---------------------------------------------------------
   */

  incrementProviderSent(
    provider: string,
  ): void {
    this.enqueueIncrement(
      this.providerKey(
        provider,
        PROVIDER_METRIC_NAMES.SENT,
      ),
    );
  }

  incrementProviderFailed(
    provider: string,
  ): void {
    this.enqueueIncrement(
      this.providerKey(
        provider,
        PROVIDER_METRIC_NAMES.FAILED,
      ),
    );
  }

  incrementProviderRetrying(
    provider: string,
  ): void {
    this.enqueueIncrement(
      this.providerKey(
        provider,
        PROVIDER_METRIC_NAMES.RETRYING,
      ),
    );
  }

  incrementProviderIdempotentHits(
    provider: string,
  ): void {
    this.enqueueIncrement(
      this.providerKey(
        provider,
        PROVIDER_METRIC_NAMES.IDEMPOTENT_HITS,
      ),
    );
  }

  incrementProviderErrorsFor(
    provider: string,
  ): void {
    this.enqueueIncrement(
      this.providerKey(
        provider,
        PROVIDER_METRIC_NAMES.PROVIDER_ERRORS,
      ),
    );
  }

  /*
   * ---------------------------------------------------------
   * Global latency
   * ---------------------------------------------------------
   */

  recordLatency(
    milliseconds: number,
  ): void {
    if (
      !Number.isFinite(
        milliseconds,
      ) ||
      milliseconds < 0
    ) {
      return;
    }

    const value =
      Math.round(
        milliseconds,
      );

    this.writeChain =
      this.writeChain
        .then(
          async () => {
            await this.redis
              .multi()
              .incrby(
                this.key(
                  METRIC_NAMES.LATENCY_TOTAL_MS,
                ),
                value,
              )
              .incrby(
                this.key(
                  METRIC_NAMES.LATENCY_SAMPLES,
                ),
                1,
              )
              .exec();
          },
        )
        .catch(
          (
            error: unknown,
          ) => {
            this.logger.error(
              'Failed to record notification latency metric',
              error,
              {
                operation:
                  'notification.metrics.latency.error',

                service:
                  'notification-metrics',
              },
            );
          },
        );
  }

  /*
   * ---------------------------------------------------------
   * Provider latency
   * ---------------------------------------------------------
   */

  recordProviderLatency(
    provider: string,
    milliseconds: number,
  ): void {
    if (
      !Number.isFinite(
        milliseconds,
      ) ||
      milliseconds < 0
    ) {
      return;
    }

    const value =
      Math.round(
        milliseconds,
      );

    this.writeChain =
      this.writeChain
        .then(
          async () => {
            await this.redis
              .multi()
              .incrby(
                this.providerKey(
                  provider,
                  PROVIDER_METRIC_NAMES.LATENCY_TOTAL_MS,
                ),
                value,
              )
              .incrby(
                this.providerKey(
                  provider,
                  PROVIDER_METRIC_NAMES.LATENCY_SAMPLES,
                ),
                1,
              )
              .exec();
          },
        )
        .catch(
          (
            error: unknown,
          ) => {
            this.logger.error(
              `Failed to record provider latency metric for "${provider}"`,
              error,
              {
                operation:
                  'notification.metrics.provider.latency.error',

                service:
                  'notification-metrics',
              },
            );
          },
        );
  }

  /*
   * ---------------------------------------------------------
   * Global snapshot
   * ---------------------------------------------------------
   */

  async snapshot():
    Promise<NotificationMetricSnapshot> {
    const keys = [
      METRIC_NAMES.QUEUED,
      METRIC_NAMES.PROCESSING,
      METRIC_NAMES.RETRYING,
      METRIC_NAMES.SENT,
      METRIC_NAMES.FAILED,
      METRIC_NAMES.IDEMPOTENT_HITS,
      METRIC_NAMES.PROVIDER_ERRORS,
      METRIC_NAMES.LATENCY_TOTAL_MS,
      METRIC_NAMES.LATENCY_SAMPLES,
    ];

    const values:
      Array<string | null> =
      await this.redis.mget(
        ...keys.map(
          (
            name,
          ) =>
            this.key(
              name,
            ),
        ),
      );

    const queued =
      this.parseInteger(
        values[0] ??
          null,
      );

    const processing =
      this.parseInteger(
        values[1] ??
          null,
      );

    const retrying =
      this.parseInteger(
        values[2] ??
          null,
      );

    const sent =
      this.parseInteger(
        values[3] ??
          null,
      );

    const failed =
      this.parseInteger(
        values[4] ??
          null,
      );

    const idempotentHits =
      this.parseInteger(
        values[5] ??
          null,
      );

    const providerErrors =
      this.parseInteger(
        values[6] ??
          null,
      );

    const totalLatencyMs =
      this.parseInteger(
        values[7] ??
          null,
      );

    const latencySamples =
      this.parseInteger(
        values[8] ??
          null,
      );

    const averageLatencyMs =
      latencySamples > 0
        ? totalLatencyMs /
          latencySamples
        : 0;

    return {
      queued,
      processing,
      retrying,
      sent,
      failed,
      idempotentHits,
      providerErrors,
      totalLatencyMs,
      latencySamples,
      averageLatencyMs,
    };
  }

  /*
   * ---------------------------------------------------------
   * Provider snapshot
   * ---------------------------------------------------------
   */

  async providerSnapshot(
    provider: string,
  ): Promise<NotificationProviderMetricSnapshot> {
    const keys = [
      PROVIDER_METRIC_NAMES.SENT,
      PROVIDER_METRIC_NAMES.FAILED,
      PROVIDER_METRIC_NAMES.RETRYING,
      PROVIDER_METRIC_NAMES.IDEMPOTENT_HITS,
      PROVIDER_METRIC_NAMES.PROVIDER_ERRORS,
      PROVIDER_METRIC_NAMES.LATENCY_TOTAL_MS,
      PROVIDER_METRIC_NAMES.LATENCY_SAMPLES,
    ];

    const values:
      Array<string | null> =
      await this.redis.mget(
        ...keys.map(
          (
            name,
          ) =>
            this.providerKey(
              provider,
              name,
            ),
        ),
      );

    const sent =
      this.parseInteger(
        values[0] ??
          null,
      );

    const failed =
      this.parseInteger(
        values[1] ??
          null,
      );

    const retrying =
      this.parseInteger(
        values[2] ??
          null,
      );

    const idempotentHits =
      this.parseInteger(
        values[3] ??
          null,
      );

    const providerErrors =
      this.parseInteger(
        values[4] ??
          null,
      );

    const totalLatencyMs =
      this.parseInteger(
        values[5] ??
          null,
      );

    const latencySamples =
      this.parseInteger(
        values[6] ??
          null,
      );

    const averageLatencyMs =
      latencySamples > 0
        ? totalLatencyMs /
          latencySamples
        : 0;

    return {
      provider,

      sent,

      failed,

      retrying,

      idempotentHits,

      providerErrors,

      totalLatencyMs,

      latencySamples,

      averageLatencyMs,
    };
  }

  /*
   * ---------------------------------------------------------
   * Reset
   * ---------------------------------------------------------
   */

  async reset(): Promise<void> {
    const keys =
      Object.values(
        METRIC_NAMES,
      ).map(
        (
          name,
        ) =>
          this.key(
            name,
          ),
      );

    const providerKeys =
      await this.redis.keys(
        `${this.providerPrefix}:*`,
      );

    const allKeys = [
      ...keys,
      ...providerKeys,
    ];

    if (
      allKeys.length ===
      0
    ) {
      return;
    }

    await this.redis.del(
      ...allKeys,
    );
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private enqueueIncrement(
    key: string,
  ): void {
    this.writeChain =
      this.writeChain
        .then(
          async () => {
            await this.redis.incr(
              key,
            );
          },
        )
        .catch(
          (
            error: unknown,
          ) => {
            this.logger.error(
              `Failed to increment notification metric "${key}"`,
              error,
              {
                operation:
                  'notification.metrics.increment.error',

                service:
                  'notification-metrics',
              },
            );
          },
        );
  }

  private key(
    metricName: string,
  ): string {
    return `${this.prefix}:${metricName}`;
  }

  private providerKey(
    provider: string,
    metricName: string,
  ): string {
    const normalizedProvider =
      provider
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9._-]/g,
          '_',
        );

    return `${this.providerPrefix}:${normalizedProvider}:${metricName}`;
  }

  private parseInteger(
    value:
      string | null,
  ): number {
    if (
      value ===
      null
    ) {
      return 0;
    }

    const parsed =
      Number.parseInt(
        value,
        10,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : 0;
  }
}