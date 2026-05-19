'use client';

import { Button } from '../library/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../library/shadcn/dialog';
import { Input } from '../library/shadcn/input';
import { Search, Users, X } from 'lucide-react';
import WorkflowOwnerInfoCard from '@/components/workflows/WorkflowOwnerInfoCard';
import type { User } from '@/types/users';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUsersByEmail } from '@/app/api/utils/workflows';
import { useState, useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import { toast } from 'sonner';
import { appApiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query/queryKeys';

export default function WorkflowPermissions({
  workflowId,
  workflowName,
  creator,
  workflowOwners,
  onClose,
}: {
  workflowId: string;
  workflowName: string;
  creator: User;
  workflowOwners: User[];
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const debouncedSearchRef = useRef(
    debounce((email: string) => {
      setSearchTerm(email);
    }, 300)
  );

  const { data: searchResults } = useQuery({
    queryKey: ['searchUsers', searchTerm],
    queryFn: () => getUsersByEmail(searchTerm),
    enabled: !!searchTerm,
  });

  const filteredResults =
    searchResults
      ?.slice(0, 5)
      .filter((user: User) => !selectedUsers.some((selected) => selected.id === user.id)) || [];

  const handleSelectUser = (user: User) => {
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleRemoveUser = (userId: string | null | undefined) => {
    if (!userId) return;
    setSelectedUsers(selectedUsers.filter((user) => user.id !== userId));
  };

  const handleNewOwners = async () => {
    if (!selectedUsers.length) return;
    const ownerIds = selectedUsers.map((user) => user.id);
    try {
      await appApiClient.post<{ message?: string }>(
        `/api/workflows/${workflowId}/owners`,
        ownerIds
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
      toast.success('Access updated successfully!', { position: 'top-right' });
      setShowDialog(false);
      onClose();
      setSelectedUsers([]);
    } catch (error: unknown) {
      console.error('Error adding owners:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error adding owners: ${message}`, { position: 'top-right' });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const debouncedSearch = debouncedSearchRef.current;
    return () => {
      debouncedSearch.cancel();
    };
  }, []);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button
          className="inline-flex items-center gap-1.5 rounded-full border-primary-200 bg-primary-50 text-primary-900 hover:bg-primary-100"
          variant="outline"
        >
          <Users className="h-5 w-5 text-primary-600" />
          <span className="font-medium">Share</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="space-y-2 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Share &apos;{workflowName}&apos;</DialogTitle>
          <DialogDescription>Update workflow access</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            className="pl-10 bg-gray-50"
            placeholder="Enter email to add owners"
            onChange={(e) => {
              debouncedSearchRef.current(e.target.value);
              setShowDropdown(true);
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />

          {showDropdown && filteredResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 shadow-md rounded-md z-50 max-h-40 overflow-y-auto"
            >
              {filteredResults.slice(0, 5).map((user: User) => (
                <div
                  key={user.id}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSelectUser(user)}
                >
                  <span>{user.name}</span> (<span className="font-semibold">{user.email}</span>)
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {selectedUsers.map((user) => (
              <span
                key={user.id}
                className="flex items-center px-3 py-1 bg-gray-200 rounded-full text-sm"
              >
                {user.name} | ({user.email})
                <button
                  className="ml-2 text-gray-600 hover:text-gray-800"
                  onClick={() => handleRemoveUser(user.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500">People with access</h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {workflowOwners?.map((owner) => (
              <WorkflowOwnerInfoCard
                key={owner.id}
                owner={owner}
                creator={creator}
                workflowId={workflowId}
                onCloseDialog={() => {
                  setShowDialog(false);
                  onClose();
                }}
              />
            ))}
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <Button className="w-full" onClick={handleNewOwners}>
            Save
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
