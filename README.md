# Tally XML Kit

Small, typed building blocks for generating common TallyPrime XML envelopes and inspecting import responses.

## Why

Tally integrations often grow from copied XML strings with inconsistent escaping and weak error checks. This package keeps envelope construction explicit, escapes caller-provided scalar values, formats Tally dates, and turns common response counters into a predictable summary.

## Example

```ts
import { buildExportRequest, parseTallyResponse } from "@forgesaroj/tally-xml-kit";

const request = buildExportRequest({
  reportName: "Day Book",
  company: "Demo Company",
  fromDate: "2026-04-01",
  toDate: "2027-03-31"
});

const response = await fetch("http://localhost:9000", { method: "POST", body: request });
const summary = parseTallyResponse(await response.text());
```

## API

- `escapeXml(value)` — escape XML text values.
- `formatTallyDate(value)` — validate a real Gregorian calendar date and return `YYYYMMDD` from a `Date`, `YYYY-MM-DD`, or `YYYYMMDD`.
- `buildExportRequest(options)` — build an `Export / Data` envelope with static variables.
- `buildImportRequest(options)` — wrap caller-owned Tally message XML in an import envelope.
- `parseTallyResponse(xml)` — summarize status, counters, voucher ID, and every line error. The first remains available as `lineError`; the complete list is in `lineErrors`.
- `assertSuccessful(summary)` — throw when the summarized response failed.

## Important boundaries

`tallyMessageXml` is intentionally raw XML because voucher and master payloads are structurally different. Build that fragment from trusted code; never interpolate untrusted values without `escapeXml`. The response helper extracts standard summary tags and is not a general-purpose XML parser. Network transport and Tally configuration remain the caller's responsibility.

Requires Node 22.6+ for native type stripping in the zero-install test workflow.

```bash
npm test
npm run check
```

MIT licensed. This community project is not affiliated with or endorsed by Tally Solutions Pvt. Ltd.
