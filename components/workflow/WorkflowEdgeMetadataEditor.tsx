'use client';

import { Button } from '../library/shadcn/button';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';

type MetadataValueType = 'string' | 'number' | 'boolean' | 'null';

interface MetadataField {
  id: string;
  key: string;
  valueType: MetadataValueType;
  value: string;
}

interface WorkflowEdgeMetadataEditorProps {
  idPrefix: string;
  metadataJson: string;
  metadataError?: string;
  onChange: (metadataJson: string) => void;
}

function inferValueType(value: unknown): MetadataValueType {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  return 'string';
}

function serializeMetadataFields(fields: MetadataField[]) {
  const nextObject = fields.reduce<Record<string, string | number | boolean | null>>(
    (accumulator, field) => {
      const normalizedKey = field.key.trim();
      if (!normalizedKey) {
        return accumulator;
      }

      if (field.valueType === 'null') {
        accumulator[normalizedKey] = null;
        return accumulator;
      }

      if (field.valueType === 'boolean') {
        accumulator[normalizedKey] = field.value === 'true';
        return accumulator;
      }

      if (field.valueType === 'number') {
        const parsedNumber = Number(field.value);
        accumulator[normalizedKey] = Number.isFinite(parsedNumber) ? parsedNumber : 0;
        return accumulator;
      }

      accumulator[normalizedKey] = field.value;
      return accumulator;
    },
    {}
  );

  return Object.keys(nextObject).length > 0 ? JSON.stringify(nextObject, null, 2) : '';
}

function getStructuredMetadataState(metadataJson: string) {
  const trimmed = metadataJson.trim();
  if (!trimmed) {
    return {
      mode: 'flat' as const,
      fields: [] as MetadataField[],
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        mode: 'invalid' as const,
        fields: [] as MetadataField[],
      };
    }

    const entries = Object.entries(parsed);
    const hasComplexValue = entries.some(
      ([, value]) => value !== null && typeof value === 'object'
    );
    if (hasComplexValue) {
      return {
        mode: 'complex' as const,
        fields: [] as MetadataField[],
      };
    }

    return {
      mode: 'flat' as const,
      fields: entries.map(([key, value], index) => ({
        id: `field-${index}-${key}`,
        key,
        valueType: inferValueType(value),
        value: value === null ? '' : String(value),
      })),
    };
  } catch {
    return {
      mode: 'invalid' as const,
      fields: [] as MetadataField[],
    };
  }
}

export default function WorkflowEdgeMetadataEditor({
  idPrefix,
  metadataJson,
  metadataError,
  onChange,
}: WorkflowEdgeMetadataEditorProps) {
  const structuredMetadata = getStructuredMetadataState(metadataJson);

  const updateField = (fieldId: string, updates: Partial<MetadataField>) => {
    if (structuredMetadata.mode !== 'flat') {
      return;
    }

    const nextFields = structuredMetadata.fields.map((field) =>
      field.id === fieldId ? { ...field, ...updates } : field
    );
    onChange(serializeMetadataFields(nextFields));
  };

  const removeField = (fieldId: string) => {
    if (structuredMetadata.mode !== 'flat') {
      return;
    }

    onChange(
      serializeMetadataFields(structuredMetadata.fields.filter((field) => field.id !== fieldId))
    );
  };

  const addField = () => {
    if (structuredMetadata.mode !== 'flat') {
      return;
    }

    onChange(
      serializeMetadataFields([
        ...structuredMetadata.fields,
        {
          id: `field-new-${structuredMetadata.fields.length + 1}`,
          key: '',
          valueType: 'string',
          value: '',
        },
      ])
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-metadata-json`}>Metadata</Label>
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          Use structured top-level fields for normal metadata. Raw JSON remains available for nested
          or advanced cases.
        </p>
      </div>

      {structuredMetadata.mode === 'flat' ? (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
              Structured Fields
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              Add Field
            </Button>
          </div>
          {structuredMetadata.fields.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-slate-400">No metadata fields yet.</p>
          ) : (
            structuredMetadata.fields.map((field) => (
              <div
                key={field.id}
                className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_140px_minmax(0,1fr)_auto]"
              >
                <Input
                  value={field.key}
                  onChange={(event) => updateField(field.id, { key: event.target.value })}
                  placeholder="Key"
                />
                <select
                  value={field.valueType}
                  onChange={(event) =>
                    updateField(field.id, {
                      valueType: event.target.value as MetadataValueType,
                      value: event.target.value === 'boolean' ? 'false' : '',
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="null">null</option>
                </select>
                {field.valueType === 'boolean' ? (
                  <select
                    value={field.value || 'false'}
                    onChange={(event) => updateField(field.id, { value: event.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : field.valueType === 'null' ? (
                  <div className="flex h-10 items-center rounded-md border border-dashed border-neutral-300 px-3 text-sm text-neutral-500 dark:border-white/10 dark:text-slate-400">
                    null
                  </div>
                ) : (
                  <Input
                    value={field.value}
                    onChange={(event) => updateField(field.id, { value: event.target.value })}
                    placeholder={field.valueType === 'number' ? '0' : 'Value'}
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeField(field.id)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-100">
          {structuredMetadata.mode === 'complex'
            ? 'Structured fields are only available for flat top-level metadata. This edge currently contains nested JSON, so edit it in raw JSON mode below.'
            : 'Structured fields are unavailable until the metadata JSON is valid.'}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-metadata-json`}>Raw JSON</Label>
        <Textarea
          id={`${idPrefix}-metadata-json`}
          value={metadataJson}
          onChange={(event) => onChange(event.target.value)}
          placeholder='Edge metadata JSON, e.g. {"priority":"high"}'
          className={`min-h-28 ${metadataError ? 'border-red-500' : ''}`}
        />
        {metadataError ? (
          <p className="text-xs text-red-600 dark:text-red-300">Metadata {metadataError}</p>
        ) : null}
      </div>
    </div>
  );
}
