import { render, screen } from '@testing-library/react';

import { PageHeader } from './PageHeader.js';

describe('PageHeader', () => {
  it('renders the page title as an h1 by default', () => {
    render(<PageHeader title="Course Management" />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Course Management',
      }),
    ).toBeTruthy();
  });

  it('supports configurable heading levels', () => {
    render(<PageHeader title="Assessment Details" headingLevel="h2" />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Assessment Details',
      }),
    ).toBeTruthy();
  });

  it('renders an optional description', () => {
    render(
      <PageHeader
        title="Courses"
        description="Manage and organize your courses."
      />,
    );

    expect(screen.getByText('Manage and organize your courses.')).toBeTruthy();
  });

  it('renders an optional eyebrow label', () => {
    render(<PageHeader title="Course Management" eyebrow="ACADEMIC" />);

    expect(screen.getByText('ACADEMIC')).toBeTruthy();
  });

  it('renders breadcrumb content inside an accessible navigation landmark', () => {
    render(
      <PageHeader
        title="Course Details"
        breadcrumbs={
          <>
            <a href="/dashboard">Dashboard</a>
            <span aria-hidden="true">/</span>
            <a href="/courses">Courses</a>
          </>
        }
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Courses' })).toBeTruthy();
  });

  it('renders optional metadata', () => {
    render(
      <PageHeader
        title="Course Details"
        metadata={<span>Last updated today</span>}
      />,
    );

    expect(screen.getByText('Last updated today')).toBeTruthy();
  });

  it('renders page-level actions', () => {
    render(
      <PageHeader
        title="Courses"
        actions={<button type="button">Create Course</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Create Course' })).toBeTruthy();
  });

  it('does not render optional sections when they are not provided', () => {
    const { container } = render(<PageHeader title="Dashboard" />);

    expect(container.querySelector('.gt-page-header__breadcrumbs')).toBeNull();

    expect(container.querySelector('.gt-page-header__eyebrow')).toBeNull();

    expect(container.querySelector('.gt-page-header__description')).toBeNull();

    expect(container.querySelector('.gt-page-header__metadata')).toBeNull();

    expect(container.querySelector('.gt-page-header__actions')).toBeNull();
  });

  it('associates the header landmark with its page title', () => {
    const { container } = render(<PageHeader title="Learning Dashboard" />);

    const header = container.querySelector('header');
    const heading = screen.getByRole('heading', {
      name: 'Learning Dashboard',
    });

    expect(header?.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('supports custom CSS classes', () => {
    const { container } = render(
      <PageHeader title="Courses" className="custom-page-header" />,
    );

    expect(container.querySelector('.gt-page-header')?.className).toContain(
      'custom-page-header',
    );
  });

  it('supports custom HTML attributes', () => {
    const { container } = render(
      <PageHeader
        title="Courses"
        id="courses-page-header"
        data-testid="page-header"
      />,
    );

    const header = container.querySelector('[data-testid="page-header"]');

    expect(header?.id).toBe('courses-page-header');
  });

  it('supports React elements as title content', () => {
    render(
      <PageHeader
        title={
          <>
            Learning <span>Dashboard</span>
          </>
        }
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Learning Dashboard',
      }),
    ).toBeTruthy();
  });
});
