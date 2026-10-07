import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import App from '../src/App.tsx';
import { BrowserRouter } from 'react-router-dom';

describe('frontend smoke', () => {
  it('renders the sign-in entry point for unauthenticated users', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    expect((await screen.findAllByText('Sign in')).length).toBeGreaterThan(0);
  });
});
