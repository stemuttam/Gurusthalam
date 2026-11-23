import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';

describe('Admin application UI library integration', () => {
  function renderApp() {
    return render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
  }

  it('renders the administration workspace heading', () => {
    renderApp();

    expect(
      screen.getByRole('heading', { name: 'Administration workspace' }),
    ).toBeTruthy();
  });

  it('renders the shared UI package integration preview', () => {
    renderApp();

    expect(screen.getByText('UI package connected')).toBeTruthy();
    expect(screen.getByText('Integration preview')).toBeTruthy();
  });

  it('renders the shared avatar and empty state components', () => {
    renderApp();

    expect(
      screen.getByRole('img', { name: 'Gurusthalam Administrator' }),
    ).toBeTruthy();

    expect(
      screen.getByText('No administration modules in this preview'),
    ).toBeTruthy();
  });

  it('displays and dismisses a shared UI toast notification', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }));

    expect(screen.getByText('Shared UI notification')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );

    expect(screen.queryByText('Shared UI notification')).toBeNull();
  });
});
