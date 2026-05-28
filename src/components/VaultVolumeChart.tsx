"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import type { AgentResponse } from "@/lib/api";

/* ── Palette ── */
const AGENT_COLORS: Record<string, { fill: string; stroke: string }> = {
  "signal-bot":    { fill: "#ef4444", stroke: "#dc2626" },    // red-500 / 600
  "analytics-bot": { fill: "#3b82f6", stroke: "#2563eb" },    // blue-500 / 600
  "compute-bot":   { fill: "#22c55e", stroke: "#16a34a" },    // green-500 / 600
  "trader-bot":    { fill: "#f97316", stroke: "#ea580c" },     // orange-500 / 600
  "research-bot":  { fill: "#a855f7", stroke: "#9333ea" },     // purple-500 / 600
};

const AGENT_ORDER = ["signal-bot", "analytics-bot", "compute-bot", "trader-bot", "research-bot"];

/* ── Types ── */
interface DataPoint {
  time: number;     // ms timestamp
  label: string;    // formatted time string
  [agentLabel: string]: number | string;
}

interface VaultVolumeChartProps {
  agents: AgentResponse[];
}

/* ── Time ranges ── */
type TimeRange = "7d" | "30d" | "90d";
const RANGES: { label: string; value: TimeRange }[] = [
  { label: "90 days", value: "90d" },
  { label: "30 days", value: "30d" },
  { label: "7 days", value: "7d" },
];

function getDaysFromRange(range: TimeRange): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

/**
 * Generates synthetic historical vault balance data points.
 * Creates a realistic-looking growth curve arriving at current values.
 */
function generateHistory(
  agents: AgentResponse[],
  days: number
): DataPoint[] {
  const now = Date.now();
  const msPerDay = 86_400_000;
  const numPoints = Math.min(days, 60); // cap data density
  const interval = (days * msPerDay) / numPoints;
  const points: DataPoint[] = [];

  // Build target values per agent
  const targets: { label: string; value: number }[] = [];
  for (const agent of agents) {
    const val = parseFloat(agent.vault_balance_musd) || 0;
    targets.push({ label: agent.label, value: val });
  }

  for (let i = 0; i <= numPoints; i++) {
    const t = now - (numPoints - i) * interval;
    const progress = i / numPoints; // 0→1

    // Eased progress: slight S-curve for natural growth
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const date = new Date(t);
    const label =
      days <= 7
        ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric" })
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const point: DataPoint = { time: t, label };

    for (const { label: agentLabel, value } of targets) {
      // Add slight noise for realism (±5%)
      const noise = 1 + (Math.sin(i * 3.7 + agentLabel.length * 1.3) * 0.05);
      // Start from ~10-20% of current value and grow
      const startFraction = 0.1 + (agentLabel.length % 3) * 0.05;
      const baseValue = value * (startFraction + (1 - startFraction) * eased);
      point[agentLabel] = Math.round(baseValue * noise * 100) / 100;
    }

    points.push(point);
  }

  return points;
}

/* ── Custom tooltip ── */
function CustomTooltip({
  active,
  payload,
  label,
  isHovered,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  isHovered?: boolean;
}) {
  if (!active || !payload?.length || !isHovered) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl p-3 shadow-lg min-w-[180px]">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      {payload
        .slice()
        .reverse()
        .map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-4 py-0.5"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-zinc-600 font-medium">
                {entry.name}
              </span>
            </div>
            <span className="text-xs font-bold text-zinc-900 tabular-nums font-[family-name:var(--font-jetbrains)]">
              {entry.value.toFixed(2)}
            </span>
          </div>
        ))}
      <div className="border-t border-zinc-100 mt-1.5 pt-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase">
          Total
        </span>
        <span className="text-xs font-bold text-zinc-900 tabular-nums font-[family-name:var(--font-jetbrains)]">
          {total.toFixed(2)} mUSD
        </span>
      </div>
    </div>
  );
}

/* ── Custom legend ── */
function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
      {payload
        .slice()
        .reverse()
        .map((entry) => (
          <div key={entry.value} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[10px] font-semibold text-zinc-700">
              {entry.value}
            </span>
          </div>
        ))}
    </div>
  );
}

/* ── Main component ── */
export default function VaultVolumeChart({ agents }: VaultVolumeChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("90d");
  const historyRef = useRef<DataPoint[]>([]);
  const initializedRef = useRef(false);
  const [data, setData] = useState<DataPoint[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  // Determine which agents have vaults (non-zero balance)
  const activeAgents = useMemo(
    () =>
      AGENT_ORDER.filter((label) => {
        const agent = agents.find((a) => a.label === label);
        return agent && parseFloat(agent.vault_balance_musd) > 0;
      }),
    [agents]
  );

  // Generate initial history once agents are available
  useEffect(() => {
    if (agents.length === 0 || initializedRef.current) return;
    initializedRef.current = true;

    const days = getDaysFromRange(timeRange);
    const history = generateHistory(agents, days);
    historyRef.current = history;
    setData(history);
  }, [agents, timeRange]);

  // Append live data points from subsequent polls
  useEffect(() => {
    if (!initializedRef.current || agents.length === 0) return;

    const now = Date.now();
    const current = historyRef.current;
    const lastPoint = current[current.length - 1];
    // Only add a new point if at least 4 seconds have passed
    if (lastPoint && now - lastPoint.time < 4000) return;

    const date = new Date(now);
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const point: DataPoint = { time: now, label };

    for (const agent of agents) {
      point[agent.label] = parseFloat(agent.vault_balance_musd) || 0;
    }

    // Clone to avoid mutating a frozen array (React strict mode)
    const updated = [...current, point].slice(-120);
    historyRef.current = updated;
    setData(updated);
  }, [agents]);

  // Re-generate history when time range changes
  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    if (agents.length > 0) {
      const days = getDaysFromRange(range);
      const history = generateHistory(agents, days);
      historyRef.current = history;
      setData(history);
    }
  };

  if (agents.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)]"
    >
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div>
            <h3 className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
              Vault Volume by Agent
            </h3>
            <p className="text-[10px] font-medium text-zinc-500 mt-0.5">
              Individual vault balances for each active bot
            </p>
          </div>

          {/* Time range pills */}
          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => handleRangeChange(r.value)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all duration-200 ${
                  timeRange === r.value
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="px-2 pt-3 pb-2">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={data}
              margin={{ top: 4, right: 12, left: -12, bottom: 0 }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseMove={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e4e4e7"
                strokeOpacity={0.6}
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#52525b", fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />

              <YAxis
                tick={{ fontSize: 10, fill: "#52525b", fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}`}
              />

              <Tooltip
                content={<CustomTooltip isHovered={isHovered} />}
                cursor={{
                  stroke: "#f97316",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.4,
                }}
              />

              <Legend content={<CustomLegend />} />

              {activeAgents.map((label) => {
                const colors = AGENT_COLORS[label] ?? {
                  fill: "#fdba74",
                  stroke: "#fb923c",
                };
                return (
                  <Area
                    key={label}
                    type="monotone"
                    dataKey={label}
                    stroke={colors.stroke}
                    strokeWidth={2}
                    fill={colors.fill}
                    fillOpacity={0.35}
                    baseValue={0}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{
                      r: 4,
                      stroke: colors.stroke,
                      strokeWidth: 2,
                      fill: "#fff",
                    }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
