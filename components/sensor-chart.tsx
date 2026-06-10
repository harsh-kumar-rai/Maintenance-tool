"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { Sensor } from "@/lib/demo-data"

const chartConfig = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig

export function SensorChart({
  sensor,
  height = 160,
  showThreshold = true,
}: {
  sensor: Sensor
  height?: number
  showThreshold?: boolean
}) {
  const danger = sensor.threshold < sensor.nominal
  const exceeding = danger
    ? sensor.current <= sensor.threshold * 1.05
    : sensor.current >= sensor.threshold * 0.85

  const color = exceeding ? "var(--chart-2)" : "var(--chart-1)"

  return (
    <ChartContainer
      config={chartConfig}
      className="w-full"
      style={{ height }}
    >
      <AreaChart data={sensor.history} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          interval="preserveStartEnd"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
        />
        <YAxis
          width={42}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value} ${sensor.unit}`, sensor.name]}
            />
          }
        />
        {showThreshold ? (
          <ReferenceLine
            y={sensor.threshold}
            stroke="var(--destructive)"
            strokeDasharray="4 4"
            label={{
              value: "threshold",
              position: "insideTopRight",
              fontSize: 10,
              fill: "var(--destructive)",
            }}
          />
        ) : null}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.12}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
