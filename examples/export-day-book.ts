import { buildExportRequest } from "../src/index.ts";

const xml = buildExportRequest({
  reportName: "Day Book",
  company: "Demo Company",
  fromDate: "2026-04-01",
  toDate: "2027-03-31"
});

console.log(xml);
