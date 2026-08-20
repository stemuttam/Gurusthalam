import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../../database/prisma/prisma.service.js';

export type NotificationTemplateChannel =
  | 'EMAIL'
  | 'IN_APP'
  | 'PUSH';

export type NotificationTemplateStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type NotificationTemplateCategory =
  | 'SYSTEM'
  | 'SECURITY'
  | 'AUTHENTICATION'
  | 'COURSE'
  | 'LEARNING'
  | 'PAYMENT'
  | 'SUBSCRIPTION'
  | 'CERTIFICATE'
  | 'CORPORATE'
  | 'MARKETING'
  | 'REMINDER';

export interface NotificationTemplateVariableRecord {
  readonly path: string;

  readonly required: boolean;

  readonly description?: string;

  readonly type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'object'
    | 'array';
}

export interface NotificationTemplateVersionRecord {
  readonly id: string;

  readonly templateId: string;

  readonly version: number;

  readonly subject: string | null;

  readonly title: string | null;

  readonly body: string;

  readonly variables:
    readonly NotificationTemplateVariableRecord[];

  readonly status:
    NotificationTemplateStatus;

  readonly createdBy: string;

  readonly createdAt: Date;

  readonly publishedAt: Date | null;
}

export interface NotificationTemplateRecord {
  readonly id: string;

  readonly templateId: string;

  readonly name: string;

  readonly description: string | null;

  readonly channel:
    NotificationTemplateChannel;

  readonly category:
    NotificationTemplateCategory;

  readonly locale: string;

  readonly status:
    NotificationTemplateStatus;

  readonly currentVersion: number;

  readonly createdBy: string;

  readonly createdAt: Date;

  readonly updatedAt: Date;

  readonly versions:
    readonly NotificationTemplateVersionRecord[];
}

export interface CreateNotificationTemplateInput {
  readonly templateId: string;

  readonly name: string;

  readonly description?: string;

  readonly channel:
    NotificationTemplateChannel;

  readonly category:
    NotificationTemplateCategory;

  readonly locale: string;

  readonly createdBy: string;
}

export interface CreateNotificationTemplateVersionInput {
  readonly templateId: string;

  readonly version: number;

  readonly subject?: string;

  readonly title?: string;

  readonly body: string;

  readonly variables:
    readonly NotificationTemplateVariableRecord[];

  readonly createdBy: string;
}

/*
 * -------------------------------------------------------------
 * Prisma-compatible JSON value for template variables.
 *
 * `variables` is a required JSON array in the database, so
 * null is intentionally excluded from this type.
 * -------------------------------------------------------------
 */
type PrismaJsonValue =
  | string
  | number
  | boolean
  | PrismaJsonValue[]
  | {
      readonly [key: string]:
        PrismaJsonValue;
    };

@Injectable()
export class NotificationTemplateRepository {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async findByTemplateId(
    templateId: string,
  ): Promise<
    NotificationTemplateRecord | null
  > {
    const template =
      await this.prisma.notificationTemplate.findUnique({
        where: {
          templateId,
        },

        include: {
          versions: {
            orderBy: {
              version:
                'desc',
            },
          },
        },
      });

    if (!template) {
      return null;
    }

    return this.toRecord(
      template,
    );
  }

  async findPublishedVersion(
    templateId: string,
  ): Promise<
    NotificationTemplateVersionRecord | null
  > {
    const version =
      await this.prisma.notificationTemplateVersion.findFirst({
        where: {
          template: {
            templateId,
          },

          status:
            'PUBLISHED',
        },

        orderBy: {
          version:
            'desc',
        },
      });

    if (!version) {
      return null;
    }

    return this.toVersionRecord(
      version,
    );
  }

  async create(
    input:
      CreateNotificationTemplateInput,
  ): Promise<NotificationTemplateRecord> {
    const template =
      await this.prisma.notificationTemplate.create({
        data: {
          templateId:
            input.templateId,

          name:
            input.name,

          description:
            input.description ??
            null,

          channel:
            input.channel,

          category:
            input.category,

          locale:
            input.locale,

          status:
            'DRAFT',

          currentVersion:
            1,

          createdBy:
            input.createdBy,
        },

        include: {
          versions: true,
        },
      });

    return this.toRecord(
      template,
    );
  }

  async createVersion(
    input:
      CreateNotificationTemplateVersionInput,
  ): Promise<NotificationTemplateVersionRecord> {
    const variables =
      this.toPrismaJsonValue(
        input.variables,
      );

    const version =
      await this.prisma.notificationTemplateVersion.create({
        data: {
          template: {
            connect: {
              templateId:
                input.templateId,
            },
          },

          version:
            input.version,

          subject:
            input.subject ??
            null,

          title:
            input.title ??
            null,

          body:
            input.body,

          variables,

          status:
            'DRAFT',

          createdBy:
            input.createdBy,
        },
      });

    return this.toVersionRecord(
      version,
    );
  }

  async updateCurrentVersion(
    templateId: string,

    version: number,
  ): Promise<void> {
    await this.prisma.notificationTemplate.update({
      where: {
        templateId,
      },

      data: {
        currentVersion:
          version,
      },
    });
  }

  async updateStatus(
    templateId: string,

    status:
      NotificationTemplateStatus,
  ): Promise<NotificationTemplateRecord> {
    const template =
      await this.prisma.notificationTemplate.update({
        where: {
          templateId,
        },

        data: {
          status,
        },

        include: {
          versions: {
            orderBy: {
              version:
                'desc',
            },
          },
        },
      });

    return this.toRecord(
      template,
    );
  }

