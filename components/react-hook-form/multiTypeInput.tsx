import { ComponentPropsWithoutRef, useState } from 'react';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { FieldError, RegisterOptions, UseFormRegister } from 'react-hook-form';

type TextInputProps = {
  name: string;
  label: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  validation?: RegisterOptions;
  isChecked?: boolean;
} & Omit<ComponentPropsWithoutRef<typeof Input>, 'name'>;

export default function MultiTypeInput({
                                         name,
                                         label,
                                         register,
                                         error,
                                         validation,
                                         className = '',
                                         type = 'text',
                                         min = 0,
                                         max = 100,
                                         isChecked,
                                         defaultValue,
                                         ...props
                                       }: TextInputProps) {
  const [sliderValue, setSliderValue] = useState(defaultValue || min || '0'); // Track slider value

  // Handle slider value change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSliderValue(value); // Update local state
  };

  // Calculate the position of the slider value display
  const sliderPercentage = (((Number(sliderValue) - Number(min)) / (Number(max) - Number(min))) * 100) + 1;

  return (
    <div>
      <Label className="block text-sm font-medium text-gray-700">{label}</Label>

      {/* Slider Container */}
      {type === 'range' && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{min}</span>
          <span className="text-xs text-gray-500">{max}</span>
        </div>
      )}

      {/* MixInput */}
      <div className="relative">
        {type === 'checkbox' ? (
          // Checkbox input
          <Input
            type="checkbox"
            className={`mt-1 block w-4 h-4 rounded border ${
              error ? 'border-red-500' : 'border-gray-300'
            } ${className}`}
            {...register(name, validation)}
            defaultChecked={isChecked}
          />
        ) : (
          // Other input Types
          <Input
            type={type}
            className={`mt-1 block w-full p-2 border rounded-lg ${
              error ? 'border-red-500' : 'border-gray-300'
            } ${className}`}
            {...register(name, validation)}
            {...props}
            defaultValue={defaultValue} // Set default value
            onChange={type === 'range' ? handleSliderChange : undefined} // Handle slider change
            min={min}
            max={max}
          />
        )}

        {/* Current Value Display for Slider */}
        {type === 'range' && (
          <div
            className="absolute -bottom-6 transform -translate-x-1/2 bg-white px-2 py-1 rounded-md shadow-md text-sm text-gray-700"
            style={{
              left: `${sliderPercentage > 99 ? 99 : sliderPercentage}%`, // Position based on slider percentage
            }}
          >
            {sliderValue}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
