'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GripVertical, Split } from 'lucide-react';
import TaskCard from '@/components/workflows/builder/tasks/card';
import type { WorkflowAgentFormData, WorkflowTaskFormData } from '@/types/workflows';
import { Button } from '../../../library/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../library/shadcn/dropdown-menu';

type ItemPosition = 'first' | 'last' | 'middle' | 'only';

interface TaskCardItem {
  id: string;
  task: WorkflowTaskFormData;
  taskCard: React.ReactElement;
}

interface TaskListProp {
  allTasks: WorkflowTaskFormData[];
  allAgents: WorkflowAgentFormData[];
  onOrderChange: (newOrder: string[]) => void;
  taskOrder: string[];
  workflowId: string;
}

function getItemPosition({ index, items }: { index: number; items: TaskCardItem[] }): ItemPosition {
  if (items.length === 1) {
    return 'only';
  }
  if (index === 0) {
    return 'first';
  }
  if (index === items.length - 1) {
    return 'last';
  }
  return 'middle';
}

function reorderList(list: TaskCardItem[], startIndex: number, finishIndex: number) {
  if (startIndex === finishIndex) {
    return list;
  }

  const next = [...list];
  const [movedItem] = next.splice(startIndex, 1);
  next.splice(finishIndex, 0, movedItem);
  return next;
}

function DropDownContent({
  position,
  index,
  listLength,
  onMove,
}: {
  position: ItemPosition;
  index: number;
  listLength: number;
  onMove: (startIndex: number, finishIndex: number) => void;
}) {
  const isMoveUpDisabled = position === 'first' || position === 'only';
  const isMoveDownDisabled = position === 'last' || position === 'only';

  return (
    <>
      <DropdownMenuItem onClick={() => onMove(index, 0)} disabled={isMoveUpDisabled}>
        Move to top
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMove(index, index - 1)} disabled={isMoveUpDisabled}>
        Move up
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMove(index, index + 1)} disabled={isMoveDownDisabled}>
        Move down
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => onMove(index, listLength - 1)}
        disabled={isMoveDownDisabled}
      >
        Move to bottom
      </DropdownMenuItem>
    </>
  );
}

function ListItem({
  item,
  index,
  position,
  listLength,
  movedItemId,
  dragOverIndex,
  onMove,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
}: {
  item: TaskCardItem;
  index: number;
  position: ItemPosition;
  listLength: number;
  movedItemId: string | null;
  dragOverIndex: number | null;
  onMove: (startIndex: number, finishIndex: number) => void;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onDragEnter: (index: number) => void;
  onDrop: (index: number) => void;
}) {
  const task = item.task;
  const taskMetadata = task as WorkflowTaskFormData & { isSplit?: boolean; splitCount?: number };
  const isIncluded = task.includeTask !== false;
  const isSplitTask = Boolean(taskMetadata.isSplit);
  const splitCount = taskMetadata.splitCount || 2;
  const isDropTarget = dragOverIndex === index;

  return (
    <div
      className={[
        'relative rounded-xl border border-black/10 bg-white transition-all',
        isIncluded ? '' : 'opacity-40',
        isSplitTask ? 'border-amber-400 bg-amber-50/50' : '',
        movedItemId === item.id ? 'ring-2 ring-emerald-300' : '',
        isDropTarget ? 'ring-2 ring-sky-300' : '',
      ].join(' ')}
      onDragOver={(event) => {
        event.preventDefault();
        onDragEnter(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 cursor-grab rounded-lg text-slate-500 active:cursor-grabbing"
              draggable
              aria-label={`Reorder task ${task.name}`}
              onDragStart={() => onDragStart(index)}
              onDragEnd={onDragEnd}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropDownContent
              position={position}
              index={index}
              listLength={listLength}
              onMove={onMove}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-0">{item.taskCard}</div>

        {isSplitTask && (
          <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
            <Split className="h-3.5 w-3.5" />
            <span>{splitCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskList({ allTasks, allAgents, onOrderChange, taskOrder, workflowId }: TaskListProp) {
  const taskCards = useMemo(() => {
    const taskMap = new Map(allTasks.map((task) => [task.id, task]));
    return taskOrder
      .map((id) => taskMap.get(id))
      .filter((task): task is WorkflowTaskFormData => Boolean(task))
      .map((task) => ({
        id: task.id!,
        task,
        taskCard: <TaskCard task={task} agents={allAgents} allTasks={allTasks} workflowId={workflowId} />,
      }));
  }, [allTasks, allAgents, taskOrder, workflowId]);

  const [items, setItems] = useState<TaskCardItem[]>(taskCards);
  const [movedItemId, setMovedItemId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const displayItems = useMemo(() => {
    const currentIds = items.map((item) => item.id);
    const nextIds = taskCards.map((item) => item.id);
    return JSON.stringify(currentIds) === JSON.stringify(nextIds) ? items : taskCards;
  }, [items, taskCards]);

  const moveItem = useCallback(
    (startIndex: number, finishIndex: number) => {
      if (
        startIndex < 0 ||
        finishIndex < 0 ||
        startIndex >= displayItems.length ||
        finishIndex >= displayItems.length ||
        startIndex === finishIndex
      ) {
        return;
      }

      const updatedItems = reorderList(displayItems, startIndex, finishIndex);
      setItems(updatedItems);
      setMovedItemId(updatedItems[finishIndex]?.id ?? null);
      onOrderChange(updatedItems.map((entry) => entry.id));
    },
    [displayItems, onOrderChange]
  );

  useEffect(() => {
    if (!movedItemId) {
      return;
    }

    const timeout = window.setTimeout(() => setMovedItemId(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [movedItemId]);

  const currentOrder = displayItems.map((item) => item.id);

  useEffect(() => {
    if (JSON.stringify(currentOrder) !== JSON.stringify(taskOrder)) {
      onOrderChange(currentOrder);
    }
  }, [currentOrder, onOrderChange, taskOrder]);

  return (
    <div className="space-y-2">
      {displayItems.map((item, index) => (
        <ListItem
          key={item.id}
          item={item}
          index={index}
          position={getItemPosition({ index, items: displayItems })}
          listLength={displayItems.length}
          movedItemId={movedItemId}
          dragOverIndex={dragOverIndex}
          onMove={moveItem}
          onDragStart={(nextIndex) => {
            setDraggedIndex(nextIndex);
            setDragOverIndex(nextIndex);
          }}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          onDragEnter={(nextIndex) => {
            if (draggedIndex !== null && draggedIndex !== nextIndex) {
              setDragOverIndex(nextIndex);
            }
          }}
          onDrop={(nextIndex) => {
            if (draggedIndex !== null) {
              moveItem(draggedIndex, nextIndex);
            }
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
        />
      ))}
    </div>
  );
}
