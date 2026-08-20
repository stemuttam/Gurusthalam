import {
  NotificationTemplateValidator,
  type NotificationTemplateValidationOptions,
} from './notification-template-validator.js';

import {
  NotificationTemplateVariableExtractor,
} from './notification-template-variable-extractor.js';

import type {
  NotificationTemplateData,
  NotificationTemplateRenderRequest,
  NotificationTemplateValidationResult,
  RenderedNotification,
  NotificationTemplateVariable,
} from './notification-template.types.js';

export interface NotificationTemplateRenderer {
  validate(
    request:
      NotificationTemplateRenderRequest,

    options?:
      NotificationTemplateValidationOptions,
  ): NotificationTemplateValidationResult;

  render(
    request:
      NotificationTemplateRenderRequest,
  ): Promise<RenderedNotification>;
}

export class SafeNotificationTemplateRenderer
  implements NotificationTemplateRenderer {
  private readonly validator =
    new NotificationTemplateValidator();

  private readonly extractor =
    new NotificationTemplateVariableExtractor();

  validate(
    request:
      NotificationTemplateRenderRequest,

    options?:
      NotificationTemplateValidationOptions,
  ): NotificationTemplateValidationResult {
    return this.validator.validate(
      request,

      options,
    );
  }

  async render(
    request:
      NotificationTemplateRenderRequest,
  ): Promise<RenderedNotification> {
    const validation =
      this.validate(
        request,
        {
          mode:
            'RUNTIME',
        },
      );

    if (
      !validation.valid
    ) {
      throw new Error(
        this.createValidationErrorMessage(
          validation,
        ),
      );
    }

    const subject =
      request.template.subject !==
      undefined
        ? this.renderString(
            request.template.subject,
            request.data,
            request.template.variables,
          )
        : undefined;

    const title =
      request.template.title !==
      undefined
        ? this.renderString(
            request.template.title,
            request.data,
            request.template.variables,
          )
        : undefined;

    const body =
      this.renderString(
        request.template.body,
        request.data,
        request.template.variables,
      );

    return {
      ...(subject !==
      undefined
        ? {
            subject,
          }
        : {}),

      ...(title !==
      undefined
        ? {
            title,
          }
        : {}),

      body,
    };
  }

  private renderString(
    template:
      string,

    data:
      NotificationTemplateData,

    declaredVariables:
      readonly NotificationTemplateVariable[],
  ): string {
    const extraction =
      this.extractor.extract(
        template,
      );

    if (
      extraction.invalidExpressions
        .length >
      0
    ) {
      throw new Error(
        `Template contains invalid expressions: ${extraction.invalidExpressions.join(
          ', ',
        )}`,
      );
    }

    return template.replace(
      /{{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*}}/g,
      (
        _match,
        path:
          string,
      ) => {
        const declaration =
          declaredVariables.find(
            (
              variable,
            ) =>
              variable.path ===
              path,
          );

        if (
          !declaration
        ) {
          throw new Error(
            `Template variable "${path}" is not declared.`,
          );
        }

        const value =
          this.getValueAtPath(
            data,
            path,
          );

        if (
          value ===
            undefined ||
          value ===
            null
        ) {
          return '';
        }

        return this.stringifyValue(
          value,
          declaration,
        );
      },
    );
  }

  private getValueAtPath(
    data:
      NotificationTemplateData,

    path:
      string,
  ): unknown {
    const segments =
      path.split(
        '.',
      );

    let current:
      unknown =
      data;

    for (
      const segment of
        segments
    ) {
      if (
        segment ===
          '__proto__' ||
        segment ===
          'prototype' ||
        segment ===
          'constructor'
      ) {
        throw new Error(
          `Unsafe template variable path "${path}".`,
        );
      }

      if (
        typeof current !==
          'object' ||
        current ===
          null ||
        Array.isArray(
          current,
        )
      ) {
        return undefined;
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          current,
          segment,
        )
      ) {
        return undefined;
      }

      current =
        (
          current as Record<
            string,
            unknown
          >
        )[segment];
    }

    return current;
  }

  private stringifyValue(
    value:
      unknown,

    declaration:
      NotificationTemplateVariable,
  ): string {
    switch (
      declaration.type
    ) {
      case 'string':
        if (
          typeof value !==
          'string'
        ) {
          throw new Error(
            `Template variable "${declaration.path}" must be a string.`,
          );
        }

        return value;

      case 'number':
        if (
          typeof value !==
            'number' ||
          !Number.isFinite(
            value,
          )
        ) {
          throw new Error(
            `Template variable "${declaration.path}" must be a finite number.`,
          );
        }

        return String(
          value,
        );

      case 'boolean':
        if (
          typeof value !==
          'boolean'
        ) {
          throw new Error(
            `Template variable "${declaration.path}" must be a boolean.`,
          );
        }

        return String(
          value,
        );

      case 'object':
        if (
          typeof value !==
            'object' ||
          value ===
            null ||
          Array.isArray(
            value,
          )
        ) {
          throw new Error(
            `Template variable "${declaration.path}" must be an object.`,
          );
        }

        return JSON.stringify(
          value,
        );

      case 'array':
        if (
          !Array.isArray(
            value,
          )
        ) {
          throw new Error(
            `Template variable "${declaration.path}" must be an array.`,
          );
        }

        return JSON.stringify(
          value,
        );
    }
  }

  private createValidationErrorMessage(
    validation:
      NotificationTemplateValidationResult,
  ): string {
    const errors =
      validation.errors.map(
        (
          error,
        ) =>
          error.path
            ? `${error.code}: ${error.message} [${error.path}]`
            : `${error.code}: ${error.message}`,
      );

    return (
      'Notification template validation failed: ' +
      errors.join(
        '; ',
      )
    );
  }
}