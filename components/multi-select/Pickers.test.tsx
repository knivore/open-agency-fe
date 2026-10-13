import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { MultiSelect } from './MultiSelect';
import { Combobox } from '@/components/library/shadcn/combobox';

const options = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'locked', label: 'Locked', disabled: true },
];
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('configurable pickers', () => {
  it('selects by stable value and clears through an accessible button', () => {
    function Harness() {
      const [value, setValue] = useState('alpha');
      return (
        <Combobox
          aria-label="Workspace"
          options={options}
          value={value}
          onChange={setValue}
          canDeselect
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Workspace' }));
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(screen.getByRole('combobox', { name: 'Workspace' })).toHaveTextContent('Beta');
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByRole('combobox', { name: 'Workspace' })).toHaveTextContent(
      'Select an option...'
    );
  });
  it('preserves unavailable values and excludes disabled choices during bulk selection', () => {
    const change = vi.fn();
    render(
      <MultiSelect
        aria-label="Capabilities"
        options={options}
        value={['hidden', 'alpha']}
        onValueChange={change}
      />
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Capabilities' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select available' }));
    expect(change).toHaveBeenCalledWith(['hidden', 'alpha', 'beta']);
    expect(change.mock.calls[0][0]).not.toContain('locked');
  });
  it('uses controlled values after external updates and honors disabled state', () => {
    const change = vi.fn();
    const { rerender } = render(
      <MultiSelect
        aria-label="Capabilities"
        options={options}
        value={['alpha']}
        onValueChange={change}
      />
    );
    rerender(
      <MultiSelect
        aria-label="Capabilities"
        options={options}
        value={['beta']}
        onValueChange={change}
        disabled
      />
    );
    const trigger = screen.getByRole('combobox', { name: 'Capabilities' });
    expect(trigger).toHaveTextContent('Beta');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(change).not.toHaveBeenCalled();
  });
});
