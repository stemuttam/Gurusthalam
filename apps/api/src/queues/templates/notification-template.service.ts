import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  SafeNotificationTemplateRenderer,
  type NotificationTemplateData,
  type NotificationTemplateVersion,
} from '@gurusthalam/shared';

import {
  NotificationTemplateRepository,
  type CreateNotificationTemplateInput,
  type CreateNotificationTemplateVersionInput,
  type NotificationTemplateRecord,
  type NotificationTemplateStatus,
  type NotificationTemplateVariableRecord,
} from './notification-template.repository.js';

@Injectable()
export class NotificationTemplateService {
  constructor(
    private readonly repository:
      NotificationTemplateRepository,

    private readonly renderer:
      SafeNotificationTemplateRenderer,
  ) {}

  async getByTemplateId(
    templateId: string,
  ): Promise<NotificationTemplateRecord> {
    const template =
      await this.repository.findByTemplateId(
        templateId,
      );

    if (!template) {
      throw new NotFoundException(
        `Notification template ${templateId} was not found.`,
      );
    }

    return template;
  }

  async getPublishedVersion(
    templateId: string,
  ) {
    const version =
      await this.repository.findPublishedVersion(
        templateId,
      );

    if (!version) {
      throw new NotFoundException(
        `Published version for notification template ${templateId} was not found.`,
      );
    }

    return version;
  }

  async renderPublishedVersion(
  templateId: string,

  data:
    Record<
      string,
      unknown
    >,

  locale?:
    string,
) {
  const template =
    await this.getByTemplateId(
      templateId,
    );

  const publishedVersion =
    template.versions.find(
      (
        version,
      ) =>
        version.status ===
        'PUBLISHED' &&
        version.version ===
          template.currentVersion,
    );

  if (
    !publishedVersion
  ) {
    throw new NotFoundException(
      `Published version for notification template ${templateId} was not found.`,
    );
  }

  const templateData =
    this.toNotificationTemplateData(
      data,
    );

  const rendered =
    await this.renderer.render({
      template:
        this.toTemplateVersion(
          publishedVersion,
        ),

      data:
        templateData,

      ...(locale !==
      undefined
        ? {
            locale,
          }
        : {}),
    });

  return {
    templateId,

    version:
      publishedVersion.version,

    rendered,

    templateData,
  };
}

  async create(
    input:
      CreateNotificationTemplateInput,
  ) {
    this.validateTemplateIdentity(
      input,
    );

    const existing =
      await this.repository.findByTemplateId(
        input.templateId,
      );

    if (existing) {
      throw new BadRequestException(
        `Notification template ${input.templateId} already exists.`,
      );
    }

    return this.repository.create(
      input,
    );
  }

  async createVersion(
    input:
      CreateNotificationTemplateVersionInput,
  ) {
    const template =
      await this.repository.findByTemplateId(
        input.templateId,
      );

    if (!template) {
      throw new NotFoundException(
        `Notification template ${input.templateId} was not found.`,
      );
    }

    if (
      input.version <=
      0
    ) {
      throw new BadRequestException(
        'Notification template version must be greater than zero.',
      );
    }

    this.validateContent(
      input.body,
      input.subject,
      input.title,
    );

    this.validateVariables(
      input.variables,
    );

    const existingVersion =
      template.versions.find(
        (
          version,
        ) =>
          version.version ===
          input.version,
      );

    if (existingVersion) {
      throw new BadRequestException(
        `Notification template ${input.templateId} version ${input.version} already exists.`,
      );
    }

    return this.repository.createVersion(
      input,
    );
  }

  async validateVersion(
    templateId: string,

    version: number,
  ) {
    const template =
      await this.getByTemplateId(
        templateId,
      );

    const targetVersion =
      template.versions.find(
        (
          item,
        ) =>
          item.version ===
          version,
      );

    if (!targetVersion) {
      throw new NotFoundException(
        `Notification template ${templateId} version ${version} was not found.`,
      );
    }

    return this.renderer.validate(
  {
    template:
      this.toTemplateVersion(
        targetVersion,
      ),

    data:
      {},
  },

  {
    mode:
      'STRUCTURAL',
  },
);
  }

  async previewVersion(
    templateId: string,

    version: number,

    data:
      Record<
        string,
        unknown
      >,

    locale?: string,
  ) {
    const template =
      await this.getByTemplateId(
        templateId,
      );

    const targetVersion =
      template.versions.find(
        (
          item,
        ) =>
          item.version ===
          version,
      );

    if (!targetVersion) {
      throw new NotFoundException(
        `Notification template ${templateId} version ${version} was not found.`,
      );
    }

    const templateData =
      this.toNotificationTemplateData(
        data,
      );

    const result =
      await this.renderer.render({
        template:
          this.toTemplateVersion(
            targetVersion,
          ),

        data:
          templateData,

        ...(locale !==
        undefined
          ? {
              locale,
            }
          : {}),
      });

    return {
      templateId,

      version,

      locale:
        locale ??
        template.locale,

      rendered:
        result,
    };
  }

  async publish(
    templateId: string,

    version: number,
  ) {
    const template =
      await this.getByTemplateId(
        templateId,
      );

    const targetVersion =
      template.versions.find(
        (
          item,
        ) =>
          item.version ===
          version,
      );

    if (!targetVersion) {
      throw new NotFoundException(
        `Notification template ${templateId} version ${version} was not found.`,
      );
    }

    if (
      targetVersion.status ===
      'ARCHIVED'
    ) {
      throw new BadRequestException(
        `Notification template ${templateId} version ${version} is archived.`,
      );
    }

    const validation =
  this.renderer.validate(
    {
      template:
        this.toTemplateVersion(
          targetVersion,
        ),

      data:
        {},
    },

    {
      mode:
        'STRUCTURAL',
    },
  );

    const structuralErrors =
    validation.errors;

    if (
      structuralErrors.length >
      0
    ) {
      throw new BadRequestException({
        message:
          `Notification template ${templateId} version ${version} failed validation.`,

        errors:
          structuralErrors,
      });
    }

    return this.repository.publishVersion(
      templateId,

      version,
    );
  }

