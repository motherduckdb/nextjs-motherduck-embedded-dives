/**
 * Title: City Pulse
 * Description: Compact NYC 311 row explorer with expandable similar-request context.
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSQLQuery } from "@motherduck/react-sql-query";

export const REQUIRED_DATABASES = [
  { type: "share", path: "md:_share/sample_data/23b0d623-1361-421d-ae77-62d701d471e6", alias: "sample_data" },
];

const N = (v: unknown): number => (v != null ? Number(v) : 0);
const sql = (v: unknown) => String(v ?? "").replaceAll("'", "''");
const PAGE_SIZE = 40;

function fmt(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function fmtHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "--";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtDate(v: unknown) {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

const BOROUGHS = ["All", "BROOKLYN", "QUEENS", "MANHATTAN", "BRONX", "STATEN ISLAND"] as const;
const BORO_LABEL: Record<string, string> = {
  All: "All NYC",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  "STATEN ISLAND": "Staten Island",
};

const PERIODS = [
  { key: "all", label: "2010-2022", start: "2010-01-01", end: "2023-01-01" },
  { key: "pre", label: "2010-2014", start: "2010-01-01", end: "2015-01-01" },
  { key: "mid", label: "2015-2018", start: "2015-01-01", end: "2019-01-01" },
  { key: "recent", label: "2019-2022", start: "2019-01-01", end: "2023-01-01" },
] as const;

const CATEGORIES = [
  { key: "all", label: "All issues", sql: "" },
  { key: "noise", label: "Noise", sql: "AND lower(complaint_type) LIKE '%noise%'" },
  { key: "heat", label: "Heat", sql: "AND (lower(complaint_type) LIKE '%heat%' OR lower(complaint_type) LIKE '%hot water%')" },
  { key: "streets", label: "Streets", sql: "AND (lower(complaint_type) LIKE '%street%' OR lower(complaint_type) LIKE '%traffic%')" },
  { key: "sanitation", label: "Sanitation", sql: "AND (lower(complaint_type) LIKE '%sanitation%' OR lower(complaint_type) LIKE '%dirty%')" },
] as const;

const C = {
  bg: "#090b10",
  border: "#263241",
  text: "#eef2f7",
  muted: "#a1adbd",
  soft: "#6f7e91",
  green: "#35d59a",
  blue: "#5aa7ff",
  ink: "#f8fafc",
};

const ttStyle: React.CSSProperties = {
  backgroundColor: "#111722",
  border: `1px solid ${C.border}`,
  borderRadius: "4px",
  color: C.text,
  fontSize: "12px",
};

function LoadingBlock({ label = "Querying MotherDuck" }: { label?: string }) {
  return <div className="cp-loading">{label}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cp-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function CityPulse() {
  const [borough, setBorough] = useState<string>("All");
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]["key"]>("all");
  const [categoryKey, setCategoryKey] = useState<(typeof CATEGORIES)[number]["key"]>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowData, setRowData] = useState<Array<Record<string, unknown>>>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadedPageKey, setLoadedPageKey] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const loadingPageRef = useRef(false);
  const restoreScrollTopRef = useRef<number | null>(null);

  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];
  const category = CATEGORIES.find((c) => c.key === categoryKey) ?? CATEGORIES[0];
  const bWhere = borough === "All" ? "" : `AND borough = '${borough}'`;
  const dateWhere = `AND created_date >= '${period.start}' AND created_date < '${period.end}'`;
  const filterKey = `${periodKey}:${categoryKey}:${borough}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
    setRowData([]);
    setHasMore(true);
    setOpenKey(null);
    setLoadedPageKey("");
    loadingPageRef.current = false;
    restoreScrollTopRef.current = null;
  }, [filterKey]);

  const rows = useSQLQuery(`
    SELECT unique_key,
           created_date,
           status,
           borough,
           agency,
           complaint_type,
           descriptor,
           incident_zip
    FROM sample_data.nyc.service_requests
    WHERE created_date IS NOT NULL ${dateWhere} ${bWhere} ${category.sql}
    ORDER BY created_date DESC
    LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}
  `);

  useEffect(() => {
    if (rows.isLoading) return;
    const pageRows = Array.isArray(rows.data) ? rows.data : [];
    const firstKey = String(pageRows[0]?.unique_key ?? "");
    const lastKey = String(pageRows[pageRows.length - 1]?.unique_key ?? "");
    const nextPageKey = `${filterKey}:${page}:${pageRows.length}:${firstKey}:${lastKey}`;
    if (loadedPageKey === nextPageKey) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadedPageKey(nextPageKey);
    loadingPageRef.current = false;
    setHasMore(pageRows.length === PAGE_SIZE);
    setRowData((prev) => {
      if (page === 0) return pageRows;
      const seen = new Set(prev.map((r) => String(r.unique_key)));
      return [...prev, ...pageRows.filter((r) => !seen.has(String(r.unique_key)))];
    });
  }, [rows.data, rows.isLoading, page, filterKey, loadedPageKey]);

  useLayoutEffect(() => {
    if (restoreScrollTopRef.current == null || !tableRef.current) return;
    tableRef.current.scrollTop = restoreScrollTopRef.current;
    restoreScrollTopRef.current = null;
  }, [rowData.length]);

  const selected = rowData.find((r) => String(r.unique_key) === openKey);
  const similarWhere = selected
    ? `AND complaint_type = '${sql(selected.complaint_type)}' AND borough = '${sql(selected.borough)}'`
    : "AND 1 = 0";

  const similarStats = useSQLQuery(`
    SELECT COUNT(*) as requests,
           SUM(CASE WHEN status <> 'Closed' THEN 1 ELSE 0 END) as open_cnt,
           COUNT(DISTINCT agency) as agencies,
           COUNT(DISTINCT incident_zip) as zips,
           ROUND(MEDIAN(CASE WHEN closed_date > created_date
             AND EXTRACT(EPOCH FROM (closed_date - created_date)) BETWEEN 0 AND 31536000
             THEN EXTRACT(EPOCH FROM (closed_date - created_date)) / 3600 END), 1) as med_hours
    FROM sample_data.nyc.service_requests
    WHERE created_date IS NOT NULL ${dateWhere} ${similarWhere}
  `);

  const similarTrend = useSQLQuery(`
    SELECT DATE_TRUNC('month', created_date) as month, COUNT(*) as requests
    FROM sample_data.nyc.service_requests
    WHERE created_date IS NOT NULL ${dateWhere} ${similarWhere}
    GROUP BY 1
    ORDER BY 1
  `);

  const stats = Array.isArray(similarStats.data) ? similarStats.data[0] : null;
  const trend = (Array.isArray(similarTrend.data) ? similarTrend.data : []).map((r) => ({
    month: String(r.month).slice(0, 7),
    requests: N(r.requests),
  }));

  return (
    <>
      <style>{DIVE_CSS}</style>
      <main className="cp-root">
        <div className="cp-shell">
          <header className="cp-header">
            <div className="cp-brand">
              <h1>City Pulse</h1>
              <p>NYC 311 details</p>
            </div>

            <div className="cp-controls" aria-label="Dive controls">
              <div className="cp-segment cp-periods">
                {PERIODS.map((p) => (
                  <button key={p.key} className={periodKey === p.key ? "active" : ""} onClick={() => setPeriodKey(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <select value={categoryKey} onChange={(e) => setCategoryKey(e.target.value as typeof categoryKey)} aria-label="Issue type">
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <div className="cp-segment cp-boroughs">
                {BOROUGHS.map((b) => (
                  <button key={b} className={borough === b ? "active" : ""} onClick={() => setBorough(b)}>
                    {BORO_LABEL[b]}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <section className="cp-card">
            <div className="cp-card-head">
              <span>Details</span>
              <strong>Click rows for similar requests</strong>
            </div>

            {rows.isLoading && rowData.length === 0 ? (
              <LoadingBlock label="Loading filtered rows" />
            ) : (
              <div
                ref={tableRef}
                className="cp-table-wrap"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (hasMore && !rows.isLoading && !loadingPageRef.current && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
                    loadingPageRef.current = true;
                    restoreScrollTopRef.current = el.scrollTop;
                    setPage((p) => p + 1);
                  }
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Borough</th>
                      <th>Agency</th>
                      <th>Complaint</th>
                      <th>Descriptor</th>
                      <th>ZIP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowData.map((r, i) => {
                      const key = String(r.unique_key ?? i);
                      const isOpen = key === openKey;
                      return (
                        <Fragment key={`${key}-${i}`}>
                          <tr
                            className={isOpen ? "selected" : ""}
                            tabIndex={0}
                            onClick={() => setOpenKey(isOpen ? null : key)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setOpenKey(isOpen ? null : key);
                            }}
                          >
                            <td>{fmtDate(r.created_date)}</td>
                            <td><span className={`cp-status ${String(r.status).toLowerCase() === "closed" ? "closed" : "open"}`}>{String(r.status ?? "")}</span></td>
                            <td>{String(r.borough ?? "")}</td>
                            <td>{String(r.agency ?? "")}</td>
                            <td>{String(r.complaint_type ?? "")}</td>
                            <td>{String(r.descriptor ?? "")}</td>
                            <td>{String(r.incident_zip ?? "")}</td>
                          </tr>
                          {isOpen && (
                            <tr className="cp-expanded">
                              <td colSpan={7}>
                                <div className="cp-detail">
                                  <div>
                                    <span>Similar requests</span>
                                    <strong>{String(r.complaint_type ?? "Unknown")} in {String(r.borough ?? "NYC")}</strong>
                                  </div>

                                  {similarStats.isLoading || similarTrend.isLoading ? (
                                    <LoadingBlock label="Loading similar request context" />
                                  ) : (
                                    <>
                                      <div className="cp-stats">
                                        <Stat label="Requests" value={stats ? fmt(N(stats.requests)) : "--"} />
                                        <Stat label="Open" value={stats ? fmt(N(stats.open_cnt)) : "--"} />
                                        <Stat label="Median close" value={stats ? fmtHours(N(stats.med_hours)) : "--"} />
                                        <Stat label="Agencies" value={stats ? fmt(N(stats.agencies)) : "--"} />
                                        <Stat label="ZIPs" value={stats ? fmt(N(stats.zips)) : "--"} />
                                      </div>

                                      <div className="cp-trend" aria-label="Monthly trend for similar requests">
                                        <ResponsiveContainer width="100%" height={116}>
                                          <LineChart data={trend} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                                            <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                                            <XAxis
                                              dataKey="month"
                                              tick={{ fill: C.soft, fontSize: 10 }}
                                              tickFormatter={(v) => String(v).endsWith("-01") ? String(v).slice(0, 4) : ""}
                                              axisLine={false}
                                              tickLine={false}
                                            />
                                            <YAxis tick={{ fill: C.soft, fontSize: 10 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={ttStyle} formatter={(v: number) => [N(v).toLocaleString(), "requests"]} />
                                            <Line dataKey="requests" type="monotone" stroke={C.blue} strokeWidth={2} dot={{ r: 2, fill: C.green }} activeDot={{ r: 4 }} />
                                          </LineChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                <div className="cp-more">
                  {rows.isLoading ? "Loading more rows..." : hasMore ? "Scroll for more rows" : "End of matching records"}
                </div>
              </div>
            )}
            <footer className="cp-foot">
              Showing {rowData.length.toLocaleString()} records{hasMore ? "" : " total"}.
            </footer>
          </section>
        </div>
      </main>
    </>
  );
}

const DIVE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');

* { box-sizing: border-box; }
html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: ${C.bg};
}
body {
  color: ${C.text};
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
button, select { font: inherit; }
.cp-root {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  background: ${C.bg};
}
.cp-shell {
  width: min(1120px, 100%);
  height: min(610px, 100%);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 7px;
}
.cp-header { min-height: 56px; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding-bottom: 4px; }
.cp-brand { min-width: 190px; }
.cp-brand h1 {
  margin: 0;
  color: ${C.ink};
  font-size: 31px;
  line-height: 0.95;
  font-weight: 800;
  letter-spacing: 0;
}
.cp-brand p {
  display: inline-flex;
  align-items: center;
  margin: 7px 0 0;
  padding: 3px 8px;
  border: 1px solid rgba(90,167,255,0.42);
  border-radius: 4px;
  background: rgba(90,167,255,0.12);
  color: #b8d9ff;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}
.cp-controls { display: flex; align-items: center; justify-content: flex-end; flex-wrap: nowrap; gap: 6px; min-width: 0; }
.cp-segment {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: rgba(17,23,34,0.78);
  border: 1px solid ${C.border};
  border-radius: 4px;
  min-width: 0;
}
.cp-segment button {
  border: 0;
  cursor: pointer;
  min-width: 58px;
  padding: 5px 7px;
  border-radius: 3px;
  background: transparent;
  color: ${C.muted};
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}
.cp-boroughs button { min-width: 60px; }
.cp-segment button.active {
  background: ${C.ink};
  color: #090b10;
}
.cp-controls select {
  height: 29px;
  border: 1px solid ${C.border};
  border-radius: 4px;
  background: rgba(17,23,34,0.92);
  color: ${C.text};
  padding: 0 30px 0 10px;
  font-size: 12px;
  font-weight: 750;
}
.cp-card {
  min-width: 0;
  min-height: 0;
  padding: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 5px;
  contain: layout paint;
}
.cp-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 28px; }
.cp-card-head span,
.cp-detail > div:first-child span {
  color: #b8d9ff;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.cp-card-head strong {
  color: ${C.ink};
  font-size: 13px;
  font-weight: 800;
}
.cp-table-wrap {
  min-height: 0;
  overflow: auto;
  overflow-anchor: none;
  background: transparent;
}
.cp-more {
  padding: 8px;
  color: ${C.soft};
  font-size: 11px;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}
.cp-foot {
  color: ${C.soft};
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}
table {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
}
thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #111722;
  color: ${C.ink};
  border-top: 1px solid ${C.border};
  border-bottom: 2px solid rgba(90,167,255,0.42);
  font-size: 11px;
  font-weight: 800;
  text-align: left;
  text-transform: uppercase;
}
th, td {
  max-width: 260px;
  padding: 6px 8px;
  border-bottom: 1px solid #1e2938;
  color: ${C.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
tbody tr { cursor: pointer; }
tbody tr:hover { background: rgba(53,213,154,0.06); }
tbody tr.selected { background: rgba(90,167,255,0.12); }
tbody tr.selected td { border-bottom-color: rgba(90,167,255,0.22); }
.cp-expanded,
.cp-expanded:hover {
  background: rgba(17,23,34,0.62);
  cursor: default;
}
.cp-expanded td {
  padding: 0;
  white-space: normal;
}
.cp-status {
  display: inline-flex;
  align-items: center;
  min-width: 58px;
  justify-content: center;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 800;
}
.cp-status.closed {
  background: rgba(53,213,154,0.12);
  color: #70e6ba;
}
.cp-status.open {
  background: rgba(255,138,61,0.15);
  color: #ffb078;
}
.cp-detail {
  margin: 7px;
  padding: 8px;
  border: 1px solid ${C.border};
  border-radius: 4px;
  background: rgba(17,23,34,0.9);
}
.cp-detail > div:first-child { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
.cp-detail > div:first-child strong {
  color: ${C.ink};
  font-size: 12px;
  text-align: right;
}
.cp-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  margin-bottom: 6px;
}
.cp-stat {
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid ${C.border};
  background: #0c111a;
}
.cp-stat span {
  display: block;
  color: ${C.soft};
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.cp-stat strong {
  display: block;
  margin-top: 4px;
  color: ${C.ink};
  font-size: 16px;
  line-height: 1.05;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.cp-trend { display: grid; gap: 5px; }
.cp-loading {
  height: 100%;
  min-height: 118px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${C.muted};
  font-size: 12px;
  font-weight: 650;
}
@media (max-width: 980px) {
  html, body, #root { overflow: auto; }
  .cp-root {
    display: block;
    overflow: auto;
    height: auto;
    min-height: 100vh;
    padding: 14px;
  }
  .cp-shell {
    width: auto;
    height: auto;
    min-height: 620px;
  }
  .cp-header,
  .cp-controls { align-items: stretch; flex-direction: column; }
  .cp-segment { overflow-x: auto; }
  .cp-segment button { flex: 0 0 auto; }
  .cp-controls select { width: 100%; }
  .cp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cp-detail > div:first-child { display: block; }
  .cp-detail > div:first-child strong {
    display: block;
    margin-top: 3px;
    text-align: left;
  }
}
`;
