import * as React from "react";
import { cn } from "@/lib/utils";

const baseCampo =
  "w-full min-h-11 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 py-2 text-base text-[var(--texto)] placeholder:text-[var(--texto-suave)] disabled:opacity-60 aria-[invalid=true]:border-[var(--peligro)]";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(baseCampo, className)} {...props} />,
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseCampo, "min-h-24 resize-y", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(baseCampo, "appearance-none bg-[right_0.75rem_center] pr-9", className)} {...props} />
  ),
);
Select.displayName = "Select";

function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-[var(--texto)]", className)} {...props} />;
}

/** Mensaje de error de un campo. Va con `aria-live` para que lo anuncie el lector de pantalla. */
function ErrorCampo({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-medium text-[var(--peligro)]">
      {children}
    </p>
  );
}

/** Campo completo: etiqueta + control + ayuda + error, con los `id` ya enlazados. */
function Campo({
  etiqueta,
  ayuda,
  error,
  obligatorio,
  children,
  className,
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  obligatorio?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>
        {etiqueta}
        {obligatorio ? <span className="text-[var(--peligro)]"> *</span> : null}
      </Label>
      {children}
      {ayuda ? <p className="text-xs text-[var(--texto-suave)]">{ayuda}</p> : null}
      <ErrorCampo>{error}</ErrorCampo>
    </div>
  );
}

export { Input, Textarea, Select, Label, Campo, ErrorCampo };
