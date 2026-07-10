'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { assistantProviderMetadata } from '@/lib/assistant/providerManifest';
import type { JsonObject } from '@/types/api';

export type AssistantPageSurface =
  | 'assistant'
  | 'workflow.list'
  | 'workflow.detail'
  | 'agent.list'
  | 'runtime'
  | 'runs.list'
  | 'runs.detail'
  | 'integrations'
  | 'integrations.operations'
  | 'memory'
  | 'marketplace'
  | 'unknown';

export interface AssistantPageEntity extends JsonObject {
  type: string;
  id: string;
  name?: string | null;
}

export interface AssistantPageSelection extends JsonObject {
  tab?: string | null;
  mode?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  approvalRequestId?: string | null;
  workflowId?: string | null;
  taskId?: string | null;
  agentId?: string | null;
  toolId?: string | null;
  toolIds?: string[];
  memoryId?: string | null;
  edgeId?: string | null;
  runId?: string | null;
}

export interface AssistantPageContextSnapshot extends JsonObject {
  surface: AssistantPageSurface;
  route: string;
  pathname: string;
  title?: string | null;
  description?: string | null;
  entities?: AssistantPageEntity[];
  selection?: AssistantPageSelection;
  summary?: JsonObject;
  allowedActions?: string[];
  recentRoutes?: string[];
  updatedAt: string;
}

interface AssistantPageContextInput extends JsonObject {
  surface: AssistantPageSurface;
  route?: string;
  pathname?: string;
  title?: string | null;
  description?: string | null;
  entities?: AssistantPageEntity[];
  selection?: AssistantPageSelection;
  summary?: JsonObject;
  allowedActions?: string[];
  recentRoutes?: string[];
}

interface AssistantPageContextValue {
  pageContext: AssistantPageContextSnapshot;
  setPageContext: (context: AssistantPageContextInput) => void;
  resetPageContext: () => void;
}

const AssistantPageContext = createContext<AssistantPageContextValue | null>(null);

function compactJsonObject(value: JsonObject | undefined) {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as JsonObject;
}

function compactContext(context: AssistantPageContextSnapshot): AssistantPageContextSnapshot {
  return {
    ...context,
    entities: context.entities?.length ? context.entities : undefined,
    selection: compactJsonObject(context.selection),
    summary: compactJsonObject(context.summary),
    allowedActions: context.allowedActions?.length ? context.allowedActions : undefined,
    recentRoutes: context.recentRoutes?.length ? context.recentRoutes : undefined,
  };
}

function routeFrom(pathname: string, searchParams: { toString: () => string }) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function defaultPageContext(pathname: string, searchParams: { toString: () => string }) {
  return compactContext({
    surface: pathname === '/assistant' ? 'assistant' : 'unknown',
    route: routeFrom(pathname, searchParams),
    pathname,
    title: null,
    updatedAt: new Date().toISOString(),
  });
}

export function AssistantPageContextProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = routeFrom(pathname, searchParams);
  const [registeredContext, setRegisteredContext] = useState<AssistantPageContextInput | null>(
    null
  );
  const effectiveRegisteredContext =
    registeredContext?.pathname === pathname ? registeredContext : null;
  const recentRoutes = useMemo(() => [route], [route]);

  const pageContext = useMemo(() => {
    if (!effectiveRegisteredContext) {
      return compactContext({
        ...defaultPageContext(pathname, searchParams),
        recentRoutes,
      });
    }

    return compactContext({
      ...effectiveRegisteredContext,
      route: effectiveRegisteredContext.route ?? route,
      pathname: effectiveRegisteredContext.pathname ?? pathname,
      recentRoutes,
      updatedAt: new Date().toISOString(),
    });
  }, [effectiveRegisteredContext, pathname, recentRoutes, route, searchParams]);
  const setPageContext = useCallback(
    (context: AssistantPageContextInput) => {
      setRegisteredContext({ ...context, pathname: context.pathname ?? pathname });
    },
    [pathname]
  );
  const resetPageContext = useCallback(() => {
    setRegisteredContext(null);
  }, []);

  const value = useMemo<AssistantPageContextValue>(
    () => ({
      pageContext,
      setPageContext,
      resetPageContext,
    }),
    [pageContext, resetPageContext, setPageContext]
  );

  return <AssistantPageContext.Provider value={value}>{children}</AssistantPageContext.Provider>;
}
export function useRegisterAssistantPageContext(context: AssistantPageContextInput) {
  const assistantContext = useContext(AssistantPageContext);
  const setPageContext = assistantContext?.setPageContext;
  const resetPageContext = assistantContext?.resetPageContext;
  const contextSignature = JSON.stringify(context);

  useEffect(() => {
    if (!setPageContext) {
      return;
    }

    setPageContext(context);
    // Use the serialized signature so equivalent inline context objects do not re-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextSignature, setPageContext]);

  useEffect(() => {
    if (!resetPageContext) {
      return;
    }

    return resetPageContext;
  }, [resetPageContext]);
}

export function useAssistantPageContextMetadata() {
  const assistantContext = useContext(AssistantPageContext);
  const pageContext = assistantContext?.pageContext;
  return useCallback(
    () =>
      pageContext
        ? {
            page_context: pageContext,
            ...assistantProviderMetadata(pageContext),
          }
        : {},
    [pageContext]
  );
}
