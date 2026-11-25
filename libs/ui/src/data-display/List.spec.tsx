import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { List, ListItem } from './List.js';

describe('List', () => {
  it('renders an unordered list by default', () => {
    render(
      <List aria-label="Course modules">
        <ListItem>Introduction</ListItem>
        <ListItem>Learning objectives</ListItem>
      </List>,
    );

    const list = screen.getByRole('list', { name: 'Course modules' });

    expect(list.tagName).toBe('UL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders an ordered list when requested', () => {
    render(
      <List ordered aria-label="Setup steps">
        <ListItem>Create an account</ListItem>
        <ListItem>Complete your profile</ListItem>
      </List>,
    );

    const list = screen.getByRole('list', { name: 'Setup steps' });

    expect(list.tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders list item content', () => {
    render(
      <List>
        <ListItem>Mathematics</ListItem>
        <ListItem>Science</ListItem>
      </List>,
    );

    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByText('Science')).toBeTruthy();
  });

  it('uses the default visual classes', () => {
    render(
      <List data-testid="list">
        <ListItem>Item</ListItem>
      </List>,
    );

    expect(screen.getByTestId('list').className).toContain('gt-list');
    expect(screen.getByTestId('list').className).toContain('gt-list--medium');
  });

  it.each([
    ['unstyled', 'gt-list--unstyled'],
    ['divided', 'gt-list--divided'],
  ] as const)('supports the %s variant', (variant, expectedClass) => {
    render(
      <List variant={variant} data-testid="list">
        <ListItem>Item</ListItem>
      </List>,
    );

    expect(screen.getByTestId('list').className).toContain(expectedClass);
  });

  it.each([
    ['small', 'gt-list--small'],
    ['medium', 'gt-list--medium'],
    ['large', 'gt-list--large'],
  ] as const)('supports the %s size', (size, expectedClass) => {
    render(
      <List size={size} data-testid="list">
        <ListItem>Item</ListItem>
      </List>,
    );

    expect(screen.getByTestId('list').className).toContain(expectedClass);
  });

  it('preserves custom list classes and HTML attributes', () => {
    render(
      <List
        className="custom-list"
        data-testid="list"
        data-section="courses"
        aria-label="Available courses"
      >
        <ListItem>Physics</ListItem>
      </List>,
    );

    const list = screen.getByTestId('list');

    expect(list.className).toContain('custom-list');
    expect(list.getAttribute('data-section')).toBe('courses');
    expect(list.getAttribute('aria-label')).toBe('Available courses');
  });

  it('renders a simple list item without composed layout wrappers', () => {
    render(
      <List>
        <ListItem data-testid="item">Introduction</ListItem>
      </List>,
    );

    const item = screen.getByTestId('item');

    expect(item.tagName).toBe('LI');
    expect(item.textContent).toBe('Introduction');
    expect(item.querySelector('.gt-list__content')).toBeNull();
  });

  it('renders leading content', () => {
    render(
      <List>
        <ListItem leading={<span>✓</span>}>Completed lesson</ListItem>
      </List>,
    );

    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('Completed lesson')).toBeTruthy();
  });

  it('marks leading decorative content as hidden from assistive technology', () => {
    render(
      <List>
        <ListItem leading={<span data-testid="leading">★</span>}>
          Featured course
        </ListItem>
      </List>,
    );

    expect(
      screen.getByTestId('leading').parentElement?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('renders supporting descriptions', () => {
    render(
      <List>
        <ListItem description="Understand the fundamentals">
          Introduction to Physics
        </ListItem>
      </List>,
    );

    expect(screen.getByText('Introduction to Physics')).toBeTruthy();
    expect(screen.getByText('Understand the fundamentals')).toBeTruthy();
  });

  it('renders trailing content', () => {
    render(
      <List>
        <ListItem trailing={<span>12 lessons</span>}>Physics</ListItem>
      </List>,
    );

    expect(screen.getByText('Physics')).toBeTruthy();
    expect(screen.getByText('12 lessons')).toBeTruthy();
  });

  it('renders leading, description, and trailing content together', () => {
    render(
      <List>
        <ListItem
          leading={<span>📘</span>}
          description="Core concepts and exercises"
          trailing={<span>8 lessons</span>}
        >
          Mathematics
        </ListItem>
      </List>,
    );

    expect(screen.getByText('📘')).toBeTruthy();
    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByText('Core concepts and exercises')).toBeTruthy();
    expect(screen.getByText('8 lessons')).toBeTruthy();
  });

  it('preserves custom list item classes and HTML attributes', () => {
    render(
      <List>
        <ListItem
          className="custom-item"
          data-testid="item"
          data-course-id="course-1"
          aria-label="Physics course"
        >
          Physics
        </ListItem>
      </List>,
    );

    const item = screen.getByTestId('item');

    expect(item.className).toContain('gt-list__item');
    expect(item.className).toContain('custom-item');
    expect(item.getAttribute('data-course-id')).toBe('course-1');
    expect(item.getAttribute('aria-label')).toBe('Physics course');
  });

  it('supports nested semantic lists', () => {
    render(
      <List aria-label="Course categories">
        <ListItem>
          Science
          <List aria-label="Science subjects">
            <ListItem>Physics</ListItem>
            <ListItem>Chemistry</ListItem>
          </List>
        </ListItem>
      </List>,
    );

    expect(
      screen.getByRole('list', { name: 'Course categories' }),
    ).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Science subjects' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
