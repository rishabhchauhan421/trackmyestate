"use client";

import { useState } from "react";

import { controlClass, labelClass } from "~/app/_components/form";
import { normalizeTimeZone, type TimeZoneOption } from "~/lib/time-zone";

/**
 * Time zone picker with a shortcut to this device's zone. `options` come
 * from the server so both renders list the same zones and offsets.
 */
export function TimeZoneField({
  options,
  defaultValue,
}: {
  options: TimeZoneOption[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  function applyDeviceTimeZone() {
    const detected = normalizeTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    if (options.some((option) => option.value === detected)) {
      setValue(detected);
      setDetectMessage(null);
    } else {
      setDetectMessage("Couldn't detect this device's time zone.");
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className={labelClass}>Time zone</span>
        <select
          name="timezone"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={controlClass}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={applyDeviceTimeZone}
        className="text-[0.8125rem] font-medium text-accent hover:text-accent-strong"
      >
        Use this device&apos;s time zone
      </button>
      {detectMessage && (
        <p role="status" className="text-xs text-danger">
          {detectMessage}
        </p>
      )}
    </div>
  );
}
