import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  JsonValue,
  UserInputField,
  UserInputForm,
} from "@/lib/ai/workflows/types";

export interface WorkflowFormRendererProps {
  form: UserInputForm;
  onSubmit: (values: Record<string, JsonValue>) => Promise<void> | void;
  submitting?: boolean;
  /** Current workflow state — lets `rows_review` resolve its sourcePath. */
  state?: Record<string, JsonValue>;
}

/**
 * Renders a UserInputForm declaratively. The mobile app will have its own
 * renderer against the same form schema — this one is web-only for now.
 */
export function WorkflowFormRenderer({
  form,
  onSubmit,
  submitting,
  state,
}: WorkflowFormRendererProps) {
  const initial = useMemo(
    () => seedValues(form.fields, state ?? {}),
    [form.fields, state],
  );
  const [values, setValues] = useState<Record<string, JsonValue>>(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  function update(name: string, v: JsonValue) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const missing = requiredMissing(form.fields, values);
    if (missing.length > 0) {
      setLocalError(`Required: ${missing.join(", ")}`);
      return;
    }
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">{form.title}</h3>
        {form.description ? (
          <p className="text-sm text-muted-foreground mt-1">
            {form.description}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {form.fields.map((field) => (
          <FieldRow
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(v) => update(field.name, v)}
          />
        ))}
      </div>

      {localError ? (
        <p className="text-sm text-destructive">{localError}</p>
      ) : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Working…" : form.submitLabel ?? "Continue"}
      </Button>
    </form>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: UserInputField;
  value: JsonValue | undefined;
  onChange: (v: JsonValue) => void;
}) {
  switch (field.kind) {
    case "text":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required ? " *" : ""}
          </Label>
          {field.multiline ? (
            <Textarea
              id={field.name}
              value={(value as string) ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
              rows={4}
            />
          ) : (
            <Input
              id={field.name}
              value={(value as string) ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.name}
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(Boolean(v))}
          />
          <Label htmlFor={field.name}>{field.label}</Label>
        </div>
      );
    case "choice":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required ? " *" : ""}
          </Label>
          <Select
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "photo":
      // Photo capture is TODO for web demo — on mobile this will use the
      // device camera via Expo ImagePicker. For now we note that upload isn't
      // wired and return an informational stub.
      return (
        <div className="space-y-1.5">
          <Label>{field.label}</Label>
          <p className="text-xs text-muted-foreground">
            Photo capture will be wired up in the mobile app. This field is a
            placeholder in the web demo.
          </p>
        </div>
      );
    case "file_upload":
      return <FileUploadField field={field} value={value} onChange={onChange} />;
    case "rows_review":
      return <RowsReviewField field={field} value={value} onChange={onChange} />;
  }
}

function FileUploadField({
  field,
  value,
  onChange,
}: {
  field: Extract<UserInputField, { kind: "file_upload" }>;
  value: JsonValue | undefined;
  onChange: (v: JsonValue) => void;
}) {
  const current = (value as { fileName?: string } | null) ?? null;
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onChange({
      fileName: file.name,
      mimeType: file.type || "text/csv",
      textContent: text,
    });
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.name}>
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      <input
        id={field.name}
        type="file"
        accept={field.accept}
        onChange={handleFile}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:bg-background file:text-sm file:cursor-pointer"
      />
      {current?.fileName ? (
        <p className="text-xs text-muted-foreground">
          Selected: {current.fileName}
        </p>
      ) : null}
    </div>
  );
}

type ReviewRow = {
  id: string;
  parsed: Record<string, string>;
  issues?: string[];
  accepted: boolean;
};

