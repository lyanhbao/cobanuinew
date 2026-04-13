'use client';

import { useState, useEffect } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface PieChartDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface AnimatedPieChartProps {
  data: PieChartDataItem[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number | string;
  outerRadius?: number | string;
  animationDuration?: number;
  colors?: string[];
  className?: string;
}

export function AnimatedPieChart({
  data,
  height = 300,
  showLegend = true,
  innerRadius = '40%',
  outerRadius = '70%',
  animationDuration = 900,
  colors,
  className,
}: AnimatedPieChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay to ensure entrance animation is visible
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Fallback palette if no colors provided on data items
  const defaultColors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#ef4444',
  ];

  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          isAnimationActive={mounted}
          animationDuration={animationDuration}
          animationEasing="ease-out"
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color ?? colors?.[index] ?? defaultColors[index % defaultColors.length]}
              stroke="none"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [value.toLocaleString(), name]}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
            )}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
