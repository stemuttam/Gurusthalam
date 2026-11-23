import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';

describe('Web application UI library integration', () => {
  function renderApp() {
    return render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
  }

  it('renders the learner workspace heading', () => {
    renderApp();

    expect(
      screen.getByRole('heading', { name: 'Learner workspace' }),
    ).toBeTruthy();
  });

  it('renders the shared UI package integration confirmation', () => {
    renderApp();

    expect(screen.getByText('Shared UI package connected')).toBeTruthy();
  });

  it('renders shared UI components through the public package API', () => {
    renderApp();

    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('Example progress')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Show notification' }),
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
