import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  NotificationTemplateRepository,
  type NotificationTemplateRecord,
} from './notification-template.repository.js';

export interface ResolvedNotificationTemplate {
  readonly templateId: string;

  readonly templateDatabaseId: string;

  readonly version: number;

  readonly locale: string;

  readonly template: NotificationTemplateRecord;

  readonly versionRecord:
    NotificationTemplateRecord['versions'][number];
}

@Injectable()
export class NotificationTemplateResolutionService {
  constructor(
    private readonly repository:
      NotificationTemplateRepository,
  ) {}

  async resolvePublishedVersion(
    templateId: string,

    requestedLocale?: string,
  ): Promise<ResolvedNotificationTemplate> {
    if (
      templateId.trim()
        .length ===
      0
    ) {
      throw new BadRequestException(
        'Notification templateId is required.',
      );
    }

    const template =
      await this.repository.findByTemplateId(
        templateId,
      );

    if (!template) {
      throw new NotFoundException(
        `Notification template ${templateId} was not found.`,
      );
    }

    /*
     * ---------------------------------------------------------
     * Template-level publication gate
     * ---------------------------------------------------------
     *
     * A published version by itself is not sufficient.
     * The parent template must also be PUBLISHED.
     */
    if (
      template.status !==
      'PUBLISHED'
    ) {
      throw new BadRequestException(
        `Notification template ${templateId} is not published.`,
      );
    }

    /*
     * ---------------------------------------------------------
     * Deterministic locale policy
     * ---------------------------------------------------------
     *
     * The current domain model stores one locale on the template.
     * Therefore:
     *
     * - no requested locale -> template locale
     * - supplied locale must exactly match template locale
     *
     * We deliberately do not silently fall back to another locale.
     */
    const locale =
      requestedLocale ??
      template.locale;

    if (
      locale.trim()
        .length ===
      0
    ) {
      throw new BadRequestException(
        `Notification template ${templateId} does not have a valid locale.`,
      );
    }

    if (
      requestedLocale !==
        undefined &&
      requestedLocale !==
        template.locale
    ) {
      throw new NotFoundException(
        `Notification template ${templateId} does not have a published version for locale ${requestedLocale}.`,
      );
    }

    /*
     * ---------------------------------------------------------
     * Current-version gate
     * ---------------------------------------------------------
     */
    if (
      template.currentVersion <=
      0
    ) {
      throw new NotFoundException(
        `Notification template ${templateId} does not have a valid current version.`,
      );
    }

    const versionRecord =
      template.versions.find(
        (
          version,
        ) =>
          version.version ===
          template.currentVersion,
      );

    if (
      !versionRecord
    ) {
      throw new NotFoundException(
        `Current version ${template.currentVersion} for notification template ${templateId} was not found.`,
      );
    }

    /*
     * ---------------------------------------------------------
     * Version-level publication gate
     * ---------------------------------------------------------
     *
     * Even if the parent template says PUBLISHED, the current
     * version must independently be PUBLISHED.
     */
    if (
      versionRecord.status !==
      'PUBLISHED'
    ) {
      throw new BadRequestException(
        `Current version ${template.currentVersion} of notification template ${templateId} is not published.`,
      );
    }

    /*
     * ---------------------------------------------------------
     * Return the resolved immutable selection.
     * ---------------------------------------------------------
     *
     * Callers must render this exact version rather than
     * searching for another version themselves.
     */
    return {
      templateId:
        template.templateId,

      templateDatabaseId:
        template.id,

      version:
        versionRecord.version,

      locale,

      template,

      versionRecord,
    };
  }
}