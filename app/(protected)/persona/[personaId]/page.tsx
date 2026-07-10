import PersonaFactoryWorkspace from '@/components/persona-factory/PersonaFactoryWorkspace';

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;

  return <PersonaFactoryWorkspace initialPersonaId={personaId} viewMode="detail" />;
}
