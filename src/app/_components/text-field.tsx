import type { ComponentPropsWithoutRef } from "react";

import { Field, Input } from "./form";

/** A labeled text input — used on the sign-in and password reset forms. */
export function TextField({
  label,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "id"> & { label: string }) {
  return (
    <Field label={label} className={className}>
      <Input {...props} className="h-12" />
    </Field>
  );
}
