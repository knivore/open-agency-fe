'use client';

import { useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, DatabaseZap, Home, RefreshCw, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/app-shell/PageHeader';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { Input } from '@/components/library/shadcn/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/library/shadcn/table';
import {
  physicalDevicesApi,
  isPhysicalDevicesModuleUnavailable,
  type PhysicalDevice,
  type PhysicalDeviceCommand,
  type PhysicalDeviceEvent,
  type PhysicalDeviceState,
} from '@/lib/api/backend/physicalDevices';
import {
  isSmartHomeModuleUnavailable,
  smartHomeApi,
  type SmartHomeEntitySummary,
} from '@/lib/api/backend/smartHome';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { cn } from '@/lib/utils';

const EMPTY_PHYSICAL_DEVICES: PhysicalDevice[] = [];
const EMPTY_SMART_HOME_ENTITIES: SmartHomeEntitySummary[] = [];
const EMPTY_COMMANDS: PhysicalDeviceCommand[] = [];
const EMPTY_EVENTS: PhysicalDeviceEvent[] = [];
const EMPTY_AUDIT_ITEMS: Array<Record<string, unknown>> = [];

type DeviceSource = 'physical_devices' | 'smart_home';

interface UnifiedDevice {
  id: string;
  source: DeviceSource;
  nativeId: string;
  name: string;
  type: string;
  vendor: string;
  room: string;
  capabilities: string[];
  status: string;
  lifecycleStatus: string;
  metadata?: Record<string, unknown>;
}

interface DeviceCommandSummary {
  failed: number;
  pending: number;
  total: number;
}

interface DeviceEventSummary {
  latestAt: string;
  latestType: string;
  total: number;
}

function numberFromSummary(summary: Record<string, unknown> | undefined, key: string) {
  const value = summary?.[key];
  return typeof value === 'number' ? value : 0;
}

function statusVariant(status: string) {
  if (['online', 'active', 'on', 'open', 'playing', 'idle', 'available'].includes(status)) {
    return 'successful' as const;
  }
  if (['offline', 'disabled', 'unknown', 'unavailable', 'failed'].includes(status)) {
    return 'failed' as const;
  }
  return 'outline' as const;
}

function capabilitySummary(device: UnifiedDevice) {
  if (!device.capabilities.length) {
    return 'No capabilities';
  }
  return device.capabilities.slice(0, 3).join(', ');
}

function smartHomeDomain(entityId: string) {
  return entityId.includes('.') ? entityId.split('.')[0] : 'entity';
}

function stringAttribute(
  attributes: Record<string, unknown> | undefined,
  keys: string[],
  fallback = ''
) {
  for (const key of keys) {
    const value = attributes?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function smartHomeEntityToDevice(entity: SmartHomeEntitySummary): UnifiedDevice {
  const attributes = entity.attributes;
  const domain = smartHomeDomain(entity.entity_id);
  const friendlyName = stringAttribute(attributes, ['friendly_name'], entity.entity_id);
  const room = stringAttribute(
    attributes,
    ['area_name', 'room_name', 'room', 'area_id'],
    'Unassigned'
  );
  const deviceClass = stringAttribute(attributes, ['device_class'], domain);

  return {
    id: `smart-home:${entity.entity_id}`,
    source: 'smart_home',
    nativeId: entity.entity_id,
    name: friendlyName,
    type: deviceClass,
    vendor: 'Home Assistant',
    room,
    capabilities: Array.from(new Set([domain, deviceClass].filter(Boolean))),
    status: String(entity.state || 'unknown'),
    lifecycleStatus: entity.state === 'unavailable' ? 'unavailable' : 'active',
    metadata: attributes,
  };
}

function physicalDeviceToDevice(device: PhysicalDevice): UnifiedDevice {
  return {
    id: `physical-devices:${device.id}`,
    source: 'physical_devices',
    nativeId: device.id,
    name: device.name,
    type: device.type,
    vendor: device.vendor || 'canonical',
    room: device.room || device.zone || 'Unassigned',
    capabilities: device.capabilities,
    status: device.status,
    lifecycleStatus: device.lifecycle_status,
    metadata: device.metadata,
  };
}

function matchesText(device: UnifiedDevice, query: string) {
  if (!query) {
    return true;
  }
  const haystack = [
    device.name,
    device.type,
    device.vendor,
    device.room,
    device.nativeId,
    ...device.capabilities,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export default function DevicesWorkspace() {
  const [roomFilter, setRoomFilter] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const filters = useMemo(
    () => ({
      room: roomFilter.trim() || undefined,
      capability: capabilityFilter.trim() || undefined,
    }),
    [capabilityFilter, roomFilter]
  );
  const smartHomeFilters = useMemo(
    () => ({
      roomName: roomFilter.trim() || undefined,
    }),
    [roomFilter]
  );

  const physicalAvailabilityQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDevicesAvailability(),
    queryFn: () => physicalDevicesApi.getAvailability(),
    staleTime: 60 * 1000,
    retry: 1,
  });
  const smartHomeAvailabilityQuery = useQuery({
    queryKey: queryKeys.backendSmartHomeAvailability(),
    queryFn: () => smartHomeApi.getAvailability(),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const physicalDevicesAvailable = physicalAvailabilityQuery.data?.available === true;
  const smartHomeAvailable = smartHomeAvailabilityQuery.data?.available === true;

  const physicalDevicesQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDevices(filters),
    queryFn: () => physicalDevicesApi.listDevices(filters),
    enabled: physicalDevicesAvailable,
  });
  const auditQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDeviceAudit(),
    queryFn: () => physicalDevicesApi.getAudit({ includeDevices: true, limit: 10 }),
    enabled: physicalDevicesAvailable,
    refetchInterval: 30_000,
  });
  const busHealthQuery = useQuery({
    queryKey: queryKeys.backendPhysicalEventBusHealth(),
    queryFn: () => physicalDevicesApi.getEventBusHealth(),
    enabled: physicalDevicesAvailable,
    refetchInterval: 30_000,
  });
  const smartHomeEntitiesQuery = useQuery({
    queryKey: queryKeys.backendSmartHomeEntities(smartHomeFilters),
    queryFn: () => smartHomeApi.listEntities(smartHomeFilters),
    enabled: smartHomeAvailable,
  });

  const physicalDevicesUnavailable =
    physicalAvailabilityQuery.data?.available === false ||
    isPhysicalDevicesModuleUnavailable(physicalDevicesQuery.error) ||
    isPhysicalDevicesModuleUnavailable(auditQuery.error) ||
    isPhysicalDevicesModuleUnavailable(busHealthQuery.error);
  const smartHomeUnavailable =
    smartHomeAvailabilityQuery.data?.available === false ||
    isSmartHomeModuleUnavailable(smartHomeEntitiesQuery.error);

  const physicalDevices = physicalDevicesQuery.data?.items ?? EMPTY_PHYSICAL_DEVICES;
  const smartHomeEntities = smartHomeEntitiesQuery.data?.items ?? EMPTY_SMART_HOME_ENTITIES;
  const allDevices = useMemo(() => {
    const capabilityQuery = capabilityFilter.trim();
    return [
      ...physicalDevices.map(physicalDeviceToDevice),
      ...smartHomeEntities.map(smartHomeEntityToDevice),
    ].filter((device) => matchesText(device, capabilityQuery));
  }, [capabilityFilter, physicalDevices, smartHomeEntities]);

  const selectedDevice = useMemo(() => {
    if (!allDevices.length) {
      return null;
    }
    return allDevices.find((device) => device.id === selectedDeviceId) ?? allDevices[0];
  }, [allDevices, selectedDeviceId]);
  const selectedPhysicalDeviceId =
    selectedDevice?.source === 'physical_devices' ? selectedDevice.nativeId : null;
  const stateQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDeviceState(selectedPhysicalDeviceId),
    queryFn: () => physicalDevicesApi.getState(selectedPhysicalDeviceId as string),
    enabled: physicalDevicesAvailable && Boolean(selectedPhysicalDeviceId),
  });
  const commandsQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDeviceCommands(selectedPhysicalDeviceId),
    queryFn: () => physicalDevicesApi.listCommands(selectedPhysicalDeviceId as string),
    enabled: physicalDevicesAvailable && Boolean(selectedPhysicalDeviceId),
  });
  const eventsQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDeviceEvents(selectedPhysicalDeviceId),
    queryFn: () => physicalDevicesApi.listEvents(selectedPhysicalDeviceId as string),
    enabled: physicalDevicesAvailable && Boolean(selectedPhysicalDeviceId),
  });

  const audit = auditQuery.data;
  const summary = audit?.summary;
  const adapterHealth = audit?.adapter_health ?? {};
  const effectivePolicy = audit?.effective_policy ?? {};
  const pendingApprovals = numberFromSummary(summary, 'pending_approval');
  const problemCommands = audit?.recent_problem_commands ?? EMPTY_AUDIT_ITEMS;
  const restrictedDevices = audit?.restricted_devices ?? EMPTY_AUDIT_ITEMS;
  const selectedCommands = commandsQuery.data?.items ?? EMPTY_COMMANDS;
  const selectedEvents = eventsQuery.data?.items ?? EMPTY_EVENTS;
  const selectedCommandSummary = useMemo(
    () => commandSummary(selectedCommands),
    [selectedCommands]
  );
  const selectedEventSummary = useMemo(() => eventSummary(selectedEvents), [selectedEvents]);
  const pendingApprovalItems = useMemo(
    () => [
      ...problemCommands.filter((item) => String(item.status ?? '') === 'pending_approval'),
      ...selectedCommands
        .filter((command) => command.status === 'pending_approval')
        .map((command) => ({
          command_id: command.command_id,
          command_type: command.command_type,
          device_id: command.device_id,
          requested_by: command.requested_by,
          status: command.status,
          created_at: command.created_at,
        })),
    ],
    [problemCommands, selectedCommands]
  );
  const isRefreshing =
    physicalAvailabilityQuery.isFetching ||
    smartHomeAvailabilityQuery.isFetching ||
    physicalDevicesQuery.isFetching ||
    smartHomeEntitiesQuery.isFetching ||
    auditQuery.isFetching ||
    busHealthQuery.isFetching;
  const noDeviceModulesAvailable =
    !physicalAvailabilityQuery.isLoading &&
    !smartHomeAvailabilityQuery.isLoading &&
    physicalDevicesUnavailable &&
    smartHomeUnavailable;

  function refreshAll() {
    void physicalAvailabilityQuery.refetch();
    void smartHomeAvailabilityQuery.refetch();
    if (physicalDevicesAvailable) {
      void physicalDevicesQuery.refetch();
      void auditQuery.refetch();
      void busHealthQuery.refetch();
    }
    if (smartHomeAvailable) {
      void smartHomeEntitiesQuery.refetch();
    }
    if (selectedPhysicalDeviceId) {
      void stateQuery.refetch();
      void commandsQuery.refetch();
      void eventsQuery.refetch();
    }
  }

  if (noDeviceModulesAvailable) {
    return (
      <DevicesUnavailable
        isRetrying={isRefreshing}
        onRetry={refreshAll}
        physicalReason={physicalAvailabilityQuery.data?.reason}
        smartHomeReason={smartHomeAvailabilityQuery.data?.reason}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Devices"
        description="Shared device operations across Smart Home entities and the Physical Devices canonical registry."
        meta={
          <>
            <Badge variant={smartHomeAvailable ? 'successful' : 'outline'}>
              Smart Home {smartHomeAvailable ? 'available' : 'not paired'}
            </Badge>
            <Badge variant={physicalDevicesAvailable ? 'successful' : 'outline'}>
              Physical Devices {physicalDevicesAvailable ? 'available' : 'not paired'}
            </Badge>
          </>
        }
        actions={
          <Button variant="outline" onClick={refreshAll} disabled={isRefreshing}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing ? 'animate-spin' : '')} />
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={DatabaseZap}
          label="Visible devices"
          value={allDevices.length}
          detail={`${physicalDevices.length} physical, ${smartHomeEntities.length} smart-home`}
        />
        <MetricCard
          icon={Home}
          label="Smart Home entities"
          value={smartHomeEntities.length}
          detail={smartHomeAvailable ? 'Home Assistant-backed entity view' : 'Module not paired'}
          tone={smartHomeAvailable ? 'good' : 'neutral'}
        />
        <MetricCard
          icon={Activity}
          label="Physical bus"
          value={physicalDevicesAvailable ? (busHealthQuery.data?.subscribers ?? 0) : 'Off'}
          detail={
            physicalDevicesAvailable
              ? busHealthQuery.data?.connected
                ? 'Physical bus connected'
                : 'Physical bus degraded'
              : 'Physical Devices not installed'
          }
          tone={physicalDevicesAvailable && busHealthQuery.data?.connected ? 'good' : 'warn'}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Pending approvals"
          value={physicalDevicesAvailable ? pendingApprovals : 'n/a'}
          detail={
            physicalDevicesAvailable
              ? `${restrictedDevices.length} restricted devices surfaced`
              : 'Requires Physical Devices'
          }
          tone={pendingApprovals > 0 ? 'warn' : 'neutral'}
        />
      </section>

      <ModuleStatusPanel
        physicalDevicesAvailable={physicalDevicesAvailable}
        physicalDevicesReason={physicalAvailabilityQuery.data?.reason}
        smartHomeAvailable={smartHomeAvailable}
        smartHomeReason={smartHomeAvailabilityQuery.data?.reason}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Device Inventory</CardTitle>
              <CardDescription>
                Filter by room or capability. Smart Home can populate this table even when Physical
                World is not installed.
              </CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Filter devices by room"
                placeholder="Filter room"
                value={roomFilter}
                onChange={(event) => setRoomFilter(event.target.value)}
              />
              <Input
                aria-label="Filter devices by capability"
                placeholder="Filter capability or domain"
                value={capabilityFilter}
                onChange={(event) => setCapabilityFilter(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {physicalDevicesQuery.isError || smartHomeEntitiesQuery.isError ? (
              <StateMessage
                title="Some device sources failed"
                detail="Available sources still render. Check backend availability and integration scopes for the failing source."
              />
            ) : physicalDevicesQuery.isLoading || smartHomeEntitiesQuery.isLoading ? (
              <StateMessage title="Loading devices" detail="Reading available device sources." />
            ) : allDevices.length === 0 ? (
              <StateMessage
                title="No devices found"
                detail="Try clearing filters, connecting Smart Home, or enabling the Physical Devices module."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDevices.map((device) => (
                    <TableRow
                      key={device.id}
                      className={cn(
                        'cursor-pointer',
                        selectedDevice?.id === device.id && 'bg-primary-50/70'
                      )}
                      onClick={() => setSelectedDeviceId(device.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{device.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {device.type} · {device.vendor}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {device.source === 'smart_home' ? 'Smart Home' : 'Physical Devices'}
                        </Badge>
                      </TableCell>
                      <TableCell>{device.room}</TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {capabilitySummary(device)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
                          <Badge variant={statusVariant(device.lifecycleStatus)}>
                            {device.lifecycleStatus}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Command Audit</CardTitle>
              <CardDescription>
                Recent policy, expiry, rejection, or failure signals from Physical Devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!physicalDevicesAvailable ? (
                <StateMessage
                  title="Physical Devices not installed"
                  detail="Smart Home devices can still be inspected, but canonical command audit requires Physical Devices."
                />
              ) : problemCommands.length === 0 ? (
                <StateMessage
                  title="No recent command problems"
                  detail="Audit route returned no failed or rejected commands."
                />
              ) : (
                problemCommands
                  .slice(0, 5)
                  .map((item, index) => (
                    <AuditRow key={`${String(item.command_id ?? index)}`} item={item} />
                  ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval Queue</CardTitle>
              <CardDescription>
                Pending physical device actions that still require guarded handling.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!physicalDevicesAvailable ? (
                <StateMessage
                  title="No Physical Devices approvals"
                  detail="Approval queue visibility is available after the Physical Devices module is installed."
                />
              ) : (
                <ApprovalQueuePanel items={pendingApprovalItems} pendingCount={pendingApprovals} />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Selected Device Detail</CardTitle>
                <CardDescription>
                  Smart Home devices show entity metadata. Physical Devices entries also show
                  canonical state, command history, and event history.
                </CardDescription>
              </div>
              {selectedDevice ? (
                <Badge variant="outline">{selectedDevice.name}</Badge>
              ) : (
                <Badge variant="outline">No device selected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedDevice ? (
              <StateMessage
                title="No device selected"
                detail="Select a device from the inventory table."
              />
            ) : selectedDevice.source === 'smart_home' ? (
              <SmartHomeDeviceDetail device={selectedDevice} />
            ) : (
              <div className="space-y-4">
                <DeviceDetailSummary
                  commandSummary={selectedCommandSummary}
                  eventSummary={selectedEventSummary}
                />
                <div className="grid gap-4 xl:grid-cols-3">
                  <DeviceStatePanel state={stateQuery.data} isLoading={stateQuery.isLoading} />
                  <CommandHistoryPanel
                    commands={selectedCommands}
                    isLoading={commandsQuery.isLoading}
                  />
                  <EventHistoryPanel events={selectedEvents} isLoading={eventsQuery.isLoading} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {physicalDevicesAvailable ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <DiagnosticsCard
            title="Adapter Health"
            description="Backend-reported integration health for physical device adapters."
            value={adapterHealth}
            emptyDetail="No adapter health diagnostics were returned in the current audit window."
          />
          <DiagnosticsCard
            title="Effective Policy"
            description="Read-only view of active physical-command safety gates."
            value={effectivePolicy}
            emptyDetail="No effective physical policy payload was returned by the backend."
          />
        </section>
      ) : null}
    </div>
  );
}

function ModuleStatusPanel({
  physicalDevicesAvailable,
  physicalDevicesReason,
  smartHomeAvailable,
  smartHomeReason,
}: {
  physicalDevicesAvailable: boolean;
  physicalDevicesReason?: string | null;
  smartHomeAvailable: boolean;
  smartHomeReason?: string | null;
}) {
  if (physicalDevicesAvailable && smartHomeAvailable) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10">
      <CardContent className="flex flex-col gap-4 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">Device operations are source-aware.</p>
          <p>
            {!smartHomeAvailable
              ? smartHomeReason || 'Smart Home is not paired on this backend.'
              : 'Smart Home is available.'}{' '}
            {!physicalDevicesAvailable
              ? physicalDevicesReason || 'Physical Devices is not paired on this backend.'
              : 'Physical Devices is available.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!smartHomeAvailable ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/integrations/smart-home">Set up Smart Home</Link>
            </Button>
          ) : null}
          {!physicalDevicesAvailable ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/operations/physical-devices">Set up Physical Devices</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DevicesUnavailable({
  isRetrying,
  onRetry,
  physicalReason,
  smartHomeReason,
}: {
  isRetrying: boolean;
  onRetry: () => void;
  physicalReason?: string | null;
  smartHomeReason?: string | null;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Devices"
        description="Device operations need at least one device source: Smart Home or Physical Devices."
        meta={<Badge variant="outline">No device source paired</Badge>}
        actions={
          <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isRetrying ? 'animate-spin' : '')} />
            Retry
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>No Device Module Paired</CardTitle>
          <CardDescription>
            {smartHomeReason || 'Smart Home is not available.'}{' '}
            {physicalReason || 'Physical Devices is not available.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/integrations/smart-home">Set up Smart Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/operations/physical-devices">Set up Physical Devices</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone = 'neutral',
  value,
}: {
  detail: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: 'neutral' | 'good' | 'warn';
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            'rounded-xl border p-3',
            tone === 'good' && 'border-success-200 bg-success-50 text-success-800',
            tone === 'warn' && 'border-warning-200 bg-warning-50 text-warning-900',
            tone === 'neutral' && 'border-primary-100 bg-primary-50 text-primary-800'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StateMessage({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-muted-foreground">{detail}</div>
    </div>
  );
}

function SmartHomeDeviceDetail({ device }: { device: UnifiedDevice }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-lg border p-4">
        <div className="mb-3 text-sm font-semibold">Entity Summary</div>
        <div className="space-y-2 text-sm">
          <SummaryRow label="Entity id" value={device.nativeId} />
          <SummaryRow label="Domain" value={device.capabilities[0] ?? device.type} />
          <SummaryRow label="Room" value={device.room} />
          <SummaryRow label="State" value={device.status} />
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <div className="mb-3 text-sm font-semibold">Entity Attributes</div>
        <JsonPreview value={device.metadata ?? {}} />
      </div>
    </div>
  );
}

function DeviceDetailSummary({
  commandSummary,
  eventSummary,
}: {
  commandSummary: DeviceCommandSummary;
  eventSummary: DeviceEventSummary;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SummaryPill label="Commands" value={commandSummary.total} detail="total recorded" />
      <SummaryPill
        label="Pending / failed"
        value={`${commandSummary.pending} / ${commandSummary.failed}`}
        detail="approval or failure attention"
        tone={commandSummary.pending + commandSummary.failed > 0 ? 'warn' : 'good'}
      />
      <SummaryPill label="Events" value={eventSummary.total} detail="total recorded" />
      <SummaryPill
        label="Latest event"
        value={eventSummary.latestType}
        detail={eventSummary.latestAt}
      />
    </div>
  );
}

function SummaryPill({
  detail,
  label,
  tone = 'neutral',
  value,
}: {
  detail: string;
  label: string;
  tone?: 'neutral' | 'good' | 'warn';
  value: number | string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        tone === 'good' && 'border-success-200 bg-success-50/60',
        tone === 'warn' && 'border-warning-200 bg-warning-50/60',
        tone === 'neutral' && 'bg-muted/20'
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function ApprovalQueuePanel({
  items,
  pendingCount,
}: {
  items: Array<Record<string, unknown>>;
  pendingCount: number;
}) {
  if (pendingCount === 0 && items.length === 0) {
    return (
      <StateMessage
        title="No pending approvals"
        detail="No physical commands are currently waiting for human approval."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning-200 bg-warning-50/40 p-3 text-sm text-warning-900">
        <div className="font-medium">{pendingCount || items.length} awaiting human approval</div>
        <div className="mt-1 text-xs">
          This panel is visibility-only. Approve, reject, retry, and cancel operations remain
          backend-guarded.
        </div>
      </div>
      {items.length === 0 ? (
        <StateMessage
          title="Approval details unavailable"
          detail="Audit summary reports pending approvals, but no command rows were returned in the current window."
        />
      ) : (
        items
          .slice(0, 5)
          .map((item, index) => (
            <AuditRow key={`${String(item.command_id ?? index)}`} item={item} />
          ))
      )}
    </div>
  );
}

function DiagnosticsCard({
  description,
  emptyDetail,
  title,
  value,
}: {
  description: string;
  emptyDetail: string;
  title: string;
  value: Record<string, unknown>;
}) {
  const entries = Object.entries(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <StateMessage title={`No ${title.toLowerCase()}`} detail={emptyDetail} />
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 8).map(([key, item]) => (
              <DiagnosticRow key={key} label={key} value={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: unknown }) {
  const rendered =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);

  return (
    <div className="rounded-lg border p-3">
      <div className="text-sm font-medium">{humanizeKey(label)}</div>
      <div className="mt-1 break-words text-xs text-muted-foreground">{rendered}</div>
    </div>
  );
}

function DeviceStatePanel({
  isLoading,
  state,
}: {
  isLoading: boolean;
  state: PhysicalDeviceState | undefined;
}) {
  if (isLoading) {
    return <StateMessage title="Loading state" detail="Reading latest canonical state." />;
  }
  if (!state) {
    return (
      <StateMessage
        title="No state recorded"
        detail="No canonical state exists for this device yet."
      />
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 text-sm font-semibold">Current State</div>
      <div className="space-y-2 text-sm">
        <SummaryRow label="Online" value={state.online ? 'Yes' : 'No'} />
        <SummaryRow
          label="Battery"
          value={state.battery_level == null ? 'Unknown' : `${state.battery_level}%`}
        />
        <SummaryRow label="Network" value={state.network_status ?? 'Unknown'} />
        <SummaryRow label="Activity" value={state.current_activity ?? 'Idle / unknown'} />
        <SummaryRow label="Telemetry" value={formatDateTime(state.last_telemetry_at)} />
      </div>
      <JsonPreview value={state.sensor_values ?? {}} />
    </div>
  );
}

function CommandHistoryPanel({
  commands,
  isLoading,
}: {
  commands: PhysicalDeviceCommand[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <StateMessage title="Loading commands" detail="Reading command audit history." />;
  }
  if (commands.length === 0) {
    return (
      <StateMessage
        title="No commands recorded"
        detail="No command history exists for this device yet."
      />
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 text-sm font-semibold">Command History</div>
      <div className="space-y-3">
        {commands.slice(0, 6).map((command) => (
          <TimelineRow
            key={command.command_id}
            title={command.command_type}
            subtitle={`${command.priority} priority · ${command.requested_by}`}
            status={command.status}
            timestamp={command.created_at}
          />
        ))}
      </div>
    </div>
  );
}

function EventHistoryPanel({
  events,
  isLoading,
}: {
  events: PhysicalDeviceEvent[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <StateMessage title="Loading events" detail="Reading physical event history." />;
  }
  if (events.length === 0) {
    return (
      <StateMessage
        title="No events recorded"
        detail="No event history exists for this device yet."
      />
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 text-sm font-semibold">Event History</div>
      <div className="space-y-3">
        {events.slice(0, 6).map((event) => (
          <TimelineRow
            key={event.event_id}
            title={event.event_type}
            subtitle={event.source}
            status={event.correlation_id ?? 'event'}
            timestamp={event.timestamp}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function TimelineRow({
  status,
  subtitle,
  timestamp,
  title,
}: {
  status: string;
  subtitle: string;
  timestamp: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
          <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(timestamp)}</div>
        </div>
        <Badge variant={statusVariant(status)}>{status}</Badge>
      </div>
    </div>
  );
}

function JsonPreview({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <div className="mt-3 text-xs text-muted-foreground">No attributes recorded.</div>;
  }

  return (
    <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function humanizeKey(value: string) {
  return value.replaceAll('_', ' ');
}

function commandSummary(commands: PhysicalDeviceCommand[]): DeviceCommandSummary {
  return {
    total: commands.length,
    pending: commands.filter((command) => command.status === 'pending_approval').length,
    failed: commands.filter((command) =>
      ['failed', 'rejected', 'cancelled', 'expired'].includes(command.status)
    ).length,
  };
}

function eventSummary(events: PhysicalDeviceEvent[]): DeviceEventSummary {
  const latest = [...events].sort((left, right) =>
    String(right.timestamp).localeCompare(String(left.timestamp))
  )[0];
  return {
    total: events.length,
    latestType: latest?.event_type ?? 'None',
    latestAt: latest ? formatDateTime(latest.timestamp) : 'No events recorded',
  };
}

function AuditRow({ item }: { item: Record<string, unknown> }) {
  const title = String(item.device_name ?? item.device_id ?? item.command_id ?? 'Physical event');
  const status = String(
    item.status ?? item.policy_category ?? item.policy_decision ?? 'diagnostic'
  );
  const reason = String(
    item.policy_reason ?? item.reason ?? item.command_type ?? item.event_type ?? ''
  );

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          {reason ? (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{reason}</div>
          ) : null}
        </div>
        <Badge variant="outline">{status}</Badge>
      </div>
    </div>
  );
}
