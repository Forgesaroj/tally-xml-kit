export type ExportRequest = {
  reportName: string;
  company?: string;
  fromDate?: string | Date;
  toDate?: string | Date;
  variables?: Record<string, string | number | boolean>;
};

export type ImportRequest = {
  requestId?: string;
  company?: string;
  tallyMessageXml: string;
};

export type TallyResponseSummary = {
  status?: number;
  created: number;
  altered: number;
  deleted: number;
  errors: number;
  cancelled: number;
  exceptions: number;
  lastVoucherId?: string;
  lineError?: string;
  lineErrors?: string[];
  success: boolean;
};

export function escapeXml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatTallyDate(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError("Invalid date");
    const year = value.getUTCFullYear();
    if (year < 1 || year > 9999) throw new TypeError("Date year must be between 0001 and 9999");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${String(year).padStart(4, "0")}${month}${day}`;
  }
  const compact = /^\d{8}$/.test(value)
    ? value
    : value.match(/^(\d{4})-(\d{2})-(\d{2})$/)?.slice(1).join("");
  if (!compact) throw new TypeError("Date must be YYYY-MM-DD, YYYYMMDD, or a Date");

  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new TypeError(`Invalid calendar date: ${value}`);
  }
  return compact;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function buildExportRequest(request: ExportRequest): string {
  if (!request.reportName?.trim()) throw new TypeError("reportName is required");
  const variables: string[] = [];
  if (request.company) variables.push(tag("SVCURRENTCOMPANY", request.company));
  if (request.fromDate) variables.push(tag("SVFROMDATE", formatTallyDate(request.fromDate)));
  if (request.toDate) variables.push(tag("SVTODATE", formatTallyDate(request.toDate)));
  for (const [name, value] of Object.entries(request.variables ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new TypeError(`Invalid variable name: ${name}`);
    variables.push(tag(name, value));
  }

  return compact(`
    <ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>${escapeXml(request.reportName)}</ID></HEADER>
      <BODY><DESC>${variables.length ? `<STATICVARIABLES>${variables.join("")}</STATICVARIABLES>` : ""}</DESC></BODY>
    </ENVELOPE>
  `);
}

export function buildImportRequest(request: ImportRequest): string {
  if (!request.tallyMessageXml?.trim()) throw new TypeError("tallyMessageXml is required");
  const staticVariables = request.company ? `<STATICVARIABLES>${tag("SVCURRENTCOMPANY", request.company)}</STATICVARIABLES>` : "";
  return compact(`
    <ENVELOPE>
      <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>${escapeXml(request.requestId ?? "All Masters")}</ID></HEADER>
      <BODY><DESC>${staticVariables}</DESC><DATA><TALLYMESSAGE>${request.tallyMessageXml.trim()}</TALLYMESSAGE></DATA></BODY>
    </ENVELOPE>
  `);
}

export function parseTallyResponse(xml: string): TallyResponseSummary {
  if (!xml?.trim()) throw new TypeError("XML response is required");
  const statusText = first(xml, "STATUS");
  const lineErrors = all(xml, "LINEERROR")
    .map((value) => decodeXml(value))
    .filter((value): value is string => Boolean(value));
  const summary: TallyResponseSummary = {
    status: statusText === undefined ? undefined : numeric(statusText),
    created: count(xml, "CREATED"),
    altered: count(xml, "ALTERED"),
    deleted: count(xml, "DELETED"),
    errors: count(xml, "ERRORS"),
    cancelled: count(xml, "CANCELLED"),
    exceptions: count(xml, "EXCEPTIONS"),
    lastVoucherId: first(xml, "LASTVCHID"),
    lineError: lineErrors[0],
    lineErrors
  };
  summary.success = summary.status !== 0 && summary.errors === 0 && lineErrors.length === 0;
  return summary;
}

export function assertSuccessful(summary: TallyResponseSummary): void {
  if (!summary.success) {
    const detail = summary.lineErrors?.length ? summary.lineErrors.join("\n") : summary.lineError;
    throw new Error(detail || `Tally request failed with ${summary.errors} error(s)`);
  }
}

function tag(name: string, value: unknown): string {
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function compact(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}

function first(xml: string, tagName: string): string | undefined {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1]?.trim();
}

function all(xml: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => match[1]?.trim() ?? "");
}

function count(xml: string, tagName: string): number {
  const value = first(xml, tagName);
  return value === undefined ? 0 : numeric(value);
}

function numeric(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeXml(value?: string): string | undefined {
  return value?.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}
