import { PageHeader } from "~/app/_components/page-header";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${
        on
          ? "bg-blue-600"
          : "bg-slate-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function SettingsRow({
  label,
  description,
  on,
}: {
  label: string;
  description: string;
  on: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <Toggle on={on} />
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h2>
      <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, security and how you'd like to be reminded."
      />

      <SettingsSection title="Security">
        <SettingsRow
          label="Two-factor authentication"
          description="Require a second step to sign in"
          on={false}
        />
        <SettingsRow
          label="Biometric unlock"
          description="Face ID / fingerprint on this device"
          on={false}
        />
      </SettingsSection>

      <SettingsSection title="Reminder channels">
        <SettingsRow
          label="Email"
          description="Renewal, EMI and rent reminders by email"
          on={true}
        />
        <SettingsRow
          label="Push notifications"
          description="Reminders on your phone and browser"
          on={true}
        />
        <SettingsRow
          label="WhatsApp"
          description="Reminders and weekly digest on WhatsApp"
          on={false}
        />
      </SettingsSection>

      <SettingsSection title="Privacy">
        <SettingsRow
          label="Weekly digest"
          description="A summary of everything due or expected this month"
          on={true}
        />
      </SettingsSection>
    </>
  );
}
