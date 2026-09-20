import test from "node:test";
import assert from "node:assert/strict";
import { assertSuccessful, buildExportRequest, buildImportRequest, escapeXml, formatTallyDate, parseTallyResponse } from "../src/index.ts";

test("escapes XML metacharacters", () => {
  assert.equal(escapeXml(`A&B <C> "D" 'E'`), "A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;");
});

test("formats supported date inputs", () => {
  assert.equal(formatTallyDate("2026-09-20"), "20260920");
  assert.equal(formatTallyDate("20260920"), "20260920");
  assert.equal(formatTallyDate("2024-02-29"), "20240229");
  assert.equal(formatTallyDate(new Date("2026-09-20T00:00:00Z")), "20260920");
});

test("rejects impossible calendar dates", () => {
  for (const value of ["2026-02-29", "20260231", "2026-13-01", "0000-01-01"]) {
    assert.throws(() => formatTallyDate(value), /Invalid calendar date/);
  }
});

test("builds escaped export envelopes", () => {
  const xml = buildExportRequest({ reportName: "Day Book", company: "A & B", fromDate: "2026-04-01", variables: { EXPLODEFLAG: "Yes" } });
  assert.match(xml, /<ID>Day Book<\/ID>/);
  assert.match(xml, /<SVCURRENTCOMPANY>A &amp; B<\/SVCURRENTCOMPANY>/);
  assert.match(xml, /<SVFROMDATE>20260401<\/SVFROMDATE>/);
  assert.match(xml, /<EXPLODEFLAG>Yes<\/EXPLODEFLAG>/);
});

test("rejects unsafe variable element names", () => {
  assert.throws(() => buildExportRequest({ reportName: "X", variables: { "BAD><TAG": "x" } }));
});

test("wraps caller-owned import XML without escaping it", () => {
  const xml = buildImportRequest({ company: "Demo", requestId: "Vouchers", tallyMessageXml: '<VOUCHER VCHTYPE="Sales" />' });
  assert.match(xml, /<TALLYMESSAGE><VOUCHER VCHTYPE="Sales" \/><\/TALLYMESSAGE>/);
});

test("summarizes successful and failed responses", () => {
  const success = parseTallyResponse("<RESPONSE><CREATED>2</CREATED><ERRORS>0</ERRORS><LASTVCHID>42</LASTVCHID></RESPONSE>");
  assert.equal(success.success, true);
  assert.equal(success.created, 2);
  assert.equal(success.lastVoucherId, "42");
  const failure = parseTallyResponse("<RESPONSE><ERRORS>1</ERRORS><LINEERROR>Invalid &amp; blocked</LINEERROR></RESPONSE>");
  assert.equal(failure.success, false);
  assert.throws(() => assertSuccessful(failure), /Invalid & blocked/);
});
