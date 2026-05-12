/**
 * Title: NYC 311 Faceoff
 * Description: Two-choice trivia game built from NYC 311 service request data
 */

import { useMemo, useState } from "react";
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

type Option = {
  id: "a" | "b";
  label: string;
  value: number;
  displayValue: string;
};

type Question = {
  id: string;
  eyebrow: string;
  prompt: string;
  metric: string;
  mode: "higher" | "lower";
  options: [Option, Option];
  answerId: "a" | "b";
  explanation: string;
};

type QuestionType = "complaint" | "borough" | "agency" | "resolution";

const TOTAL_ROUNDS = 10;

function fmt(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return Math.round(v).toLocaleString();
}

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

function hours(v: number) {
  if (v >= 48) return `${(v / 24).toFixed(1)} days`;
  return `${v.toFixed(1)} hours`;
}

function titleCase(v: string) {
  return v
    .toLowerCase()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function winnerId(a: Option, b: Option, mode: "higher" | "lower"): "a" | "b" {
  if (mode === "higher") return a.value >= b.value ? "a" : "b";
  return a.value <= b.value ? "a" : "b";
}

function makeQuestion({
  id,
  eyebrow,
  prompt,
  metric,
  mode,
  a,
  b,
  explanation,
  swap = false,
}: {
  id: string;
  eyebrow: string;
  prompt: string;
  metric: string;
  mode: "higher" | "lower";
  a: Omit<Option, "id">;
  b: Omit<Option, "id">;
  explanation: string;
  swap?: boolean;
}): Question {
  const left = swap ? b : a;
  const right = swap ? a : b;
  const optionA = { id: "a" as const, ...left };
  const optionB = { id: "b" as const, ...right };

  return {
    id,
    eyebrow,
    prompt,
    metric,
    mode,
    options: [optionA, optionB],
    answerId: winnerId(optionA, optionB, mode),
    explanation,
  };
}

function seededSortValue(seed: number, index: number) {
  const raw = Math.sin(seed * 10000 + index * 9973) * 10000;
  return raw - Math.floor(raw);
}

function shuffleTypes(seed: number) {
  return (["complaint", "borough", "agency", "resolution"] as QuestionType[])
    .map((type, index) => ({ type, sort: seededSortValue(seed, index) }))
    .sort((a, b) => a.sort - b.sort)
    .map((entry) => entry.type);
}

function mixQuestionTypes(buckets: Record<QuestionType, Question[]>, seed: number) {
  const typeOrder = shuffleTypes(seed);
  const mixed: Question[] = [];
  const maxLength = Math.max(...typeOrder.map((type) => buckets[type].length));

  for (let index = 0; index < maxLength; index += 1) {
    typeOrder.forEach((type) => {
      const question = buckets[type][index];
      if (question) mixed.push(question);
    });
  }

  return mixed;
}

function buildQuestions({
  complaintRows,
  boroughRows,
  agencyRows,
  resolutionRows,
  seed,
}: {
  complaintRows: Array<Record<string, unknown>>;
  boroughRows: Array<Record<string, unknown>>;
  agencyRows: Array<Record<string, unknown>>;
  resolutionRows: Array<Record<string, unknown>>;
  seed: number;
}) {
  const buckets: Record<QuestionType, Question[]> = {
    complaint: [],
    borough: [],
    agency: [],
    resolution: [],
  };
  const complaints = complaintRows.map((r) => ({
    name: String(r.complaint_type),
    requests: N(r.requests),
  }));
  const boroughs = boroughRows.map((r) => ({
    name: titleCase(String(r.borough)),
    requests: N(r.requests),
  }));
  const agencies = agencyRows.map((r) => ({
    name: String(r.agency),
    requests: N(r.requests),
    medianHours: N(r.median_hours),
  }));
  const resolutions = resolutionRows.map((r) => ({
    name: String(r.complaint_type),
    requests: N(r.requests),
    resolutionRate: N(r.resolution_rate),
  }));

  const complaintPairs: Array<[number, number]> = [[0, 1], [1, 3], [2, 5]];
  complaintPairs.forEach(([left, right], i) => {
    const a = complaints[left];
    const b = complaints[right];
    if (!a || !b) return;
    buckets.complaint.push(makeQuestion({
      id: `complaint-${i}`,
      eyebrow: "Highest volume type",
      prompt: "Which complaint type appears more often?",
      metric: "Total requests",
      mode: "higher",
      a: { label: a.name, value: a.requests, displayValue: fmt(a.requests) },
      b: { label: b.name, value: b.requests, displayValue: fmt(b.requests) },
      explanation: `${a.name}: ${fmt(a.requests)} requests. ${b.name}: ${fmt(b.requests)} requests.`,
      swap: seededSortValue(seed, i + 101) > 0.5,
    }));
  });

  const boroughPairs: Array<[number, number]> = [[0, 1], [1, 2], [2, 4]];
  boroughPairs.forEach(([left, right], i) => {
    const a = boroughs[left];
    const b = boroughs[right];
    if (!a || !b) return;
    buckets.borough.push(makeQuestion({
      id: `borough-${i}`,
      eyebrow: "Highest volume borough",
      prompt: "Which borough has more 311 requests?",
      metric: "Total requests",
      mode: "higher",
      a: { label: a.name, value: a.requests, displayValue: fmt(a.requests) },
      b: { label: b.name, value: b.requests, displayValue: fmt(b.requests) },
      explanation: `${a.name}: ${fmt(a.requests)} requests. ${b.name}: ${fmt(b.requests)} requests.`,
      swap: seededSortValue(seed, i + 201) > 0.5,
    }));
  });

  const agencyPairs: Array<[number, number]> = [[0, 2], [1, 4], [2, 5]];
  agencyPairs.forEach(([left, right], i) => {
    const a = agencies[left];
    const b = agencies[right];
    if (!a || !b) return;
    buckets.agency.push(makeQuestion({
      id: `agency-${i}`,
      eyebrow: "Fastest median resolution department",
      prompt: "Which agency has faster median resolution?",
      metric: "Median close time",
      mode: "lower",
      a: { label: a.name, value: a.medianHours, displayValue: hours(a.medianHours) },
      b: { label: b.name, value: b.medianHours, displayValue: hours(b.medianHours) },
      explanation: `${a.name}: ${hours(a.medianHours)} median. ${b.name}: ${hours(b.medianHours)} median.`,
      swap: seededSortValue(seed, i + 301) > 0.5,
    }));
  });

  const resolutionPairs: Array<[number, number]> = [[0, 11], [4, 10], [6, 9]];
  resolutionPairs.forEach(([left, right], i) => {
    const a = resolutions[left];
    const b = resolutions[right];
    if (!a || !b) return;
    buckets.resolution.push(makeQuestion({
      id: `resolution-${i}`,
      eyebrow: "Highest resolution category",
      prompt: "Which category has higher resolution rate?",
      metric: "Resolution rate",
      mode: "higher",
      a: { label: a.name, value: a.resolutionRate, displayValue: pct(a.resolutionRate) },
      b: { label: b.name, value: b.resolutionRate, displayValue: pct(b.resolutionRate) },
      explanation: `${a.name}: ${pct(a.resolutionRate)} resolved. ${b.name}: ${pct(b.resolutionRate)} resolved.`,
      swap: seededSortValue(seed, i + 401) > 0.5,
    }));
  });

  return mixQuestionTypes(buckets, seed);
}

function Stat({ label, value, tone = MD.text }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <div style={{ color: tone, fontSize: "26px", fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ color: MD.muted, fontSize: "10px", fontWeight: 800, letterSpacing: "0.11em", marginTop: "7px", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div style={{ background: MD.surface, border: `1px solid ${MD.border}`, borderRadius: "4px", boxShadow: "0 18px 42px rgba(0,0,0,0.24)", padding: "28px" }}>
      <div style={{ color: MD.orange, fontSize: "12px", fontWeight: 900, letterSpacing: "0.14em", marginBottom: "12px", textTransform: "uppercase" }}>
        Loading questions
      </div>
      <div style={{ background: MD.panel, height: "18px", marginBottom: "10px", width: "80%" }} />
      <div style={{ background: MD.panel, height: "18px", marginBottom: "22px", width: "58%" }} />
      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ background: MD.panel, height: "116px" }} />
        <div style={{ background: MD.panel, height: "116px" }} />
      </div>
    </div>
  );
}

