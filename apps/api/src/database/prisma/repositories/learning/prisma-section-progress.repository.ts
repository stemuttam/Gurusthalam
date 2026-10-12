import { SectionProgress } from '@gurusthalam/learning';

import type {
  SectionProgressEvent,
  SectionProgressProps,
  SectionProgressRepository,
} from '@gurusthalam/learning';

import type { Prisma, PrismaClient } from '@gurusthalam/database';

import { withPrismaRepositoryErrorBoundary } from '../prisma-repository-error.mapper.js';

export class PrismaSectionProgressRepository implements SectionProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<SectionProgress | null> {
    return withPrismaRepositoryErrorBoundary(
      'SectionProgressRepository.findById',
      async () => {
        const record = await this.prisma.sectionProgress.findUnique({
          where: {
            id,
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  async findByEnrollmentAndSection(
    enrollmentId: string,
    sectionId: string,
  ): Promise<SectionProgress | null> {
    return withPrismaRepositoryErrorBoundary(
      'SectionProgressRepository.findByEnrollmentAndSection',
      async () => {
        const record = await this.prisma.sectionProgress.findUnique({
          where: {
            enrollmentId_sectionId: {
              enrollmentId,
              sectionId,
            },
          },
        });

        return record === null ? null : this.toDomain(record);
      },
    );
  }

  async save(sectionProgress: SectionProgress): Promise<void> {
    await withPrismaRepositoryErrorBoundary(
      'SectionProgressRepository.save',
      async () => {
        const persistence = this.toPersistence(sectionProgress);

        /*
         * Non-destructive snapshot.
         *
         * Events are drained only after the complete transaction
         * successfully commits.
         */
        const pendingEvents = sectionProgress.getDomainEvents();

        await this.prisma.$transaction(async (transaction) => {
          await transaction.sectionProgress.upsert({
            where: {
              id: persistence.id,
            },

            create: {
              id: persistence.id,
              enrollmentId: persistence.enrollmentId,
              sectionId: persistence.sectionId,
              status: persistence.status,
              percentage: persistence.percentage,
              startedAt: persistence.startedAt,
              completedAt: persistence.completedAt,
              createdAt: persistence.createdAt,
              updatedAt: persistence.updatedAt,
            },

            update: {
              enrollmentId: persistence.enrollmentId,
              sectionId: persistence.sectionId,
              status: persistence.status,
              percentage: persistence.percentage,
              startedAt: persistence.startedAt,
              completedAt: persistence.completedAt,
              updatedAt: persistence.updatedAt,
            },
          });

          for (const event of pendingEvents) {
            await transaction.outboxEvent.create({
              data: {
                eventType: event.eventName,
                aggregateType: 'SectionProgress',
                aggregateId: event.aggregateId,
                dedupeKey: PrismaSectionProgressRepository.toDedupeKey(event),
                payload: PrismaSectionProgressRepository.toOutboxPayload(event),
                status: 'PENDING',
                attempts: 0,
                availableAt: new Date(),
              },
            });
          }
        });

        /*
         * Commit succeeded.
         *
         * Only now is event consumption safe.
         */
        if (pendingEvents.length > 0) {
          sectionProgress.pullDomainEvents();
        }
      },
    );
  }

  private toDomain(record: SectionProgressPersistenceRecord): SectionProgress {
    return SectionProgress.rehydrate({
      id: record.id,
      enrollmentId: record.enrollmentId,
      sectionId: record.sectionId,
      status: record.status,
      percentage: record.percentage,
      startedAt: record.startedAt === null ? null : new Date(record.startedAt),
      completedAt:
        record.completedAt === null ? null : new Date(record.completedAt),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  private toPersistence(
    sectionProgress: SectionProgress,
  ): SectionProgressProps {
    return sectionProgress.toPrimitives();
  }

  private static toDedupeKey(event: SectionProgressEvent): string {
    return `learning.section.progress:${event.eventId}`;
  }

  private static toOutboxPayload(
    event: SectionProgressEvent,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify({
        eventId: event.eventId,
        eventName: event.eventName,
        eventVersion: event.eventVersion,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt,
        payload: event.payload,
      }),
    ) as Prisma.InputJsonValue;
  }
}

type SectionProgressPersistenceRecord = SectionProgressProps;
