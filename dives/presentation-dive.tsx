/**
 * Title: NYC 311 Briefing Deck
 * Description: Three-slide presentation view for NYC 311 service request data
 */

import { useState } from "react";
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

const MD = {
  bg: "#090b10",
  surface: "#111722",
  panel: "#0c111a",
  border: "#263241",
  text: "#eef2f7",
  muted: "#a1adbd",
  dim: "#6f7e91",
  cyan: "#5aa7ff",
  orange: "#ff8a3d",
  teal: "#35d59a",
  yellow: "#f8fafc",
  red: "#ff7169",
  cream: "#f8fafc",
};

const CHART_COLORS = [MD.cyan, MD.orange, MD.teal, MD.red, MD.yellow];

const ttStyle: React.CSSProperties = {
  backgroundColor: MD.surface,
  border: `1px solid ${MD.border}`,
  borderRadius: "0",
  color: MD.text,
  fontSize: "12px",
  fontFamily: "Inter, Arial, sans-serif",
  boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
};

function fmt(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function pct(part: number, total: number) {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function days(v: number) {
  if (v >= 100) return `${Math.round(v).toLocaleString()}d`;
  if (v >= 10) return `${v.toFixed(1)}d`;
  return `${v.toFixed(2)}d`;
}

function SlideShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: MD.bg,
        color: MD.text,
        fontFamily: "Inter, Arial, sans-serif",
        height: "100%",
        padding: "22px 28px 20px",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, accent = MD.border }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: MD.surface,
        border: `1px solid ${MD.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 0,
        boxShadow: "0 18px 42px rgba(0,0,0,0.22)",
        padding: "18px",
      }}
    >
      {children}
    </div>
  );
}

function Kpi({ label, value, tone = MD.text, loading }: { label: string; value: string; tone?: string; loading?: boolean }) {
  return (
    <Card>
      <div
        style={{
          color: MD.muted,
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          marginBottom: "10px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ color: tone, fontSize: "32px", fontWeight: 800, lineHeight: 1 }}>
        {loading ? <span style={{ color: MD.dim }}>--</span> : value}
      </div>
    </Card>
  );
}

function ResolutionRates({
  title,
  label,
  rows,
  loading,
  accent,
}: {
  title: string;
  label: string;
  rows: Array<{ name: string; requests: number; resolutionRate: number; medianDays: number }>;
  loading?: boolean;
  accent: string;
}) {
  return (
    <Card accent={accent}>
      <h2 style={{ fontSize: "18px", fontWeight: 900, margin: "0 0 12px" }}>{title}</h2>
      {loading ? (
        <div style={{ color: MD.dim, height: 300, display: "grid", placeItems: "center", fontWeight: 700 }}>Loading resolution metrics...</div>
      ) : (
        <div>
          <div
            style={{
            alignItems: "center",
              color: MD.muted,
              display: "flex",
              fontSize: "11px",
              fontWeight: 800,
              gap: "14px",
              marginBottom: "10px",
            }}
          >
            <span style={{ color: MD.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
            <span style={{ alignItems: "center", display: "flex", gap: "6px" }}>
              <span style={{ background: MD.teal, display: "block", height: "8px", width: "18px" }} />
              Resolution rate
            </span>
            <span style={{ alignItems: "center", display: "flex", gap: "6px" }}>
              <span style={{ color: MD.orange, fontWeight: 900 }}>00d</span>
              Median time
            </span>
          </div>
          {rows.map((row, i) => (
            <div
              key={row.name}
              style={{
                borderTop: `1px solid ${MD.border}`,
                padding: "8px 0",
              }}
            >
              <div style={{ alignItems: "baseline", display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
                <div style={{ color: MD.text, fontSize: "11px", fontWeight: 800, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: CHART_COLORS[i % CHART_COLORS.length], marginRight: "8px" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {row.name}
                </div>
                <div style={{ color: MD.dim, fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>{fmt(row.requests)} req</div>
              </div>
              <div style={{ alignItems: "center", display: "grid", gap: "10px", gridTemplateColumns: "1fr 52px 64px" }}>
                <div
                  style={{
                    background: MD.panel,
                    border: `1px solid ${MD.border}`,
                    height: "14px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      background: MD.teal,
                      height: "100%",
                      width: `${Math.max(0, Math.min(100, row.resolutionRate))}%`,
                    }}
                  />
                </div>
                <div style={{ color: MD.teal, fontSize: "12px", fontWeight: 900, textAlign: "right" }}>{row.resolutionRate.toFixed(1)}%</div>
                <div style={{ color: MD.orange, fontSize: "12px", fontWeight: 900, textAlign: "right" }}>{days(row.medianDays)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Header({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", gap: "18px", marginBottom: "18px" }}>
      <div>
        <div
          style={{
            color: MD.orange,
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <h1 style={{ color: MD.text, fontSize: "40px", fontWeight: 900, lineHeight: 0.98, margin: 0 }}>
          {title}
        </h1>
      </div>
      <p style={{ color: MD.muted, fontSize: "14px", lineHeight: 1.5, margin: 0, maxWidth: "330px" }}>
        {sub}
      </p>
    </header>
  );
}

export default function NYC311BriefingDeck() {
  const [current, setCurrent] = useState(0);
  const totalSlides = 3;
  const goPrev = () => setCurrent((slide) => Math.max(0, slide - 1));
  const goNext = () => setCurrent((slide) => Math.min(totalSlides - 1, slide + 1));
  const handleSlideClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    if (event.clientX - left < width / 2) {
      goPrev();
      return;
    }
    goNext();
  };

  const overview = useSQLQuery(`
    SELECT COUNT(*) AS total_requests,
           COUNT(*) FILTER (WHERE status = 'Closed') AS closed_requests,
           COUNT(DISTINCT complaint_type) AS complaint_types,
           ROUND(AVG(date_diff('hour', created_date, closed_date)), 1) AS avg_hours_to_close
    FROM "sample_data"."nyc"."service_requests"
    WHERE created_date IS NOT NULL
  `);

  const boroughs = useSQLQuery(`
    SELECT strftime(created_date, '%Y') AS year, borough, COUNT(*) AS requests
    FROM "sample_data"."nyc"."service_requests"
    WHERE created_date IS NOT NULL
      AND borough IN ('BROOKLYN', 'QUEENS', 'MANHATTAN', 'BRONX', 'STATEN ISLAND')
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  const resolutionByType = useSQLQuery(`
    SELECT complaint_type, COUNT(*) AS requests,
           COUNT(*) FILTER (WHERE closed_date IS NOT NULL AND closed_date >= created_date) AS resolved_requests,
           ROUND(100.0 * COUNT(*) FILTER (WHERE closed_date IS NOT NULL AND closed_date >= created_date) / COUNT(*), 1) AS resolution_rate,
           ROUND(median(CASE WHEN closed_date IS NOT NULL AND closed_date >= created_date THEN date_diff('hour', created_date, closed_date) END), 1) AS median_hours
    FROM "sample_data"."nyc"."service_requests"
    WHERE created_date IS NOT NULL
      AND complaint_type IS NOT NULL
    GROUP BY 1
    ORDER BY requests DESC
    LIMIT 5
  `);

  const resolutionByAgency = useSQLQuery(`
    SELECT agency, COUNT(*) AS requests,
           COUNT(*) FILTER (WHERE closed_date IS NOT NULL AND closed_date >= created_date) AS resolved_requests,
           ROUND(100.0 * COUNT(*) FILTER (WHERE closed_date IS NOT NULL AND closed_date >= created_date) / COUNT(*), 1) AS resolution_rate,
           ROUND(median(CASE WHEN closed_date IS NOT NULL AND closed_date >= created_date THEN date_diff('hour', created_date, closed_date) END), 1) AS median_hours
    FROM "sample_data"."nyc"."service_requests"
    WHERE created_date IS NOT NULL
      AND agency IS NOT NULL
    GROUP BY 1
    ORDER BY requests DESC
    LIMIT 5
  `);

  const issueTypes = useSQLQuery(`
    SELECT complaint_type, COUNT(*) AS requests
    FROM "sample_data"."nyc"."service_requests"
    WHERE complaint_type IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 28
  `);

  const overviewRow = Array.isArray(overview.data) ? overview.data[0] : null;
  const boroughRows = Array.isArray(boroughs.data) ? boroughs.data : [];
  const typeResolutionRows = Array.isArray(resolutionByType.data) ? resolutionByType.data : [];
  const agencyResolutionRows = Array.isArray(resolutionByAgency.data) ? resolutionByAgency.data : [];
  const issueTypeRows = Array.isArray(issueTypes.data) ? issueTypes.data : [];

  const total = N(overviewRow?.total_requests);
  const closed = N(overviewRow?.closed_requests);
  const boroughSeries = ["BROOKLYN", "QUEENS", "MANHATTAN", "BRONX", "STATEN ISLAND"];
  const boroughLabels: Record<string, string> = {
    BROOKLYN: "Brooklyn",
    QUEENS: "Queens",
    MANHATTAN: "Manhattan",
    BRONX: "Bronx",
    "STATEN ISLAND": "Staten Island",
  };
  const boroughColor: Record<string, string> = {
    BROOKLYN: MD.cyan,
    QUEENS: MD.orange,
    MANHATTAN: MD.teal,
    BRONX: MD.red,
    "STATEN ISLAND": MD.yellow,
  };
  const boroughData = Array.from(
    boroughRows.reduce((acc, row) => {
      const year = String(row.year);
      const borough = String(row.borough);
      const currentRow = acc.get(year) ?? { year };
      currentRow[borough] = N(row.requests);
      acc.set(year, currentRow);
      return acc;
    }, new Map<string, Record<string, string | number>>()).values(),
  );
  const issueTypeTiles = issueTypeRows.map((r, i) => ({
    name: String(r.complaint_type),
    requests: N(r.requests),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const typeResolution = typeResolutionRows.map((r) => ({
    name: String(r.complaint_type),
    requests: N(r.requests),
    resolutionRate: N(r.resolution_rate),
    medianDays: N(r.median_hours) / 24,
  }));
  const agencyResolution = agencyResolutionRows.map((r) => ({
    name: String(r.agency),
    requests: N(r.requests),
    resolutionRate: N(r.resolution_rate),
    medianDays: N(r.median_hours) / 24,
  }));

  const slides = [
    <SlideShell key="overview">
      <Header
        eyebrow="Years 2010-2023"
        title="NYC 311 service requests"
        sub="Non-emergency requests across housing, parking, noise, waste, air quality, streets, and other quality-of-life services."
      />
      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "16px" }}>
        <Kpi label="Requests" value={fmt(total)} tone={MD.yellow} loading={overview.isLoading} />
        <Kpi label="Closed" value={pct(closed, total)} tone={MD.teal} loading={overview.isLoading} />
        <Kpi label="Issue Types" value={fmt(N(overviewRow?.complaint_types))} tone={MD.cyan} loading={overview.isLoading} />
        <Kpi label="Avg Close Time" value={`${fmt(N(overviewRow?.avg_hours_to_close))}h`} tone={MD.red} loading={overview.isLoading} />
      </div>
      <Card accent={MD.orange}>
        <div>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 900, margin: "0 0 14px" }}>Issue types in the dataset</h2>
            {issueTypes.isLoading ? (
              <div style={{ color: MD.dim, height: 180, display: "grid", placeItems: "center", fontWeight: 700 }}>Loading issue types...</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {issueTypeTiles.map((issue) => (
                  <div
                    key={issue.name}
                    style={{
                      background: MD.panel,
                      border: `1px solid ${MD.border}`,
                      color: MD.text,
                      fontSize: "11px",
                      fontWeight: 800,
                      lineHeight: 1,
                      padding: "8px 10px",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ color: issue.color, marginRight: "6px" }}>{fmt(issue.requests)}</span>
                    {issue.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </SlideShell>,

    <SlideShell key="boroughs">
      <Header
        eyebrow="Borough"
        title="Request volume through the years"
        sub="Annual 311 service request counts by incident borough. 2023 data runs through March 12."
      />
      <Card accent={MD.cyan}>
        {boroughs.isLoading ? (
          <div style={{ color: MD.dim, height: 330, display: "grid", placeItems: "center", fontWeight: 700 }}>Loading borough trend...</div>
        ) : (
          <ResponsiveContainer width="100%" height={330}>
            <LineChart data={boroughData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={MD.border} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: MD.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: MD.dim, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number, name: string) => [fmt(N(v)), boroughLabels[name] || name]} />
              {boroughSeries.map((borough) => (
                <Line
                  key={borough}
                  type="linear"
                  dataKey={borough}
                  name={borough}
                  stroke={boroughColor[borough]}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, stroke: MD.bg, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", marginTop: "12px" }}>
          {boroughSeries.map((borough) => (
            <div key={borough} style={{ alignItems: "center", color: MD.muted, display: "flex", fontSize: "12px", fontWeight: 700, gap: "8px" }}>
              <span style={{ background: boroughColor[borough], display: "block", height: "3px", width: "22px" }} />
              {boroughLabels[borough]}
            </div>
          ))}
        </div>
      </Card>
    </SlideShell>,

    <SlideShell key="issues">
      <Header
        eyebrow="Resolution"
        title="Resolution rate and median time"
        sub="Resolution rate is share of requests with a valid closed_date. Median time is calculated across resolved requests."
      />
      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
        <ResolutionRates
          title="By complaint type"
          label="Type"
          rows={typeResolution}
          loading={resolutionByType.isLoading}
          accent={MD.teal}
        />
        <ResolutionRates
          title="By department"
          label="Agency"
          rows={agencyResolution}
          loading={resolutionByAgency.isLoading}
          accent={MD.red}
        />
      </div>
    </SlideShell>,
  ];

  return (
    <div
      style={{
        alignItems: "center",
        background: MD.bg,
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "18px",
      }}
    >
      <div
        onClick={handleSlideClick}
        style={{
          aspectRatio: "16 / 9",
          background: MD.bg,
          cursor: "pointer",
          maxHeight: "calc(100vh - 36px)",
          maxWidth: "calc(100vw - 36px)",
          overflow: "hidden",
          position: "relative",
          width: "min(1180px, calc((100vh - 36px) * 1.7778), calc(100vw - 36px))",
        }}
      >
        {slides[current]}
        <div
          style={{
            background: MD.orange,
            bottom: 0,
            height: "4px",
            left: 0,
            position: "absolute",
            transition: "width 0.25s ease",
            width: `${((current + 1) / totalSlides) * 100}%`,
            zIndex: 10,
          }}
        />
        <div
          style={{
            bottom: "14px",
            color: MD.orange,
            display: "flex",
            fontSize: "12px",
            fontWeight: 800,
            gap: "4px",
            letterSpacing: "0.14em",
            position: "absolute",
            right: "22px",
            zIndex: 10,
          }}
        >
          <span>{String(current + 1).padStart(2, "0")}</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ opacity: 0.5 }}>{String(totalSlides).padStart(2, "0")}</span>
        </div>
      </div>
    </div>
  );
}
