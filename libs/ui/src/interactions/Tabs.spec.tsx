
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs.js';

describe('Tabs', () => {
  function renderTabs() {
    return render(
      <Tabs defaultValue="overview">
        <TabsList label="Course sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="lessons">Lessons content</TabsContent>
        <TabsContent value="resources">Resources content</TabsContent>
      </Tabs>,
    );
  }

  it('renders the selected tab and its panel', () => {
    renderTabs();

    expect(
      screen.getByRole('tab', { name: 'Overview' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');

    expect(screen.getByRole('tabpanel').textContent).toBe(
      'Overview content',
    );
  });

  it('changes the selected tab when a trigger is clicked', () => {
    renderTabs();

    fireEvent.click(screen.getByRole('tab', { name: 'Lessons' }));

    expect(
      screen.getByRole('tab', { name: 'Lessons' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');

    expect(screen.getByRole('tabpanel').textContent).toBe('Lessons content');
  });

  it('supports arrow-key navigation in automatic mode', () => {
    renderTabs();

    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();

    fireEvent.keyDown(overview, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Lessons' }),
    );

    expect(
      screen.getByRole('tab', { name: 'Lessons' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
  });

  it('supports Home and End navigation', () => {
    renderTabs();

    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();

    fireEvent.keyDown(overview, { key: 'End' });

    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Resources' }),
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Resources' }), {
      key: 'Home',
    });

    expect(document.activeElement).toBe(overview);
  });

  it('supports controlled values', () => {
    const onValueChange = vi.fn();

    render(
      <Tabs value="overview" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="lessons">Lessons panel</TabsContent>
      </Tabs>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Lessons' }));

    expect(onValueChange).toHaveBeenCalledWith('lessons');
    expect(screen.getByRole('tabpanel').textContent).toBe('Overview panel');
  });

  it('associates each tab with its corresponding panel', () => {
    renderTabs();

    const tab = screen.getByRole('tab', { name: 'Overview' });
    const panel = screen.getByRole('tabpanel');

    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
  });

  it('uses vertical orientation and supports vertical arrow navigation', () => {
    render(
      <Tabs defaultValue="overview" orientation="vertical">
        <TabsList label="Vertical sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="lessons">Lessons panel</TabsContent>
      </Tabs>,
    );

    const list = screen.getByRole('tablist');

    expect(list.getAttribute('aria-orientation')).toBe('vertical');

    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();

    fireEvent.keyDown(overview, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Lessons' }),
    );
  });

  it('does not activate a tab during keyboard navigation in manual mode', () => {
    render(
      <Tabs defaultValue="overview" activationMode="manual">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="lessons">Lessons panel</TabsContent>
      </Tabs>,
    );

    const overview = screen.getByRole('tab', { name: 'Overview' });
    const lessons = screen.getByRole('tab', { name: 'Lessons' });

    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(lessons);
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(lessons.getAttribute('aria-selected')).toBe('false');
  });

  it('activates a manually navigated tab when clicked', () => {
    render(
      <Tabs defaultValue="overview" activationMode="manual">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="lessons">Lessons panel</TabsContent>
      </Tabs>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Lessons' }));

    expect(
      screen.getByRole('tab', { name: 'Lessons' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');

    expect(screen.getByRole('tabpanel').textContent).toBe('Lessons panel');
  });

  it('skips disabled tabs during keyboard navigation', () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="restricted" disabled>
            Restricted
          </TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="lessons">Lessons panel</TabsContent>
      </Tabs>,
    );

    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();

    fireEvent.keyDown(overview, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Lessons' }),
    );
  });

  it('keeps force-mounted inactive panels in the DOM but hidden', () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" forceMount>
          Overview panel
        </TabsContent>

        <TabsContent value="lessons" forceMount>
          Lessons panel
        </TabsContent>
      </Tabs>,
    );

    const overviewPanel = screen.getByText('Overview panel');
    const lessonsPanel = screen.getByText('Lessons panel');

    expect(overviewPanel.closest('[role="tabpanel"]')).toBeTruthy();
    expect(lessonsPanel.closest('[role="tabpanel"]')).toBeTruthy();

    expect(
      lessonsPanel.closest('[role="tabpanel"]')?.hasAttribute('hidden')
    ).toBe(true);
  });
});
