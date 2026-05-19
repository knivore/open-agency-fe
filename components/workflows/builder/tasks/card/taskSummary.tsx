import { forwardRef } from 'react';

interface TaskSummaryProps {
  name: string;
  description: string;

  [key: string]: any;
}

export const TaskSummary = forwardRef<HTMLDivElement, TaskSummaryProps>(
  ({ name, description, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className="flex flex-col justify-start w-full p-4 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200"
        {...props}
      >
        <p className="font-semibold">{name}</p>
        <p className="text-caption-1 text-gray-500 overflow-hidden text-ellipsis break-words line-clamp-3 whitespace-break-spaces"
           title={description}>{description}</p>
      </div>
    );
  },
);

// Make sure the component has a display name
TaskSummary.displayName = 'TaskSummary';
