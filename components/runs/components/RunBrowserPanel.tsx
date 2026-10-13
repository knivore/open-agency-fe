"use client";

import {useEffect, useRef, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {agencyApiClient} from '@/lib/api/clientInstances';
import {Button} from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/library/shadcn/card';

type BrowserSession = { session_id: string; current_url?: string; status: string };

type BrowserPanelProps = { runId: string; conversationId?: never } | {
  conversationId: string;
  runId?: never
};

export default function RunBrowserPanel({runId, conversationId}: BrowserPanelProps) {
  const scope = conversationId ? 'conversation' : 'run';
  const label = conversationId ? 'conversation' : 'run';
  const id = conversationId ?? runId!;
  const base = `/${conversationId ? 'conversations' : 'executions'}/${encodeURIComponent(id)}/browser-sessions`;
  const [selected, setSelected] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const sessions = useQuery({
    queryKey: ['browser-sessions', scope, id],
    queryFn: ({signal}) => agencyApiClient.get<{ sessions: BrowserSession[] }>(base, {signal}),
    retry: false,
  });
  const active = sessions.data?.sessions.find((session) => session.session_id === selected);
  const activeSessionId = active?.session_id;
  const snapshot = useQuery({
    queryKey: ['browser-snapshot', scope, id, active?.session_id],
    enabled: Boolean(active),
    retry: false,
    gcTime: 0,
    queryFn: async ({signal}) => {
      const response = await agencyApiClient.get<Response>(`${base}/${encodeURIComponent(active!.session_id)}/screenshot`, {
        responseType: 'raw',
        signal,
        cache: 'no-store'
      });
      return response.blob();
    },
  });
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !snapshot.data || !activeSessionId || snapshot.isError) return;
    // Private blobs belong to this image's lifetime, not another render's state.
    const url = URL.createObjectURL(snapshot.data);
    image.src = url;
    return () => {
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [snapshot.data, activeSessionId, snapshot.isError]);
  const close = useMutation({
    mutationFn: (id: string) => agencyApiClient.delete(`${base}/${encodeURIComponent(id)}`),
    onSuccess: async () => {
      setSelected(null);
      await sessions.refetch();
    },
  });
  return <Card>
    <CardHeader>
      <CardTitle>Browser sessions</CardTitle>
      <CardDescription>View the managed browser used by this {label}. These are refreshable
        snapshots; interacting with the page remains an agent action.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div><Button variant="outline" disabled={sessions.isFetching}
                   onClick={() => void sessions.refetch()}>Refresh sessions</Button></div>
      {sessions.isPending && <p role="status">Loading browser sessions…</p>}
      {sessions.isError &&
        <p role="alert">Browser sessions are unavailable or you do not have access to
          this {label}.</p>}
      {sessions.data?.sessions.length === 0 &&
        <p>No open browser sessions for this {label}. Sessions may close when work finishes.</p>}
      {sessions.data?.sessions.map((session) => <div key={session.session_id}
                                                     className="flex flex-wrap items-center gap-3 rounded-md border p-3">
        <div className="min-w-0 flex-1"><p
          className="break-all">{session.current_url || 'Browser page'}</p><p
          className="text-sm text-muted-foreground">{session.status}</p></div>
        <Button variant="outline" onClick={() => setSelected(session.session_id)}>View page</Button>
        <Button variant="outline" disabled={close.isPending}
                onClick={() => close.mutate(session.session_id)}>Close session</Button>
      </div>)}
      {close.isError &&
        <p role="alert">Could not close the session. Refresh its status and try again.</p>}
      {active && <div className="flex flex-col gap-3">
        <div><Button variant="outline" disabled={snapshot.isFetching}
                     onClick={() => void snapshot.refetch()}>Refresh page image</Button></div>
        {snapshot.isFetching && <p role="status">Capturing page…</p>}
        {snapshot.isError &&
          <p role="alert">The page image is unavailable. The session may have ended.</p>}
        {/* Private authenticated blobs must bypass Next's public image optimizer. */}
        {snapshot.data && !snapshot.isError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={imageRef} alt={`Browser snapshot: ${active.current_url || 'current page'}`}
               className="h-auto w-full rounded-md border"/>
        )}
      </div>}
      <p className="text-sm text-muted-foreground">Closing a session does not stop other agent
        work. {conversationId ? 'Use the chat stop control to interrupt the current response; linked goals and runs have their own stop controls.' : 'Use the run’s Cancel control to request that all work stops.'} Already
        submitted actions cannot be undone.</p>
    </CardContent>
  </Card>;
}
