import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FaqPage } from './HelpPages';

afterEach(() => window.history.replaceState(null, '', '/'));

describe('searchable help', () => {
  it('searches answer content and resets topic and search filters together', () => {
    render(<FaqPage />);
    fireEvent.change(screen.getByRole('combobox', { name: 'FAQ topic' }), {
      target: { value: 'Runs and operations' },
    });
    expect(screen.getByRole('button', { name: 'Where can I see why a run failed?' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'What is Open Agency?' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no-matching-answer' } });
    expect(screen.getByRole('heading', { name: 'No matching answers' })).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(screen.getByRole('button', { name: 'What is Open Agency?' })).toBeVisible();
  });

  it('opens the question addressed by a shared answer link', async () => {
    window.history.replaceState(null, '', '/help/faq#faq-what-is-open-agency');
    render(<FaqPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'What is Open Agency?' })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    );
    expect(screen.getByRole('link', { name: 'Link to this answer' })).toHaveAttribute(
      'href',
      '#faq-what-is-open-agency'
    );
  });
});
