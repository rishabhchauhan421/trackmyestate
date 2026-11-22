import {
  Field,
  FormSection,
  Input,
  Select,
  controlClass,
} from "~/app/_components/form";
import { toDateInputValue } from "~/lib/format";
import { ISSUE_TYPE_LABELS } from "~/lib/labels";

/** The fields shared by the "Add issue" and "Edit issue" forms. */
export function IssueFormFields({
  issue,
  defaultType,
}: {
  issue?: {
    type: string;
    title: string;
    description: string | null;
    counterparty: string | null;
    reference: string | null;
    openedOn: Date;
  };
  defaultType?: string;
}) {
  return (
    <FormSection
      title="The issue"
      description="What stands between this property and a clear title or a closed account."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Type">
          <Select
            name="type"
            required
            defaultValue={issue?.type ?? defaultType ?? ""}
          >
            <option value="" disabled>
              Choose a type
            </option>
            {Object.entries(ISSUE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <Input
            name="title"
            required
            maxLength={120}
            defaultValue={issue?.title}
            placeholder="e.g. Boundary dispute with neighbour"
          />
        </Field>
        <Field
          label="Other party"
          optional
          hint="A person, builder, authority or court."
        >
          <Input name="counterparty" defaultValue={issue?.counterparty ?? ""} />
        </Field>
        <Field
          label="Reference number"
          optional
          hint="Case, application or allotment number."
        >
          <Input name="reference" defaultValue={issue?.reference ?? ""} />
        </Field>
        <Field
          label="Started on"
          optional
          hint="Left blank, it's taken as today."
        >
          <Input
            type="date"
            name="openedOn"
            defaultValue={issue ? toDateInputValue(issue.openedOn) : undefined}
          />
        </Field>
      </div>
      <Field label="Details" optional>
        <textarea
          name="description"
          rows={4}
          defaultValue={issue?.description ?? ""}
          className={controlClass}
        />
      </Field>
    </FormSection>
  );
}
