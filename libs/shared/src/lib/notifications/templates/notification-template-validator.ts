import {
  NotificationTemplateVariableExtractor,
} from './notification-template-variable-extractor.js';

import type {
  NotificationTemplateRenderRequest,
  NotificationTemplateValidationError,
  NotificationTemplateValidationResult,
  NotificationTemplateValidationWarning,
  NotificationTemplateVariable,
} from './notification-template.types.js';

export type NotificationTemplateValidationMode =
  | 'STRUCTURAL'
  | 'RUNTIME';

export interface NotificationTemplateValidationOptions {
  readonly mode?:
    NotificationTemplateValidationMode;
}

export class NotificationTemplateValidator {
  private readonly extractor =
    new NotificationTemplateVariableExtractor();

  validate(
    request:
      NotificationTemplateRenderRequest,

    options:
      NotificationTemplateValidationOptions = {},
  ): NotificationTemplateValidationResult {
    const mode =
      options.mode ??
      'RUNTIME';

    const errors:
      NotificationTemplateValidationError[] =
      [];

    const warnings:
      NotificationTemplateValidationWarning[] =
      [];

    /*
     * ---------------------------------------------------------
     * Basic template content validation
     * ---------------------------------------------------------
     */
    if (
      request.template.body.trim()
        .length ===
      0
    ) {
      errors.push({
        code:
          'EMPTY_BODY',

        message:
          'Notification template body cannot be empty.',
      });
    }

    /*
     * ---------------------------------------------------------
     * Locale validation
     * ---------------------------------------------------------
     */
    if (
      request.locale !==
        undefined &&
      !this.isValidLocale(
        request.locale,
      )
    ) {
      errors.push({
        code:
          'INVALID_LOCALE',

        message:
          `Notification template locale "${request.locale}" is invalid.`,

        path:
          'locale',
      });
    }

    /*
     * ---------------------------------------------------------
     * Extract all variables referenced by the template.
     * ---------------------------------------------------------
     */
    const sourceFields =
      this.getTemplateFields(
        request,
      );

    const extractedPaths =
      new Set<string>();

    for (
      const field of
        sourceFields
    ) {
      const extraction =
        this.extractor.extract(
          field.value,
        );

      for (
        const variable of
          extraction.variables
      ) {
        extractedPaths.add(
          variable.path,
        );
      }

      for (
        const invalidExpression of
          extraction.invalidExpressions
      ) {
        errors.push({
          code:
            'INVALID_SYNTAX',

          message:
            `Invalid template expression "${invalidExpression}".`,

          path:
            field.name,
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * Validate declared variables.
     * ---------------------------------------------------------
     */
    const declaredVariables =
      new Map<
        string,
        NotificationTemplateVariable
      >();

    for (
      const variable of
        request.template.variables
    ) {
      const path =
        variable.path.trim();

      if (
        !this.extractor.isValidPath(
          path,
        )
      ) {
        errors.push({
          code:
            'INVALID_VARIABLE',

          message:
            `Template variable "${path}" has an invalid path.`,

          path,
        });

        continue;
      }

      if (
        this.containsUnsafePath(
          path,
        )
      ) {
        errors.push({
          code:
            'INVALID_VARIABLE',

          message:
            `Template variable "${path}" contains an unsafe property path.`,

          path,
        });

        continue;
      }

      if (
        declaredVariables.has(
          path,
        )
      ) {
        errors.push({
          code:
            'INVALID_VARIABLE',

          message:
            `Template variable "${path}" is declared more than once.`,

          path,
        });

        continue;
      }

      declaredVariables.set(
        path,
        variable,
      );
    }

    /*
     * ---------------------------------------------------------
     * Every referenced variable must be declared.
     * ---------------------------------------------------------
     */
    for (
      const path of
        extractedPaths
    ) {
      if (
        !declaredVariables.has(
          path,
        )
      ) {
        errors.push({
          code:
            'UNSUPPORTED_VARIABLE',

          message:
            `Template references undeclared variable "${path}".`,

          path,
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * Runtime validation is ONLY performed when explicitly
     * requested.
     *
     * STRUCTURAL mode deliberately does not inspect runtime
     * data. This is what makes /validate appropriate for
     * validating a template definition before publication.
     * ---------------------------------------------------------
     */
    if (
      mode ===
      'RUNTIME'
    ) {
      for (
        const variable of
          request.template.variables
      ) {
        const path =
          variable.path.trim();

        if (
          !declaredVariables.has(
            path,
          )
        ) {
          continue;
        }

        const exists =
          this.hasValueAtPath(
            request.data,
            path,
          );

        if (
          !exists
        ) {
          if (
            variable.required
          ) {
            errors.push({
              code:
                'MISSING_REQUIRED_VARIABLE',

              message:
                `Required template variable "${path}" is missing.`,

              path,
            });
          } else {
            warnings.push({
              code:
                'OPTIONAL_VARIABLE',

              message:
                `Optional template variable "${path}" is not present.`,

              path,
            });
          }

          continue;
        }

        const value =
          this.getValueAtPath(
            request.data,
            path,
          );

        if (
          !this.matchesExpectedType(
            value,
            variable.type,
          )
        ) {
          errors.push({
            code:
              'INVALID_VARIABLE',

            message:
              `Template variable "${path}" has an invalid runtime type.`,

            path,
          });
        }
      }
    }

    /*
     * ---------------------------------------------------------
     * Unused-variable warnings are structural and therefore
     * apply to both validation modes.
     * ---------------------------------------------------------
     */
    for (
      const variable of
        request.template.variables
    ) {
      if (
        !extractedPaths.has(
          variable.path,
        )
      ) {
        warnings.push({
          code:
            'UNUSED_VARIABLE',

          message:
            `Template variable "${variable.path}" is declared but not used.`,

          path:
            variable.path,
        });
      }
    }

    return {
      valid:
        errors.length ===
        0,

      errors,

      warnings,
    };
  }

  private getTemplateFields(
    request:
      NotificationTemplateRenderRequest,
  ): readonly {
    name:
      string;

    value:
      string;
  }[] {
    const fields: {
      name:
        string;

      value:
        string;
    }[] = [
      {
        name:
          'body',

        value:
          request.template.body,
      },
    ];

    if (
      request.template.subject !==
      undefined
    ) {
      fields.push({
        name:
          'subject',

        value:
          request.template.subject,
      });
    }

    if (
      request.template.title !==
      undefined
    ) {
      fields.push({
        name:
          'title',

        value:
          request.template.title,
      });
    }

    return fields;
  }

  private isValidLocale(
    locale:
      string,
  ): boolean {
    return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(
      locale,
    );
  }

  private containsUnsafePath(
    path:
      string,
  ): boolean {
    const unsafeSegments =
      new Set([
        '__proto__',
        'prototype',
        'constructor',
      ]);

    return path
      .split('.')
      .some(
        (
          segment,
        ) =>
          unsafeSegments.has(
            segment,
          ),
      );
  }

  private hasValueAtPath(
    data:
      Record<
        string,
        unknown
      >,

    path:
      string,
  ): boolean {
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
        typeof current !==
          'object' ||
        current ===
          null ||
        Array.isArray(
          current,
        )
      ) {
        return false;
      }

      const record =
        current as Record<
          string,
          unknown
        >;

      if (
        !Object.prototype.hasOwnProperty.call(
          record,
          segment,
        )
      ) {
        return false;
      }

      current =
        record[segment];
    }

    return true;
  }

  private getValueAtPath(
    data:
      Record<
        string,
        unknown
      >,

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

  private matchesExpectedType(
    value:
      unknown,

    expected:
      NotificationTemplateVariable['type'],
  ): boolean {
    switch (
      expected
    ) {
      case 'string':
        return (
          typeof value ===
          'string'
        );

      case 'number':
        return (
          typeof value ===
            'number' &&
          Number.isFinite(
            value,
          )
        );

      case 'boolean':
        return (
          typeof value ===
          'boolean'
        );

      case 'array':
        return Array.isArray(
          value,
        );

      case 'object':
        return (
          typeof value ===
            'object' &&
          value !==
            null &&
          !Array.isArray(
            value,
          )
        );
    }
  }
}