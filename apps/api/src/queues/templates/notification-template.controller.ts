import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import {
  NotificationTemplateService,
} from './notification-template.service.js';

import type {
  NotificationTemplateCategory,
  NotificationTemplateChannel,
  NotificationTemplateStatus,
} from './notification-template.repository.js';

interface CreateTemplateRequest {
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

interface CreateVersionRequest {
  readonly version: number;

  readonly subject?: string;

  readonly title?: string;

  readonly body: string;

  readonly variables: readonly {
    readonly path: string;

    readonly required: boolean;

    readonly description?: string;

    readonly type:
      | 'string'
      | 'number'
      | 'boolean'
      | 'object'
      | 'array';
  }[];

  readonly createdBy: string;
}

interface PreviewRequest {
  readonly version: number;

  readonly data: Record<
    string,
    unknown
  >;

  readonly locale?: string;
}

@Controller(
  'internal/notification-templates',
)
export class NotificationTemplateController {
  constructor(
    private readonly service:
      NotificationTemplateService,
  ) {}

  @Post()
  async create(
    @Body()
    body:
      CreateTemplateRequest,
  ) {
    return this.service.create(
      body,
    );
  }

  @Get(
    ':templateId',
  )
  async get(
    @Param('templateId')
    templateId: string,
  ) {
    return this.service.getByTemplateId(
      templateId,
    );
  }

  @Post(
    ':templateId/versions',
  )
  async createVersion(
    @Param('templateId')
    templateId: string,

    @Body()
    body:
      CreateVersionRequest,
  ) {
    if (
      body.version <=
      0
    ) {
      throw new BadRequestException(
        'Version must be greater than zero.',
      );
    }

    if (
      !Array.isArray(
        body.variables,
      )
    ) {
      throw new BadRequestException(
        'Variables must be an array.',
      );
    }

    return this.service.createVersion({
  templateId,

  version:
    body.version,

  body:
    body.body,

  variables:
    body.variables,

  createdBy:
    body.createdBy,

  ...(body.subject !==
  undefined
    ? {
        subject:
          body.subject,
      }
    : {}),

  ...(body.title !==
  undefined
    ? {
        title:
          body.title,
      }
    : {}),
});
  }

  @Post(
    ':templateId/validate',
  )
  async validate(
    @Param('templateId')
    templateId: string,

    @Body()
    body: {
      readonly version: number;
    },
  ) {
    return this.service.validateVersion(
      templateId,
      body.version,
    );
  }

  @Post(
    ':templateId/preview',
  )
  async preview(
    @Param('templateId')
    templateId: string,

    @Body()
    body:
      PreviewRequest,
  ) {
    return this.service.previewVersion(
      templateId,
      body.version,
      body.data,
      body.locale,
    );
  }

  @Post(
    ':templateId/versions/:version/publish',
  )
  async publish(
    @Param('templateId')
    templateId: string,

    @Param('version')
    version:
      string,
  ) {
    const parsedVersion =
      Number.parseInt(
        version,
        10,
      );

    if (
      !Number.isInteger(
        parsedVersion,
      ) ||
      parsedVersion <=
        0
    ) {
      throw new BadRequestException(
        'Version must be a positive integer.',
      );
    }

    return this.service.publish(
      templateId,
      parsedVersion,
    );
  }

  @Post(
    ':templateId/archive',
  )
  async archive(
    @Param('templateId')
    templateId: string,
  ) {
    return this.service.updateStatus(
      templateId,
      'ARCHIVED',
    );
  }

  @Patch(
    ':templateId/status',
  )
  async updateStatus(
    @Param('templateId')
    templateId: string,

    @Body()
    body: {
      readonly status:
        NotificationTemplateStatus;
    },
  ) {
    return this.service.updateStatus(
      templateId,
      body.status,
    );
  }
}