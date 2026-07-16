import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ImageArtifacts from '@/components/artifacts/ImageArtifacts';

describe('ImageArtifacts', () => {
  it('moves from the shared loading state to rendered image content', () => {
    render(<ImageArtifacts processId="process-1" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading image artifacts');
    fireEvent.load(screen.getByRole('img', { name: 'Workflow image artifact' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a recoverable shared error state and retries with a fresh URL', () => {
    render(<ImageArtifacts processId="process-1" />);

    const image = screen.getByRole('img', { name: 'Workflow image artifact' });
    expect(image).toHaveAttribute('src', expect.stringContaining('retry=0'));
    fireEvent.error(image);
    expect(screen.getByRole('alert')).toHaveTextContent('Image artifact unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Retry image' }));
    expect(screen.getByRole('img', { name: 'Workflow image artifact' })).toHaveAttribute(
      'src',
      expect.stringContaining('retry=1')
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading image artifacts');
  });
});
