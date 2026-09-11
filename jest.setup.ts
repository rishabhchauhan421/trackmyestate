// Pin a fixed timezone so date-formatting tests are deterministic regardless
// of the machine/CI environment they run on.
process.env.TZ = "UTC";

import "@testing-library/jest-dom";
