'use client';

import { useMemo, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, DatabaseZap, RefreshCw, ShieldCheck } from 'lucide-react';
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
import { queryKeys } from '@/lib/react-query/queryKeys';
import { cn } from '@/lib/utils';

const EMPTY_DEVICES: PhysicalDevice[] = [];
const EMPTY_COMMANDS: PhysicalDeviceCommand[] = [];
const EMPTY_EVENTS: PhysicalDeviceEvent[] = [];
const EMPTY_AUDIT_ITEMS: Array<Record<string, unknown>> = [];

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
  if (status === 'online' || status === 'active') {
    return 'successful' as const;
  }
  if (status === 'offline' || status === 'disabled' || status === 'unknown') {
    return 'failed' as const;
  }
  return 'outline' as const;
}

function capabilitySummary(device: PhysicalDevice) {
  if (!device.capabilities.length) {
    return 'No capabilities';
  }
  return device.capabilities.slice(0, 3).join(', ');
}

export default function PhysicalDevicesWorkspace() {
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
  const availabilityQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDevicesAvailability(),
    queryFn: () => physicalDevicesApi.getAvailability(),
    staleTime: 60 * 1000,
    retry: 1,
  });
  const physicalDevicesAvailable = availabilityQuery.data?.available === true;

  const devicesQuery = useQuery({
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
  const moduleUnavailable =
    availabilityQuery.data?.available === false ||
    isPhysicalDevicesModuleUnavailable(devicesQuery.error) ||
    isPhysicalDevicesModuleUnavailable(auditQuery.error) ||
    isPhysicalDevicesModuleUnavailable(busHealthQuery.error);

  const devices = devicesQuery.data?.items ?? EMPTY_DEVICES;
  const selectedDevice = useMemo(() => {
    if (!devices.length) {
      return null;
    }
    return devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  }, [devices, selectedDeviceId]);
  const selectedDeviceKey = selectedDevice?.id ?? null;
  const stateQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDeviceState(selectedDeviceKey),
    queryFn: () => physicalDevicesApi.getState(selectedDeviceKey as string),
    enabled: physicalDevicesAvailable && Boolean(selectedDeviceKey),
  });
  const commandsQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDeviceCommands(selectedDeviceKey),
    queryFn: () => physicalDevicesApi.listCommands(selectedDeviceKey as string),
    enabled: physicalDevicesAvailable && Boolean(selectedDeviceKey),
  });
  const eventsQuery = useQuery({
    queryKey: queryKeys.backendPhysicalDeviceEvents(selectedDeviceKey),
    queryFn: () => physicalDevicesApi.listEvents(selectedDeviceKey as string),
    enabled: physicalDevicesAvailable && Boolean(selectedDeviceKey),
  });
  const audit = auditQuery.data;
  const summary = audit?.summary;
  const adapterHealth = audit?.adapter_health ?? {};
  const effectivePolicy = audit?.effective_policy ?? {};
  const totalDevices = numberFromSummary(summary, 'total_devices') || devices.length;
  const offlineDevices = numberFromSummary(summary, 'offline_devices');
  const staleDevices = numberFromSummary(summary, 'stale_devices');
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
    availabilityQuery.isFetching ||
    devicesQuery.isFetching ||
    auditQuery.isFetching ||
    busHealthQuery.isFetching;

  if (moduleUnavailable) {
    return (
      <PhysicalDevicesUnavailable
        reason={availabilityQuery.data?.reason}
        onRetry={refreshAll}
        isRetrying={isRefreshing}
      />
    );
  }

  function refreshAll() {
    void availabilityQuery.refetch();
    if (!physicalDevicesAvailable) {
      return;
    }
    void devicesQuery.refetch();
    void auditQuery.refetch();
    void busHealthQuery.refetch();
    if (selectedDeviceKey) {
      void stateQuery.refetch();
      void commandsQuery.refetch();
      void eventsQuery.refetch();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Physical Devices"
        description="Read-only device registry, command audit, safety diagnostics, and physical event bus health."
        meta={
          <>
            <Badge variant={busHealthQuery.data?.connected ? 'successful' : 'failed'}>
              Bus {busHealthQuery.data?.provider ?? 'unknown'}
            </Badge>
            <Badge variant="outline">{totalDevices} devices</Badge>
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
          label="Registered devices"
          value={totalDevices}
          detail={`${devices.length} visible with current filters`}
        />
        <MetricCard
          icon={Activity}
          label="Bus subscribers"
          value={busHealthQuery.data?.subscribers ?? 0}
          detail={
            busHealthQuery.data?.connected ? 'Physical bus connected' : 'Physical bus degraded'
          }
          tone={busHealthQuery.data?.connected ? 'good' : 'warn'}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Offline or stale"
          value={offlineDevices + staleDevices}
          detail={`${offlineDevices} offline, ${staleDevices} stale`}
          tone={offlineDevices + staleDevices > 0 ? 'warn' : 'good'}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Pending approvals"
          value={pendingApprovals}
          detail={`${restrictedDevices.length} restricted devices surfaced`}
          tone={pendingApprovals > 0 ? 'warn' : 'good'}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Canonical Devices</CardTitle>
              <CardDescription>
                Filter by room or capability. Commands remain backend- and approval-gated.
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
                placeholder="Filter capability"
                value={capabilityFilter}
                onChange={(event) => setCapabilityFilter(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {devicesQuery.isError ? (
              <StateMessage
                title="Unable to load devices"
                detail="Check backend availability and integration scopes."
              />
            ) : devicesQuery.isLoading ? (
              <StateMessage title="Loading devices" detail="Reading canonical registry." />
            ) : devices.length === 0 ? (
              <StateMessage
                title="No devices found"
                detail="Try clearing filters or refreshing Home Assistant mapping."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
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
                          {device.type} · {device.vendor || 'canonical'}
                        </div>
                      </TableCell>
                      <TableCell>{device.room || device.zone || 'Unassigned'}</TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {capabilitySummary(device)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
                          <Badge variant={statusVariant(device.lifecycle_status)}>
                            {device.lifecycle_status}
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
                Recent policy, expiry, rejection, or failure signals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {problemCommands.length === 0 ? (
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
              <ApprovalQueuePanel items={pendingApprovalItems} pendingCount={pendingApprovals} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Safety Surface</CardTitle>
              <CardDescription>
                Restricted capability exposure from backend diagnostics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {restrictedDevices.length === 0 ? (
                <StateMessage
                  title="No restricted devices surfaced"
                  detail="Locks, climate, cameras, and robots are still policy-gated."
                />
              ) : (
                restrictedDevices
                  .slice(0, 5)
                  .map((item, index) => (
                    <AuditRow key={`${String(item.device_id ?? index)}`} item={item} />
                  ))
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
                  Read-only state, command history, and event history for operator review.
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
                detail="Select a device from the registry table."
              />
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
    </div>
  );
}

function PhysicalDevicesUnavailable({
  isRetrying,
  onRetry,
  reason,
}: {
  isRetrying: boolean;
  onRetry: () => void;
  reason?: string | null;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Physical Devices"
        description="Physical-devices backend capabilities are not available in the currently paired backend."
        meta={<Badge variant="outline">Module unavailable</Badge>}
        actions={
          <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isRetrying ? 'animate-spin' : '')} />
            Retry
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Physical-World Module Not Paired</CardTitle>
          <CardDescription>
            {reason ||
              'The frontend is running normally, but the paired backend does not expose the canonical physical-devices routes.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StateMessage
            title="No physical-devices backend detected"
            detail="This page will become available when the paired backend enables the physical device and physical event routes. Other Open Agency pages and tools remain usable."
          />
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
    return <div className="mt-3 text-xs text-muted-foreground">No sensor values recorded.</div>;
  }

  return (
    <pre className="mt-3 max-h-36 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
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
