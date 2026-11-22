import { Field, controlClass } from "~/app/_components/form";
import { NOTES_MAX_LENGTH } from "~/lib/form";

/**
 * The free-text "Notes" box every asset form ends with (property, lease,
 * loan, policy, investment): for details the structured fields can't hold,
 * such as who to call, where the papers are kept, or a verbal agreement.
 * Submitted as `notes`.
 */
export function NotesField({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <Field
      label="Notes"
      optional
      hint="Anything the fields above don't capture. Only people in your household see this."
    >
      <textarea
        name="notes"
        rows={4}
        maxLength={NOTES_MAX_LENGTH}
        defaultValue={defaultValue ?? ""}
        className={controlClass}
      />
    </Field>
  );
}