  async publishVersion(
    templateId: string,

    version: number,
  ): Promise<NotificationTemplateRecord> {
    const result =
      await this.prisma.$transaction(
        async (
          tx,
        ) => {
          const template =
            await tx.notificationTemplate.findUniqueOrThrow(
              {
                where: {
                  templateId,
                },

                select: {
                  id: true,
                },
              },
            );

          await tx.notificationTemplateVersion.updateMany({
            where: {
              templateId:
                template.id,

              status:
                'PUBLISHED',
            },

            data: {
              status:
                'ARCHIVED',
            },
          });

          await tx.notificationTemplateVersion.update({
            where: {
              templateId_version: {
                templateId:
                  template.id,

                version,
              },
            },

            data: {
              status:
                'PUBLISHED',

              publishedAt:
                new Date(),
            },
          });

          return tx.notificationTemplate.update({
            where: {
              templateId,
            },

            data: {
              status:
                'PUBLISHED',

              currentVersion:
                version,
            },

            include: {
              versions: {
                orderBy: {
                  version:
                    'desc',
                },
              },
            },
          });
        },
      );

    return this.toRecord(
      result,
    );
  }

  private toRecord(
    template: {
      readonly id: string;

      readonly templateId: string;

      readonly name: string;

      readonly description:
        string | null;

      readonly channel:
        string;

      readonly category:
        string;

      readonly locale: string;

      readonly status:
        string;

      readonly currentVersion:
        number;

      readonly createdBy:
        string;

      readonly createdAt:
        Date;

      readonly updatedAt:
        Date;

      readonly versions:
        readonly {
          readonly id: string;

          readonly templateId:
            string;

          readonly version:
            number;

          readonly subject:
            string | null;

          readonly title:
            string | null;

          readonly body:
            string;

          readonly variables:
            unknown;

          readonly status:
            string;

          readonly createdBy:
            string;

          readonly createdAt:
            Date;

          readonly publishedAt:
            Date | null;
        }[];
    },
  ): NotificationTemplateRecord {
    return {
      id:
        template.id,

      templateId:
        template.templateId,

      name:
        template.name,

      description:
        template.description,

      channel:
        template.channel as
          NotificationTemplateChannel,

      category:
        template.category as
          NotificationTemplateCategory,

      locale:
        template.locale,

      status:
        template.status as
          NotificationTemplateStatus,

      currentVersion:
        template.currentVersion,

      createdBy:
        template.createdBy,

      createdAt:
        template.createdAt,

      updatedAt:
        template.updatedAt,

      versions:
        template.versions.map(
          (
            version,
          ) =>
            this.toVersionRecord(
              version,
            ),
        ),
    };
  }

  private toVersionRecord(
    version: {
      readonly id: string;

      readonly templateId:
        string;

      readonly version:
        number;

      readonly subject:
        string | null;

      readonly title:
        string | null;

      readonly body:
        string;

      readonly variables:
        unknown;

      readonly status:
        string;

      readonly createdBy:
        string;

      readonly createdAt:
        Date;

      readonly publishedAt:
        Date | null;
    },
  ): NotificationTemplateVersionRecord {
    return {
      id:
        version.id,

      templateId:
        version.templateId,

      version:
        version.version,

      subject:
        version.subject,

      title:
        version.title,

      body:
        version.body,

      variables:
        this.parseVariables(
          version.variables,
        ),

      status:
        version.status as
          NotificationTemplateStatus,

      createdBy:
        version.createdBy,

      createdAt:
        version.createdAt,

      publishedAt:
        version.publishedAt,
    };
  }

  private parseVariables(
    value:
      unknown,
  ):
    readonly NotificationTemplateVariableRecord[] {
    if (
      !Array.isArray(
        value,
      )
    ) {
      throw new Error(
        'Notification template variables must be an array.',
      );
    }

    return value.map(
      (
        item,
      ) => {
        if (
          typeof item !==
            'object' ||
          item === null ||
          Array.isArray(
            item,
          )
        ) {
          throw new Error(
            'Notification template variable is invalid.',
          );
        }

        const record =
          item as Record<
            string,
            unknown
          >;

        if (
          typeof record.path !==
            'string' ||
          record.path.trim()
              .length ===
            0
        ) {
          throw new Error(
            'Notification template variable path is invalid.',
          );
        }

        if (
          typeof record.required !==
          'boolean'
        ) {
          throw new Error(
            'Notification template variable required flag is invalid.',
          );
        }

        if (
          typeof record.type !==
            'string' ||
          ![
            'string',
            'number',
            'boolean',
            'object',
            'array',
          ].includes(
            record.type,
          )
        ) {
          throw new Error(
            'Notification template variable type is invalid.',
          );
        }

        return {
          path:
            record.path,

          required:
            record.required,

          ...(typeof record.description ===
          'string'
            ? {
                description:
                  record.description,
              }
            : {}),

          type:
            record.type as
              | 'string'
              | 'number'
              | 'boolean'
              | 'object'
              | 'array',
        };
      },
    );
  }

  private toPrismaJsonValue(
    value:
      unknown,
  ): PrismaJsonValue {
    if (
      typeof value ===
        'string' ||
      typeof value ===
        'number' ||
      typeof value ===
        'boolean'
    ) {
      return value;
    }

    if (
      Array.isArray(
        value,
      )
    ) {
      return value.map(
        (
          item,
        ) =>
          this.toPrismaJsonValue(
            item,
          ),
      );
    }

    if (
      typeof value ===
        'object' &&
      value !==
        null
    ) {
      const input =
        value as Record<
          string,
          unknown
        >;

      const output:
        Record<
          string,
          PrismaJsonValue
        > = {};

      for (
        const [
          key,
          item,
        ] of Object.entries(
          input,
        )
      ) {
        output[key] =
          this.toPrismaJsonValue(
            item,
          );
      }

      return output;
    }

    throw new TypeError(
      `Unsupported notification template JSON value: ${typeof value}`,
    );
  }
}