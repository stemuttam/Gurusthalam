import type {
  NotificationTemplateVariable,
} from './notification-template.types.js';

const VARIABLE_PATTERN =
  /{{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*}}/g;

const ANY_EXPRESSION_PATTERN =
  /{{\s*([^{}]+?)\s*}}/g;

export interface ExtractedTemplateVariable {
  readonly path:
    string;

  readonly occurrences:
    number;

  readonly positions:
    readonly number[];
}

export interface TemplateVariableExtractionResult {
  readonly variables:
    readonly ExtractedTemplateVariable[];

  readonly invalidExpressions:
    readonly string[];
}

export class NotificationTemplateVariableExtractor {
  extract(
    template:
      string,
  ): TemplateVariableExtractionResult {
    const variables =
      new Map<
        string,
        {
          occurrences:
            number;

          positions:
            number[];
        }
      >();

    const invalidExpressions:
      string[] =
      [];

    /*
     * Detect all {{...}} expressions first so unsupported
     * expression syntax is not silently ignored.
     */
    for (
      const match of template.matchAll(
        ANY_EXPRESSION_PATTERN,
      )
    ) {
      const expression =
        match[1]?.trim();

      if (
        !expression
      ) {
        invalidExpressions.push(
          expression ??
            '',
        );

        continue;
      }

      if (
        !this.isValidPath(
          expression,
        )
      ) {
        invalidExpressions.push(
          expression,
        );
      }
    }

    /*
     * Extract valid variable references.
     */
    for (
      const match of template.matchAll(
        VARIABLE_PATTERN,
      )
    ) {
      const path =
        match[1]?.trim();

      if (
        !path
      ) {
        continue;
      }

      const position =
        match.index ??
        0;

      const existing =
        variables.get(
          path,
        );

      if (
        existing
      ) {
        existing.occurrences +=
          1;

        existing.positions.push(
          position,
        );
      } else {
        variables.set(
          path,
          {
            occurrences:
              1,

            positions:
              [
                position,
              ],
          },
        );
      }
    }

    return {
      variables:
        Array.from(
          variables.entries(),
        )
          .map(
            (
              [
                path,
                metadata,
              ],
            ) => ({
              path,

              occurrences:
                metadata.occurrences,

              positions:
                metadata.positions,
            }),
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.path.localeCompare(
                right.path,
              ),
          ),

      invalidExpressions:
        Array.from(
          new Set(
            invalidExpressions,
          ),
        ).sort(),
    };
  }

  extractPaths(
    template:
      string,
  ): readonly string[] {
    return this.extract(
      template,
    ).variables.map(
      (
        variable,
      ) =>
        variable.path,
    );
  }

  matchesDeclaredVariable(
    path:
      string,

    declaredVariables:
      readonly NotificationTemplateVariable[],
  ): boolean {
    return declaredVariables.some(
      (
        variable,
      ) =>
        variable.path ===
        path,
    );
  }

  isValidPath(
    path:
      string,
  ): boolean {
    const segments =
      path.split(
        '.',
      );

    if (
      segments.length ===
      0
    ) {
      return false;
    }

    return segments.every(
      (
        segment,
      ) =>
        /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(
          segment,
        ),
    );
  }
}