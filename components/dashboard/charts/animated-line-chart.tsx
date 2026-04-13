'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';

export interface AnimatedLineChartProps {
  data: Record<string, unknown>[];
  lines: Array<{
    dataKey: string;
    stroke?: string;
    name?: string;
    strokeWidth?: number;
    dot?: boolean;
    activeDot?: boolean;
  }>;
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  animationDuration?: number;
  className?: string;
}

export function AnimatedLineChart({
  data,
  lines,
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  showLegend = true,
  animationDuration = 1200,
  className,
}: AnimatedLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <RechartsLineChart
        data={data}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
          />
        )}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: 12,
          }}
          cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {lines.map((line, index) => (
          <Line
            key={line.dataKey}
            dataKey={line.dataKey}
            name={line.name ?? line.dataKey}
            stroke={line.stroke}
            strokeWidth={line.strokeWidth ?? 2}
            dot={line.dot ?? false}
            activeDot={line.activeDot !== false ? { r: 4 } : false}
            isAnimationActive={true}
            animationDuration={animationDuration}
            animationBegin={index * 150}
            animationEasing="ease-out"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
