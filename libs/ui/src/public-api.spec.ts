import * as UI from './index.js';

import { describe, expect, it } from 'vitest';

const publicComponents = [
  'Button',
  'Card',
  'StatCard',
  'Avatar',
  'Badge',
  'Alert',
  'EmptyState',
  'Progress',
  'Skeleton',
  'Toast',
  'Input',
  'Select',
  'Textarea',
  'PageHeader',
  'Separator',
  'Checkbox',
  'Radio',
  'RadioGroup',
  'Switch',
] as const;

describe('UI library public API', () => {
  it.each(publicComponents)(
    'exports the %s component from the package root',
    (componentName) => {
      expect(UI).toHaveProperty(componentName);
      expect(UI[componentName]).toBeDefined();
    },
  );

  it('exports all component categories through the root entry point', () => {
    expect(Object.keys(UI)).toEqual(
      expect.arrayContaining([...publicComponents]),
    );
  });
});
