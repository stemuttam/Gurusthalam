import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Radio } from './Radio.js';

describe('Radio', () => {
  it('renders its label', () => {
    render(<Radio id="option-a" name="choice" value="a" label="Option A" />);

    expect(screen.getByRole('radio', { name: 'Option A' })).toBeTruthy();
  });

  it('supports checked state', () => {
    render(
      <Radio
        id="option-a"
        name="choice"
        value="a"
        label="Option A"
        checked
        readOnly
      />,
    );

    expect((screen.getByRole('radio') as HTMLInputElement).checked).toBe(true);
  });

  it('supports disabled state', () => {
    render(
      <Radio id="option-a" name="choice" value="a" label="Option A" disabled />,
    );

    expect((screen.getByRole('radio') as HTMLInputElement).disabled).toBe(true);
  });

  it('preserves the native radio name and value', () => {
    render(
      <Radio
        id="option-a"
        name="delivery"
        value="standard"
        label="Standard delivery"
      />,
    );

    const radio = screen.getByRole('radio') as HTMLInputElement;

    expect(radio.name).toBe('delivery');
    expect(radio.value).toBe('standard');
  });

  it('forwards its ref to the native input', () => {
    const ref = { current: null as HTMLInputElement | null };

    render(
      <Radio
        ref={ref}
        id="option-a"
        name="choice"
        value="a"
        label="Option A"
      />,
    );

    expect(ref.current).toBe(screen.getByRole('radio'));
  });
});
