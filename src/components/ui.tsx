"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

/** Joins class names, dropping anything falsy. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const CONTROL =
  "h-9 rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-faint hover:border-muted disabled:cursor-not-allowed disabled:opacity-60";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {children({ id, "aria-describedby": hintId })}
      {hint && (
        <p id={hintId} className="text-xs leading-snug text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Controls fill their row unless the caller sets a width. Two width utilities on
 * one element do not resolve by class order, so the default is left out instead.
 */
function width(className?: string): string | false {
  return !/(^|\s)w-/.test(className ?? "") && "w-full";
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(CONTROL, width(className), className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cn(CONTROL, width(className), className)}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(CONTROL, "h-auto py-2 leading-snug", width(className), className)} />;
}

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-surface hover:bg-text",
  secondary: "border border-line-strong bg-surface text-ink hover:border-muted hover:bg-sunken",
  quiet: "text-text hover:bg-sunken",
  danger: "border border-invalid/40 bg-surface text-invalid hover:bg-invalid-soft",
};

export function buttonClass(variant: ButtonVariant = "secondary", className?: string): string {
  return cn(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
    BUTTON_VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button {...props} type={type} className={buttonClass(variant, className)} />;
}

/** Two or three mutually exclusive choices, shown side by side. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-text">{label}</legend>
      <div className="inline-flex w-fit rounded-md border border-line-strong bg-sunken p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            title={option.hint}
            className={cn(
              "cursor-pointer rounded-[5px] px-3 py-1 text-sm font-medium transition-colors",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
              "motion-reduce:transition-none",
              value === option.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Panel({
  title,
  aside,
  className,
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface", className)}>
      {(title || aside) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

const NOTICE_TONES = {
  attention: "border-attention/30 bg-attention-soft text-attention",
  invalid: "border-invalid/30 bg-invalid-soft text-invalid",
  neutral: "border-line bg-sunken text-text",
};

export function Notice({
  tone = "attention",
  children,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
}) {
  return (
    <p className={cn("rounded-md border px-3 py-2 text-sm leading-snug", NOTICE_TONES[tone])}>
      {children}
    </p>
  );
}
