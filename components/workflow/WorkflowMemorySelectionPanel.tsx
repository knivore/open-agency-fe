'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Label } from '@/components/library/shadcn/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import { MEMORY_TYPE_TABS, MEMORY_TYPES, memoryTypeLabel } from '@/types/memory';
import type { MemoryType, MemoryTypeTabId } from '@/types/memory';
import type { WorkflowMemoryDefinition } from '@/types/workflows';

function memoryDisplayName(memory: WorkflowMemoryDefinition) {
  return memory.name || memory.id;
}

function memoryDefinitionType(memory: WorkflowMemoryDefinition): string | null {
  if (typeof memory.memory_type === 'string' && memory.memory_type.trim()) {
    return memory.memory_type;
  }

  const catalogMemoryType = memory.metadata?.catalog_memory_type;
  return typeof catalogMemoryType === 'string' && catalogMemoryType.trim()
    ? catalogMemoryType
    : null;
}

function isKnownMemoryType(value: string | null): value is MemoryType {
  return Boolean(value && (MEMORY_TYPES as readonly string[]).includes(value));
}

function memoryTypeDisplayLabel(memory: WorkflowMemoryDefinition) {
  const memoryType = memoryDefinitionType(memory);
  return isKnownMemoryType(memoryType) ? memoryTypeLabel(memoryType) : memoryType || 'Untyped';
}

function memoryMatchesTab(memory: WorkflowMemoryDefinition, tabId: MemoryTypeTabId) {
  if (tabId === 'all') {
    return true;
  }

  const tab = MEMORY_TYPE_TABS.find((candidate) => candidate.id === tabId);
  const memoryType = memoryDefinitionType(memory);
  return Boolean(tab && memoryType && tab.memoryTypes.includes(memoryType as MemoryType));
}

interface WorkflowMemorySelectionPanelProps {
  title?: string;
  description?: string;
  memories: WorkflowMemoryDefinition[];
  selectedMemoryIds: string[];
  isEditing: boolean;
  onSelectedMemoryIdsChange?: (memoryIds: string[]) => void;
}

export default function WorkflowMemorySelectionPanel({
  title = 'Memory List',
  description = 'Select memories by type for this workflow item.',
  memories,
  selectedMemoryIds,
  isEditing,
  onSelectedMemoryIdsChange,
}: WorkflowMemorySelectionPanelProps) {
  const [selectedTab, setSelectedTab] = useState<MemoryTypeTabId>('all');
  const selectedMemoryIdSet = useMemo(() => new Set(selectedMemoryIds), [selectedMemoryIds]);
  const visibleMemories = memories.filter((memory) => memoryMatchesTab(memory, selectedTab));
  const selectedMemories = selectedMemoryIds
    .map((memoryId) => memories.find((memory) => memory.id === memoryId))
    .filter((memory): memory is WorkflowMemoryDefinition => Boolean(memory));
  const unknownSelectedMemoryIds = selectedMemoryIds.filter(
    (memoryId) => !memories.some((memory) => memory.id === memoryId)
  );
  const tabCounts = new Map<MemoryTypeTabId, number>(
    MEMORY_TYPE_TABS.map((tab) => [
      tab.id,
      memories.filter((memory) => memoryMatchesTab(memory, tab.id)).length,
    ])
  );
  const selectedTabDefinition =
    MEMORY_TYPE_TABS.find((tab) => tab.id === selectedTab) ?? MEMORY_TYPE_TABS[0];

  const toggleMemory = (memoryId: string) => {
    if (!isEditing || !onSelectedMemoryIdsChange) {
      return;
    }

    onSelectedMemoryIdsChange(
      selectedMemoryIdSet.has(memoryId)
        ? selectedMemoryIds.filter((candidateId) => candidateId !== memoryId)
        : [...selectedMemoryIds, memoryId]
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/25 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{selectedMemoryIds.length} selected</Badge>
      </div>

      {selectedMemoryIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedMemories.map((memory) => (
            <Badge key={memory.id} variant="secondary">
              {memoryDisplayName(memory)}
            </Badge>
          ))}
          {unknownSelectedMemoryIds.map((memoryId) => (
            <Badge key={memoryId} variant="outline">
              {memoryId}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No memories selected.</p>
      )}

      <div className="flex flex-col gap-2">
        {memories.length === 0 ? (
          <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
            No workflow memories are available yet. Add a Memory node in the graph or upload a file
            through a Memory node.
          </p>
        ) : (
          <Tabs
            value={selectedTab}
            onValueChange={(value) => setSelectedTab(value as MemoryTypeTabId)}
          >
            <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-background p-1">
              <TooltipProvider delayDuration={150}>
                {MEMORY_TYPE_TABS.map((tab) => {
                  const count = tabCounts.get(tab.id) ?? 0;
                  return (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={tab.id}
                          className="gap-1.5 text-xs"
                          aria-label={`${tab.label} ${count}`}
                          title={tab.description}
                        >
                          {tab.label}
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {count}
                          </span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64 text-xs leading-5">
                        {tab.description}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </TabsList>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedTabDefinition.description}
            </p>
            <div className="mt-3 max-h-72 overflow-y-auto pr-1">
              {visibleMemories.length === 0 ? (
                <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                  No {selectedTabDefinition.label.toLowerCase()} memories are available.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {visibleMemories.map((memory) => {
                    const isSelected = selectedMemoryIdSet.has(memory.id);
                    return (
                      <div
                        key={memory.id}
                        className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 shadow-sm"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {memoryDisplayName(memory)}
                            </span>
                            <Badge variant="outline">{memoryTypeDisplayLabel(memory)}</Badge>
                            {isSelected ? <Badge variant="secondary">Selected</Badge> : null}
                          </div>
                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {memory.description || 'No memory description.'}
                          </p>
                        </div>
                        {isEditing ? (
                          <Button
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleMemory(memory.id)}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
