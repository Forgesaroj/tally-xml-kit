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
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }
  if (/^\d{8}$/.test(value)) return value;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new TypeError("Date must be YYYY-MM-DD, YYYYMMDD, or a Date");
  return `${match[1]}${match[2]}${match[3]}`;
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
  const summary: TallyResponseSummary = {
    status: statusText === undefined ? undefined : numeric(statusText),
    created: count(xml, "CREATED"),
    altered: count(xml, "ALTERED"),
    deleted: count(xml, "DELETED"),
    errors: count(xml, "ERRORS"),
    cancelled: count(xml, "CANCELLED"),
    exceptions: count(xml, "EXCEPTIONS"),
    lastVoucherId: first(xml, "LASTVCHID"),
    lineError: decodeXml(first(xml, "LINEERROR"))
  };
  summary.success = summary.status !== 0 && summary.errors === 0 && !summary.lineError;
  return summary;
}

export function assertSuccessful(summary: TallyResponseSummary): void {
  if (!summary.success) throw new Error(summary.lineError || `Tally request failed with ${summary.errors} error(s)`);
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
