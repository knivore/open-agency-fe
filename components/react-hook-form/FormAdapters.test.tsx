import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import MultiTypeInput from './multiTypeInput';
import TextArea from './textArea';
import Select from './select';

type Values = { name: string; notes: string; limit: string; enabled: boolean; priority: string };
function Harness({
  onSubmit,
  onChange = () => {},
}: {
  onSubmit: (value: Values) => void;
  onChange?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: { name: '', notes: '', limit: '2', enabled: false, priority: 'low' },
  });
  return (
    <form aria-label="Reusable form" onSubmit={handleSubmit(onSubmit)}>
      <MultiTypeInput
        name="name"
        label="Name"
        register={register}
        validation={{ required: 'Name is required' }}
        error={errors.name}
        onChange={onChange}
      />
      <MultiTypeInput
        name="limit"
        label="Limit"
        type="range"
        register={register}
        min={0}
        max={10}
      />
      <MultiTypeInput name="enabled" label="Enabled" type="checkbox" register={register} />
      <TextArea name="notes" label="Notes" register={register} />
      <Select
        name="priority"
        label="Priority"
        control={control}
        options={[
          { value: 'low', label: 'Low' },
          { value: 'high', label: 'High' },
        ]}
      />
      <button type="button" onClick={() => setValue('priority', 'high')}>
        Set high
      </button>
      <button type="submit">Submit</button>
    </form>
  );
}
describe('reusable RHF adapters', () => {
  it('composes consumer handlers with RHF for text, range, checkbox and textarea values', async () => {
    const submit = vi.fn(),
      change = vi.fn();
    render(<Harness onSubmit={submit} onChange={change} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Worker' } });
    fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '7' } });
    fireEvent.click(screen.getByLabelText('Enabled'));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Scoped capability' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set high' }));
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveTextContent('High');
    fireEvent.submit(screen.getByRole('form', { name: 'Reusable form' }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toEqual({
      name: 'Worker',
      notes: 'Scoped capability',
      limit: '7',
      enabled: true,
      priority: 'high',
    });
    expect(change).toHaveBeenCalledTimes(1);
  });
  it('announces validation and does not submit invalid values', async () => {
    const submit = vi.fn();
    render(<Harness onSubmit={submit} />);
    fireEvent.submit(screen.getByRole('form', { name: 'Reusable form' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required');
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Name is required');
    expect(submit).not.toHaveBeenCalled();
  });
});
