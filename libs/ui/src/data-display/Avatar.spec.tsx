import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar.js';

describe('Avatar', () => {
  it('renders initials from a two-part name', () => {
    render(<Avatar name="Uttam Pal" />);

    expect(screen.getByRole('img', { name: 'Uttam Pal' }).textContent).toBe(
      'UP',
    );
  });

  it('renders two initials from a single name', () => {
    render(<Avatar name="Uttam" />);

    expect(screen.getByRole('img', { name: 'Uttam' }).textContent).toBe('UT');
  });

  it('normalizes extra whitespace in names and generates correct initials', () => {
    render(<Avatar name="  Uttam   Pal  " />);

    const avatar = screen.getByRole('img', { name: 'Uttam Pal' });

    expect(avatar.textContent).toBe('UP');
    expect(avatar.getAttribute('aria-label')).toBe('Uttam Pal');
  });

  it('renders a fallback for an empty name', () => {
    render(<Avatar name="" />);

    expect(screen.getByRole('img', { name: 'User avatar' }).textContent).toBe(
      '?',
    );
  });

  it('renders a supplied fallback', () => {
    render(<Avatar name="Uttam Pal" fallback="UP!" />);

    expect(screen.getByRole('img').textContent).toBe('UP!');
  });

  it('renders an image when a source is provided', () => {
    render(<Avatar name="Uttam Pal" src="/avatars/uttam.png" />);

    const avatar = screen.getByRole('img', { name: 'Uttam Pal' });

    expect(avatar.querySelector('img')?.getAttribute('src')).toBe(
      '/avatars/uttam.png',
    );
  });

  it('falls back to initials when the image fails', () => {
    render(<Avatar name="Uttam Pal" src="/avatars/missing.png" />);

    const image = screen
      .getByRole('img', { name: 'Uttam Pal' })
      .querySelector('img');

    expect(image).toBeTruthy();

    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByRole('img', { name: 'Uttam Pal' }).textContent).toBe(
      'UP',
    );
  });

  it('renders a new image source after the previous source failed', () => {
    const { rerender } = render(
      <Avatar name="Uttam Pal" src="/avatars/missing.png" />,
    );

    const failedImage = screen
      .getByRole('img', { name: 'Uttam Pal' })
      .querySelector('img');

    expect(failedImage).toBeTruthy();

    fireEvent.error(failedImage as HTMLImageElement);

    expect(screen.getByRole('img', { name: 'Uttam Pal' }).textContent).toBe(
      'UP',
    );

    rerender(<Avatar name="Uttam Pal" src="/avatars/uttam.png" />);

    const recoveredImage = screen
      .getByRole('img', { name: 'Uttam Pal' })
      .querySelector('img');

    expect(recoveredImage).toBeTruthy();
    expect(recoveredImage?.getAttribute('src')).toBe('/avatars/uttam.png');
  });

  it('falls back again if the replacement image also fails', () => {
    const { rerender } = render(
      <Avatar name="Uttam Pal" src="/avatars/first.png" />,
    );

    const firstImage = screen
      .getByRole('img', { name: 'Uttam Pal' })
      .querySelector('img');

    fireEvent.error(firstImage as HTMLImageElement);

    rerender(<Avatar name="Uttam Pal" src="/avatars/second.png" />);

    const secondImage = screen
      .getByRole('img', { name: 'Uttam Pal' })
      .querySelector('img');

    expect(secondImage).toBeTruthy();

    fireEvent.error(secondImage as HTMLImageElement);

    expect(screen.getByRole('img', { name: 'Uttam Pal' }).textContent).toBe(
      'UP',
    );
  });

  it('does not render an image for an empty source', () => {
    render(<Avatar name="Uttam Pal" src="   " />);

    const avatar = screen.getByRole('img', { name: 'Uttam Pal' });

    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.textContent).toBe('UP');
  });

  it('uses the supplied alt text as its accessible name', () => {
    render(<Avatar name="Uttam Pal" alt="Course instructor" />);

    expect(screen.getByRole('img', { name: 'Course instructor' })).toBeTruthy();
  });

  it('normalizes whitespace in the accessible name', () => {
    render(<Avatar name="Uttam Pal" alt="  Course   instructor  " />);

    expect(screen.getByRole('img', { name: 'Course instructor' })).toBeTruthy();
  });

  it('supports size variants', () => {
    const { container } = render(<Avatar name="Uttam Pal" size="large" />);

    expect(container.firstElementChild?.className).toContain(
      'gt-avatar--large',
    );
  });

  it('supports shape variants', () => {
    const { container } = render(<Avatar name="Uttam Pal" shape="square" />);

    expect(container.firstElementChild?.className).toContain(
      'gt-avatar--square',
    );
  });

  it('supports custom classes and attributes', () => {
    render(
      <Avatar
        name="Uttam Pal"
        className="instructor-avatar"
        data-testid="instructor"
      />,
    );

    const avatar = screen.getByTestId('instructor');

    expect(avatar.className).toContain('instructor-avatar');
  });
});