function RowsReviewField({
  field,
  value,
  onChange,
}: {
  field: Extract<UserInputField, { kind: "rows_review" }>;
  value: JsonValue | undefined;
  onChange: (v: JsonValue) => void;
}) {
  const rows = (Array.isArray(value) ? (value as unknown as ReviewRow[]) : []) ?? [];

  function update(rowId: string, patch: Partial<ReviewRow>) {
    const next = rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r));
    onChange(next as unknown as JsonValue);
  }

  function updateParsed(rowId: string, fieldName: string, val: string) {
    const target = rows.find((r) => r.id === rowId);
    if (!target) return;
    update(rowId, { parsed: { ...target.parsed, [fieldName]: val } });
  }

  function setAllAccepted(accepted: boolean) {
    onChange(rows.map((r) => ({ ...r, accepted })) as unknown as JsonValue);
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <p className="text-xs text-muted-foreground">
          No rows to review. Submitting will skip the import.
        </p>
      </div>
    );
  }

  const acceptedCount = rows.filter((r) => r.accepted).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Label className="text-base">{field.label}</Label>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {acceptedCount} / {rows.length} accepted
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAllAccepted(true)}>
            Accept all
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAllAccepted(false)}>
            Reject all
          </Button>
        </div>
      </div>
      <div className="rounded-md border overflow-x-auto max-h-[420px]">
        <table className="min-w-full text-sm">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-8">✓</th>
              {field.columns.map((c) => (
                <th key={c.field} className="px-2 py-2 text-left font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 text-left font-medium">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={r.accepted ? "" : "bg-muted/50 text-muted-foreground"}
              >
                <td className="px-2 py-1 align-top">
                  <Checkbox
                    checked={r.accepted}
                    onCheckedChange={(v) => update(r.id, { accepted: Boolean(v) })}
                  />
                </td>
                {field.columns.map((c) => (
                  <td key={c.field} className="px-1 py-1 align-top">
                    <Input
                      value={r.parsed[c.field] ?? ""}
                      onChange={(e) => updateParsed(r.id, c.field, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </td>
                ))}
                <td className="px-2 py-1 align-top text-xs text-destructive">
                  {(r.issues ?? []).join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function seedValues(
  fields: UserInputField[],
  state: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const f of fields) {
    switch (f.kind) {
      case "text":
      case "choice": {
        const fromPath = f.defaultValuePath
          ? getStatePath(state, f.defaultValuePath)
          : undefined;
        let v: string = f.defaultValue ?? "";
        if (typeof fromPath === "string" && fromPath.length > 0) v = fromPath;
        else if (typeof fromPath === "number") v = String(fromPath);
        else if (typeof fromPath === "boolean") v = String(fromPath);
        out[f.name] = v;
        break;
      }
      case "boolean": {
        const fromPath = f.defaultValuePath
          ? getStatePath(state, f.defaultValuePath)
          : undefined;
        const v =
          typeof fromPath === "boolean" ? fromPath : f.defaultValue ?? false;
        out[f.name] = v;
        break;
      }
      case "photo":
        out[f.name] = [];
        break;
      case "file_upload":
        out[f.name] = null;
        break;
      case "rows_review":
        out[f.name] = (getStatePath(state, f.sourcePath) ?? []) as JsonValue;
        break;
    }
  }
  return out;
}

function getStatePath(
  state: Record<string, JsonValue>,
  path: string,
): JsonValue | undefined {
  const parts = path.split(".");
  let cur: JsonValue | undefined = state;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as { [k: string]: JsonValue })[part];
    if (cur === undefined) return undefined;
  }
  return cur;
}

function requiredMissing(
  fields: UserInputField[],
  values: Record<string, JsonValue>,
): string[] {
  const missing: string[] = [];
  for (const f of fields) {
    if (!("required" in f) || !f.required) continue;
    const v = values[f.name];
    if (f.kind === "text" && (!v || v === "")) missing.push(f.label);
    if (f.kind === "choice" && (!v || v === "")) missing.push(f.label);
    if (f.kind === "boolean" && v !== true) missing.push(f.label);
    if (f.kind === "file_upload" && !v) missing.push(f.label);
    if (f.kind === "rows_review") {
      const rows = Array.isArray(v) ? (v as unknown as ReviewRow[]) : [];
      if (!rows.some((r) => r.accepted)) missing.push(f.label);
    }
  }
  return missing;
}
