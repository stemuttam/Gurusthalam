import { fireEvent, render, screen } from '@testing-library/react';

import { Button } from './Button.js';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save changes</Button>);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  it('uses the primary variant by default', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button').className).toContain(
      'gt-button--primary',
    );
  });

  it('supports secondary variants', () => {
    render(<Button variant="secondary">Cancel</Button>);

    expect(screen.getByRole('button').className).toContain(
      'gt-button--secondary',
    );
  });

  it('does not invoke its handler when disabled', () => {
    let calls = 0;

    render(
      <Button disabled onClick={() => calls++}>
        Submit
      </Button>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(calls).toBe(0);
  });

  it('disables itself while loading', () => {
    render(<Button loading>Submitting</Button>);

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);

    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
  });

  it('supports full width layout', () => {
    render(<Button fullWidth>Continue</Button>);

    expect(screen.getByRole('button').className).toContain('gt-button--block');
  });
});
