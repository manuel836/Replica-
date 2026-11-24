"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface ShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Marca "(opcional)" junto a la etiqueta. */
  optional?: boolean;
}

function useFieldIds(id: string | undefined, hint?: string, error?: string) {
  const auto = useId();
  const fieldId = id ?? auto;
  const describedBy = [error ? `${fieldId}-error` : null, hint ? `${fieldId}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return { fieldId, describedBy: describedBy || undefined };
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  optional,
  children,
}: ShellProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {required && (
          <span aria-hidden className="text-danger">
            {" "}*
          </span>
        )}
        {optional && <span className="font-normal text-text-muted"> (opcional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (invalid?: boolean) =>
  cn(
    "w-full rounded-md border bg-surface px-3 text-base text-text placeholder:text-text-muted",
    "transition-colors duration-150 ease-brand",
    "focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus",
    "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted",
    invalid ? "border-danger" : "border-border-input",
  );

type TextFieldProps = ShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, "size">;

export function TextField({ id, label, hint, error, required, optional, className, ...rest }: TextFieldProps) {
  const { fieldId, describedBy } = useFieldIds(id, hint, error);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional}>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClass(!!error), "h-11", className)}
        {...rest}
      />
    </FieldShell>
  );
}

/** Teléfono de México: muestra +52 fijo y pide los 10 dígitos. */
export function PhoneField({ id, label, hint, error, required, optional, className, ...rest }: TextFieldProps) {
  const { fieldId, describedBy } = useFieldIds(id, hint, error);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional}>
      <div className="flex">
        <span
          aria-hidden
          className="flex h-11 items-center rounded-l-md border border-r-0 border-border-input bg-surface-muted px-3 text-base text-text-muted"
        >
          +52
        </span>
        <input
          id={fieldId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={14}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClass(!!error), "h-11 rounded-l-none", className)}
          {...rest}
        />
      </div>
    </FieldShell>
  );
}

type TextareaFieldProps = ShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField({
  id,
  label,
  hint,
  error,
  required,
  optional,
  className,
  rows = 3,
  ...rest
}: TextareaFieldProps) {
  const { fieldId, describedBy } = useFieldIds(id, hint, error);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional}>
      <textarea
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClass(!!error), "min-h-24 py-2.5", className)}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = ShellProps &
  SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string };

/** Select nativo: en celular abre el selector del sistema, que es el más accesible. */
export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  optional,
  options,
  placeholder,
  className,
  ...rest
}: SelectFieldProps) {
  const { fieldId, describedBy } = useFieldIds(id, hint, error);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional}>
      <div className="relative">
        <select
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClass(!!error), "h-11 appearance-none pr-10", className)}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-text-muted"
        />
      </div>
    </FieldShell>
  );
}
