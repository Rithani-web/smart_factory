import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import App from '../src/App.tsx';
import { BrowserRouter } from 'react-router-dom';

describe('frontend smoke', () => {
  it('renders the app shell with sign-in entry point', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    expect(screen.getByText('Smart Factory')).toBeTruthy();
  });
});
