'use client';

import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface RadarChartDataItem {
  metric: string;
  [key: string]: unknown;
}

export interface AnimatedRadarChartProps {
  data: RadarChartDataItem[];
  dataKey: string;
  name?: string;
  fill?: string;
  height?: number;
  showLegend?: boolean;
  animationDuration?: number;
  className?: string;
}

export function AnimatedRadarChart({
  data,
  dataKey,
  name,
  fill = '#6366f1',
  height = 300,
  showLegend = true,
  animationDuration = 900,
  className,
}: AnimatedRadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <RechartsRadarChart cx="50%" cy="50%" margin={{ top: 0, right: 24, bottom: 0, left: 24 }}>
        <PolarGrid
          stroke="hsl(var(--border))"
          strokeOpacity={0.6}
        />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 'auto']}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          stroke="hsl(var(--border))"
          strokeOpacity={0.4}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: 12,
          }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
        )}
        <Radar
          name={name ?? dataKey}
          dataKey={dataKey}
          stroke={fill}
          fill={fill}
          fillOpacity={0.25}
          isAnimationActive={true}
          animationDuration={animationDuration}
          animationEasing="ease-out"
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
