import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function resolveDesignSystemRoot(): string {
  const candidates = [
    resolve(process.cwd(), 'libs/design-system/src'),
    resolve(process.cwd(), '../design-system/src'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to locate libs/design-system/src from the current working directory.',
  );
}

const designSystemRoot: string = resolveDesignSystemRoot();

function readDesignSystemFile(path: string): string {
  return readFileSync(resolve(designSystemRoot, path), 'utf8');
}

function getCssVariable(source: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const expression = new RegExp(
    `${escapedName}\\s*:\\s*(#[\\da-fA-F]{3,8})\\s*;`,
  );

  const match = source.match(expression);
  const value = match?.[1];

  if (value === undefined) {
    throw new Error(
      `CSS variable ${name} was not found or has an invalid value.`,
    );
  }

  return value;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');

  if (![3, 6].includes(normalized.length)) {
    throw new Error(`Unsupported hex color: ${hex}`);
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalized;

  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

function linearizeChannel(value: number): number {
  const normalized = value / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex);

  return (
    0.2126 * linearizeChannel(red) +
    0.7152 * linearizeChannel(green) +
    0.0722 * linearizeChannel(blue)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);

  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design system accessibility regression', () => {
  const accessibilityCss = readDesignSystemFile(
    'foundations/accessibility.css',
  );

  const selectionCss = readDesignSystemFile('components/selection.css');

  const componentsCss = readDesignSystemFile('components/components.css');

  const colorsCss = readDesignSystemFile('tokens/colors.css');

  const lightThemeCss = readDesignSystemFile('themes/light.css');

  const darkThemeCss = readDesignSystemFile('themes/dark.css');

  it('provides a visible global keyboard focus indicator', () => {
    expect(accessibilityCss).toMatch(
      /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--gt-focus\)/s,
    );

    expect(accessibilityCss).toMatch(
      /:focus-visible\s*\{[^}]*outline-offset:\s*3px/s,
    );
  });

  it('provides a forced-colors focus indicator', () => {
    expect(accessibilityCss).toMatch(/@media\s*\(forced-colors:\s*active\)/);

    expect(accessibilityCss).toMatch(
      /:focus-visible\s*\{[^}]*outline:\s*3px solid Highlight/s,
    );
  });

  it('provides a visible focus indicator for the custom switch track', () => {
    expect(selectionCss).toMatch(
      /\.gt-switch__input:focus-visible\s*\+\s*\.gt-switch__track/,
    );

    expect(accessibilityCss).toMatch(
      /\.gt-switch__input:focus-visible\s*\+\s*\.gt-switch__track\s*\{[^}]*Highlight/s,
    );
  });

  it('does not override form-control focus with a weak custom shadow', () => {
    const focusRule = componentsCss.match(
      /\.gt-input:focus-visible[\s\S]*?\n\}/,
    );

    expect(focusRule).toBeNull();
  });

  it('uses a contrast-compliant accent button background', () => {
    const foreground = '#ffffff';

    const defaultBackground = getCssVariable(colorsCss, '--gt-accent-700');

    const hoverBackground = getCssVariable(colorsCss, '--gt-accent-800');

    expect(contrastRatio(foreground, defaultBackground)).toBeGreaterThanOrEqual(
      4.5,
    );

    expect(contrastRatio(foreground, hoverBackground)).toBeGreaterThanOrEqual(
      4.5,
    );

    expect(componentsCss).toMatch(
      /\.gt-button--accent\s*\{[^}]*background:\s*var\(--gt-accent-700\)/s,
    );

    expect(componentsCss).toMatch(
      /\.gt-button--accent:hover:not\(:disabled\)\s*\{[^}]*background:\s*var\(--gt-accent-800\)/s,
    );
  });

  it('keeps the original accent token available for other components', () => {
    expect(colorsCss).toMatch(/--gt-accent-600:\s*#0d9488\s*;/);
  });

  it.each([
    ['success', '--gt-success-700', '--gt-success-50', '--gt-success-100'],
    ['warning', '--gt-warning-700', '--gt-warning-50', '--gt-warning-100'],
    ['danger', '--gt-danger-700', '--gt-danger-50', '--gt-danger-100'],
    ['info', '--gt-info-700', '--gt-info-50', '--gt-info-100'],
  ])(
    'keeps light-theme %s semantic text contrast at WCAG AA',
    (_name, foregroundToken, background50Token, background100Token) => {
      const foreground = getCssVariable(colorsCss, foregroundToken);

      const background50 = getCssVariable(colorsCss, background50Token);

      const background100 = getCssVariable(colorsCss, background100Token);

      expect(
        contrastRatio(foreground, background50),
        `${foregroundToken} against ${background50Token}`,
      ).toBeGreaterThanOrEqual(4.5);

      expect(
        contrastRatio(foreground, background100),
        `${foregroundToken} against ${background100Token}`,
      ).toBeGreaterThanOrEqual(4.5);

      expect(lightThemeCss).toContain('--gt-background:');
    },
  );

  it.each([
    ['success', '--gt-success-700', '--gt-success-50', '--gt-success-100'],
    ['warning', '--gt-warning-700', '--gt-warning-50', '--gt-warning-100'],
    ['danger', '--gt-danger-700', '--gt-danger-50', '--gt-danger-100'],
    ['info', '--gt-info-700', '--gt-info-50', '--gt-info-100'],
  ])(
    'keeps dark-theme %s semantic text contrast at WCAG AA',
    (_name, foregroundToken, background50Token, background100Token) => {
      const foreground = getCssVariable(darkThemeCss, foregroundToken);

      const background50 = getCssVariable(darkThemeCss, background50Token);

      const background100 = getCssVariable(darkThemeCss, background100Token);

      expect(
        contrastRatio(foreground, background50),
        `${foregroundToken} against ${background50Token}`,
      ).toBeGreaterThanOrEqual(4.5);

      expect(
        contrastRatio(foreground, background100),
        `${foregroundToken} against ${background100Token}`,
      ).toBeGreaterThanOrEqual(4.5);

      expect(darkThemeCss).toContain('--gt-background:');
    },
  );
});