  async updateStatus(
    templateId: string,

    status:
      NotificationTemplateStatus,
  ) {
    await this.getByTemplateId(
      templateId,
    );

    return this.repository.updateStatus(
      templateId,

      status,
    );
  }

  /*
   * -----------------------------------------------------------
   * Shared domain mapper
   * -----------------------------------------------------------
   *
   * This is intentionally the only place where the API
   * persistence record is converted into the shared
   * NotificationTemplateVersion contract.
   *
   * Conditional spreads are required because the workspace
   * uses exactOptionalPropertyTypes: true.
   * -----------------------------------------------------------
   */
  private toTemplateVersion(
    version: {
      readonly id:
        string;

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
        readonly NotificationTemplateVariableRecord[];

      readonly status:
        | 'DRAFT'
        | 'REVIEW'
        | 'PUBLISHED'
        | 'ARCHIVED';

      readonly createdBy:
        string;

      readonly createdAt:
        Date;

      readonly publishedAt:
        Date | null;
    },
  ): NotificationTemplateVersion {
    return {
      id:
        version.id,

      templateId:
        version.templateId,

      version:
        version.version,

      ...(version.subject !==
      null
        ? {
            subject:
              version.subject,
          }
        : {}),

      ...(version.title !==
      null
        ? {
            title:
              version.title,
          }
        : {}),

      body:
        version.body,

      variables:
        version.variables,

      status:
        version.status,

      createdBy:
        version.createdBy,

      createdAt:
        version.createdAt,

      ...(version.publishedAt !==
      null
        ? {
            publishedAt:
              version.publishedAt,
          }
        : {}),
    };
  }

  private toNotificationTemplateData(
    data:
      Record<
        string,
        unknown
      >,
  ): NotificationTemplateData {
    return this.toJsonObject(
      data,
    );
  }

  private toJsonObject(
    value:
      Record<
        string,
        unknown
      >,
  ): NotificationTemplateData {
    const output:
      Record<
        string,
        NotificationTemplateData[string]
      > = {};

    for (
      const [
        key,
        item,
      ] of Object.entries(
        value,
      )
    ) {
      output[key] =
        this.toJsonValue(
          item,
        );
    }

    return output;
  }

  private toJsonValue(
    value:
      unknown,
  ):
    | string
    | number
    | boolean
    | null
    | NotificationTemplateData
    | Array<
        string |
        number |
        boolean |
        null |
        NotificationTemplateData
      > {
    if (
      value ===
      null
    ) {
      return null;
    }

    if (
      typeof value ===
        'string' ||
      typeof value ===
        'boolean'
    ) {
      return value;
    }

    if (
      typeof value ===
      'number'
    ) {
      if (
        !Number.isFinite(
          value,
        )
      ) {
        throw new BadRequestException(
          'Template preview data contains a non-finite number.',
        );
      }

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
          this.toJsonValue(
            item,
          ) as
            | string
            | number
            | boolean
            | null
            | NotificationTemplateData,
      );
    }

    if (
      typeof value ===
      'object'
    ) {
      return this.toJsonObject(
        value as Record<
          string,
          unknown
        >,
      );
    }

    throw new BadRequestException(
      `Template preview data contains unsupported value type: ${typeof value}.`,
    );
  }

  private validateTemplateIdentity(
    input:
      CreateNotificationTemplateInput,
  ): void {
    if (
      input.templateId.trim()
        .length ===
      0
    ) {
      throw new BadRequestException(
        'Notification templateId is required.',
      );
    }

    if (
      input.name.trim()
        .length ===
      0
    ) {
      throw new BadRequestException(
        'Notification template name is required.',
      );
    }

    if (
      input.locale.trim()
        .length ===
      0
    ) {
      throw new BadRequestException(
        'Notification template locale is required.',
      );
    }

    if (
      input.createdBy.trim()
        .length ===
      0
    ) {
      throw new BadRequestException(
        'Notification template createdBy is required.',
      );
    }
  }

  private validateContent(
    body:
      string,

    subject?:
      string,

    title?:
      string,
  ): void {
    if (
      body.trim()
        .length ===
      0
    ) {
      throw new BadRequestException(
        'Notification template body cannot be empty.',
      );
    }

    if (
      subject !==
        undefined &&
      subject.trim()
          .length ===
        0
    ) {
      throw new BadRequestException(
        'Notification template subject cannot be empty when supplied.',
      );
    }

    if (
      title !==
        undefined &&
      title.trim()
          .length ===
        0
    ) {
      throw new BadRequestException(
        'Notification template title cannot be empty when supplied.',
      );
    }
  }

  private validateVariables(
    variables:
      readonly NotificationTemplateVariableRecord[],
  ): void {
    const seen =
      new Set<string>();

    for (
      const variable of
        variables
    ) {
      const path =
        variable.path.trim();

      if (
        path.length ===
        0
      ) {
        throw new BadRequestException(
          'Notification template variable path cannot be empty.',
        );
      }

      if (
        seen.has(
          path,
        )
      ) {
        throw new BadRequestException(
          `Notification template variable ${path} is duplicated.`,
        );
      }

      seen.add(
        path,
      );

      if (
        typeof variable.required !==
        'boolean'
      ) {
        throw new BadRequestException(
          `Notification template variable ${path} has an invalid required value.`,
        );
      }
    }
  }
}