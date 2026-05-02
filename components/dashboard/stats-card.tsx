'use client';

import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  trend,
}: StatsCardProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-500' },
    green: { bg: 'bg-green-50', icon: 'text-green-500' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-500' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-500' },
    red: { bg: 'bg-red-50', icon: 'text-red-500' },
  };

  const { bg, icon: iconColor } = colorClasses[color];

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${bg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>

      {trend && (
        <div
          className={`text-xs font-medium ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
        </div>
      )}
    </Card>
  );
}