export default function NYC311Faceoff() {
  const [questionSeed, setQuestionSeed] = useState(() => Math.random());
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<"a" | "b" | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [finished, setFinished] = useState(false);

  const complaintVolume = useSQLQuery(`
    SELECT complaint_type, COUNT(*) AS requests
    FROM "sample_data"."nyc"."service_requests"
    WHERE complaint_type IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 8
  `);

  const boroughVolume = useSQLQuery(`
    SELECT borough, COUNT(*) AS requests
    FROM "sample_data"."nyc"."service_requests"
    WHERE borough IN ('BROOKLYN', 'QUEENS', 'MANHATTAN', 'BRONX', 'STATEN ISLAND')
    GROUP BY 1
    ORDER BY 2 DESC
  `);

  const agencySpeed = useSQLQuery(`
    SELECT agency,
           COUNT(*) AS requests,
           ROUND(median(date_diff('hour', created_date, closed_date)), 1) AS median_hours
    FROM "sample_data"."nyc"."service_requests"
    WHERE agency IS NOT NULL
      AND agency <> '3-1-1'
      AND created_date IS NOT NULL
      AND closed_date IS NOT NULL
      AND closed_date >= created_date
    GROUP BY 1
    HAVING COUNT(*) >= 5000
       AND median(date_diff('hour', created_date, closed_date)) > 0
    ORDER BY median_hours ASC
    LIMIT 8
  `);

  const categoryResolution = useSQLQuery(`
    WITH high_volume AS (
      SELECT complaint_type,
             COUNT(*) AS requests,
             ROUND(100.0 * COUNT(*) FILTER (WHERE closed_date IS NOT NULL AND closed_date >= created_date) / COUNT(*), 1) AS resolution_rate
      FROM "sample_data"."nyc"."service_requests"
      WHERE complaint_type IS NOT NULL
        AND created_date IS NOT NULL
      GROUP BY 1
      ORDER BY requests DESC
      LIMIT 12
    )
    SELECT complaint_type, requests, resolution_rate
    FROM high_volume
    ORDER BY resolution_rate DESC, requests DESC
  `);

  const questions = useMemo(
    () => buildQuestions({
      complaintRows: Array.isArray(complaintVolume.data) ? complaintVolume.data : [],
      boroughRows: Array.isArray(boroughVolume.data) ? boroughVolume.data : [],
      agencyRows: Array.isArray(agencySpeed.data) ? agencySpeed.data : [],
      resolutionRows: Array.isArray(categoryResolution.data) ? categoryResolution.data : [],
      seed: questionSeed,
    }),
    [complaintVolume.data, boroughVolume.data, agencySpeed.data, categoryResolution.data, questionSeed],
  );

  const isLoading = complaintVolume.isLoading || boroughVolume.isLoading || agencySpeed.isLoading || categoryResolution.isLoading;
  const current = questions.length ? questions[round % questions.length] : null;
  const answered = selected != null;
  const correct = answered && current ? selected === current.answerId : false;
  const progress = finished ? 100 : ((round + 1) / TOTAL_ROUNDS) * 100;

  const answer = (choice: "a" | "b") => {
    if (!current || selected) return;
    const didWin = choice === current.answerId;
    setSelected(choice);
    if (didWin) {
      setScore((value) => value + 1);
      setStreak((value) => {
        const next = value + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
      return;
    }
    setStreak(0);
  };

  const next = () => {
    if (round + 1 >= TOTAL_ROUNDS) {
      setFinished(true);
      return;
    }
    setRound((value) => value + 1);
    setSelected(null);
  };

  const reset = () => {
    setRound(0);
    setSelected(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setFinished(false);
    setQuestionSeed(Math.random());
  };

  return (
    <div style={{ background: MD.bg, color: MD.text, fontFamily: "Inter, Arial, sans-serif", minHeight: "100vh", padding: "42px 18px 18px" }}>
      <style>{`
        @keyframes popIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        button:focus-visible { outline: 2px solid ${MD.yellow}; outline-offset: 3px; }
        @media (max-width: 720px) {
          .faceoff-header { display: block !important; }
          .faceoff-title { font-size: 34px !important; }
          .faceoff-stats { margin-top: 16px; min-width: 0 !important; text-align: left !important; width: 100%; }
          .faceoff-options { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <main style={{ margin: "0 auto", maxWidth: "980px" }}>
        <header className="faceoff-header" style={{ alignItems: "flex-start", display: "flex", gap: "18px", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div style={{ color: MD.orange, fontSize: "11px", fontWeight: 900, letterSpacing: "0.15em", marginBottom: "8px", textTransform: "uppercase" }}>
              NYC 311 trivia
            </div>
            <h1 className="faceoff-title" style={{ color: MD.text, fontSize: "42px", fontWeight: 950, letterSpacing: 0, lineHeight: 0.95, margin: 0 }}>
              NYC 311 Faceoff
            </h1>
          </div>
          <div className="faceoff-stats" style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(3, minmax(70px, 1fr))", minWidth: "300px", textAlign: "right" }}>
            <Stat label="Score" value={`${score}/${TOTAL_ROUNDS}`} tone={MD.yellow} />
            <Stat label="Streak" value={streak} tone={MD.teal} />
            <Stat label="Best" value={bestStreak} tone={MD.cyan} />
          </div>
        </header>

        <div style={{ background: MD.panel, border: `1px solid ${MD.border}`, borderRadius: "999px", height: "8px", marginBottom: "16px", overflow: "hidden", position: "relative" }}>
          <div style={{ background: MD.orange, height: "100%", left: 0, position: "absolute", top: 0, transition: "width 0.2s ease", width: `${progress}%` }} />
        </div>

        {isLoading || !current ? (
          <LoadingPanel />
        ) : finished ? (
          <section style={{ animation: "popIn 0.18s ease-out", background: MD.surface, border: `1px solid ${MD.border}`, borderTop: `3px solid ${MD.orange}`, borderRadius: "4px", boxShadow: "0 18px 42px rgba(0,0,0,0.24)", padding: "30px" }}>
            <div style={{ color: MD.orange, fontSize: "12px", fontWeight: 900, letterSpacing: "0.15em", marginBottom: "10px", textTransform: "uppercase" }}>
              Final score
            </div>
            <h2 style={{ fontSize: "54px", fontWeight: 950, lineHeight: 1, margin: "0 0 14px" }}>
              {score}/{TOTAL_ROUNDS}
            </h2>
            <p style={{ color: MD.muted, fontSize: "15px", fontWeight: 700, lineHeight: 1.45, margin: "0 0 24px", maxWidth: "560px" }}>
              Best streak: {bestStreak}. Questions used live NYC 311 counts, borough volume, agency median close time, and complaint resolution rates.
            </p>
            <button
              onClick={reset}
              type="button"
              style={{
                background: MD.orange,
                border: `1px solid ${MD.orange}`,
                borderRadius: "4px",
                color: MD.bg,
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 950,
                padding: "13px 18px",
                textTransform: "uppercase",
              }}
            >
              Play again
            </button>
          </section>
        ) : (
          <section style={{ animation: "popIn 0.18s ease-out", background: MD.surface, border: `1px solid ${MD.border}`, borderRadius: "4px", boxShadow: "0 18px 42px rgba(0,0,0,0.24)", padding: "24px" }}>
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
              <div style={{ color: MD.orange, fontSize: "11px", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Round {round + 1} / {TOTAL_ROUNDS}
              </div>
              <div style={{ color: MD.dim, fontSize: "11px", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {current.eyebrow}
              </div>
            </div>

            <h2 style={{ color: MD.text, fontSize: "32px", fontWeight: 950, lineHeight: 1.05, margin: "0 0 8px" }}>
              {current.prompt}
            </h2>
            <div style={{ color: MD.muted, fontSize: "13px", fontWeight: 800, marginBottom: "18px" }}>
              Metric: {current.metric}
            </div>

            <div className="faceoff-options" style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
              {current.options.map((option) => {
                const isPick = selected === option.id;
                const isAnswer = current.answerId === option.id;
                const border = answered && isAnswer ? MD.teal : answered && isPick ? MD.red : MD.border;

                return (
                  <button
                    key={option.id}
                    disabled={answered}
                    onClick={() => answer(option.id)}
                    type="button"
                    style={{
                      background: isPick ? MD.panel : MD.bg,
                      border: `1px solid ${border}`,
                      borderLeft: `3px solid ${border}`,
                      borderRadius: "4px",
                      boxShadow: "none",
                      color: MD.text,
                      cursor: answered ? "default" : "pointer",
                      minHeight: "150px",
                      padding: "18px",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ color: answered && isAnswer ? MD.teal : MD.orange, fontSize: "12px", fontWeight: 950, marginBottom: "12px" }}>
                      Option {option.id.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 950, lineHeight: 1.05, marginBottom: "16px" }}>
                      {option.label}
                    </div>
                    <div style={{ color: answered ? MD.text : MD.dim, fontSize: "18px", fontWeight: 900 }}>
                      {answered ? option.displayValue : "Pick"}
                    </div>
                  </button>
                );
              })}
            </div>

            {answered ? (
              <div style={{ borderTop: `1px solid ${MD.border}`, marginTop: "20px", paddingTop: "18px" }}>
                <div style={{ color: correct ? MD.teal : MD.red, fontSize: "18px", fontWeight: 950, marginBottom: "6px" }}>
                  {correct ? "Correct" : "Miss"}
                </div>
                <p style={{ color: MD.muted, fontSize: "14px", fontWeight: 700, lineHeight: 1.45, margin: "0 0 16px" }}>
                  {current.explanation}
                </p>
                <button
                  onClick={next}
                  type="button"
                  style={{
                    background: MD.orange,
                    border: `1px solid ${MD.orange}`,
                    borderRadius: "4px",
                    color: MD.bg,
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 950,
                    padding: "12px 16px",
                    textTransform: "uppercase",
                  }}
                >
                  {round + 1 >= TOTAL_ROUNDS ? "Finish" : "Next question"}
                </button>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
