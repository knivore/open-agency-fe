import { Badge } from '@/components/library/shadcn/badge';
import { Card, CardContent } from '@/components/library/shadcn/card';
import type { ToolContract } from '@/types/toolContracts';

function riskLabelsFor(contract: ToolContract) {
  return contract.riskLabels ?? contract.risk_labels ?? [];
}

export default function ToolContractList({
  contracts,
  selectedName,
  onSelect,
}: {
  contracts: ToolContract[];
  selectedName?: string;
  onSelect: (toolName: string) => void;
}) {
  if (!contracts.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-neutral-500">
          No tool contracts returned by the backend.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {contracts.map((contract) => {
        const selected = contract.name === selectedName;
        const riskLabels = riskLabelsFor(contract);
        return (
          <button
            key={contract.name}
            type="button"
            onClick={() => onSelect(contract.name)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              selected
                ? 'agency-gradient border-primary-500 text-white shadow-lg shadow-primary/20'
                : 'border-primary-100 bg-white hover:border-primary-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{contract.name}</p>
                <p
                  className={`mt-2 line-clamp-3 text-sm ${selected ? 'text-slate-200' : 'text-neutral-600'}`}
                >
                  {contract.description || 'No description provided.'}
                </p>
                {riskLabels.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {riskLabels.slice(0, 4).map((label) => (
                      <Badge
                        key={label}
                        variant={selected ? 'secondary' : 'outline'}
                        className="font-mono text-[11px]"
                      >
                        {label}
                      </Badge>
                    ))}
                    {riskLabels.length > 4 ? (
                      <Badge
                        variant={selected ? 'secondary' : 'outline'}
                        className="font-mono text-[11px]"
                      >
                        +{riskLabels.length - 4}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <Badge variant={selected ? 'secondary' : 'outline'}>v{contract.version}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
