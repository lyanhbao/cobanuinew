'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type BarProps,
  type TooltipProps,
  type LegendProps,
} from 'recharts';

export interface AnimatedBarChartProps {
  data: Record<string, unknown>[];
  bars: Array<{
    dataKey: string;
    fill?: string;
    name?: string;
    stackId?: string;
  }>;
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  animationDuration?: number;
  className?: string;
}

export function AnimatedBarChart({
  data,
  bars,
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  showLegend = true,
  animationDuration = 800,
  className,
}: AnimatedBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <RechartsBarChart
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
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {bars.map((bar, index) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name ?? bar.dataKey}
            stackId={bar.stackId}
            fill={bar.fill}
            isAnimationActive={true}
            animationDuration={animationDuration}
            animationBegin={index * 100}
            animationEasing="ease-out"
            radius={bar.stackId ? [0, 0, 0, 0] : [3, 3, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
