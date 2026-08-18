import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  Redis,
} from 'ioredis';

import {
  getRedisConfig,
} from '@gurusthalam/config';

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

export interface NotificationOperationalMetrics {
  readonly global: NotificationMetricSnapshot;

  readonly providers:
    readonly NotificationProviderMetricSnapshot[];
}

const GLOBAL_METRIC_NAMES = [
  'queued',
  'processing',
  'retrying',
  'sent',
  'failed',
  'idempotent_hits',
  'provider_errors',
  'latency_total_ms',
  'latency_samples',
] as const;

const PROVIDER_METRIC_NAMES = [
  'sent',
  'failed',
  'retrying',
  'idempotent_hits',
  'provider_errors',
  'latency_total_ms',
  'latency_samples',
] as const;

@Injectable()
export class NotificationMetricsService
  implements OnModuleDestroy
{
  private readonly redis:
    Redis;

  private readonly prefix =
    'gurusthalam:metrics:notifications';

  private readonly providerPrefix =
    `${this.prefix}:provider`;

  constructor() {
    const config =
      getRedisConfig();

    this.redis =
      new Redis(
        config.url,
      );

    this.redis.on(
      'error',
      () => {
        /*
         * Metrics are operational data and must never
         * cause the API process to crash.
         *
         * Redis connection errors are handled by the
         * ioredis client. The metrics service deliberately
         * does not rethrow from the Redis error event.
         */
      },
    );
  }

  async getMetrics():
    Promise<NotificationOperationalMetrics> {
    const global =
      await this.getGlobalMetrics();

    const providers =
      await this.getAllProviderMetrics();

    return {
      global,

      providers,
    };
  }

  async getProviderMetrics(
    provider: string,
  ): Promise<NotificationProviderMetricSnapshot> {
    const normalizedProvider =
      this.normalizeProvider(
        provider,
      );

    const values:
      Array<string | null> =
      await this.redis.mget(
        ...PROVIDER_METRIC_NAMES.map(
          (
            metric,
          ) =>
            this.providerKey(
              normalizedProvider,
              metric,
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
      latencySamples >
      0
        ? totalLatencyMs /
          latencySamples
        : 0;

    return {
      provider:
        normalizedProvider,

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

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async getGlobalMetrics():
    Promise<NotificationMetricSnapshot> {
    const values:
      Array<string | null> =
      await this.redis.mget(
        ...GLOBAL_METRIC_NAMES.map(
          (
            metric,
          ) =>
            `${this.prefix}:${metric}`,
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
      latencySamples >
      0
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

  private async getAllProviderMetrics():
    Promise<
      NotificationProviderMetricSnapshot[]
    > {
    const sentKeys =
      await this.redis.keys(
        `${this.providerPrefix}:*:sent`,
      );

    if (
      sentKeys.length ===
      0
    ) {
      return [];
    }

    const providers =
      Array.from(
        new Set(
          sentKeys
            .map(
              (
                key,
              ) =>
                this.extractProvider(
                  key,
                ),
            )
            .filter(
              (
                provider,
              ): provider is string =>
                provider !==
                null,
            ),
        ),
      ).sort();

    return Promise.all(
      providers.map(
        (
          provider,
        ) =>
          this.getProviderMetrics(
            provider,
          ),
      ),
    );
  }

  private extractProvider(
    key: string,
  ): string | null {
    const prefix =
      `${this.providerPrefix}:`;

    if (
      !key.startsWith(
        prefix,
      )
    ) {
      return null;
    }

    const remainder =
      key.slice(
        prefix.length,
      );

    const separator =
      remainder.lastIndexOf(
        ':',
      );

    if (
      separator <=
      0
    ) {
      return null;
    }

    return remainder.slice(
      0,
      separator,
    );
  }

  private providerKey(
    provider: string,
    metric: string,
  ): string {
    return `${this.providerPrefix}:${provider}:${metric}`;
  }

  private normalizeProvider(
    provider: string,
  ): string {
    return provider
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9._-]/g,
        '_',
      );
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