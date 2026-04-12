'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

const mockAlerts = [
  {
    id: 1,
    type: 'mention',
    title: 'Competitor mention spike',
    description: 'Nestlé Vietnam mentions increased by 250% on TikTok',
    group: 'Dairy Products',
    timestamp: '2 hours ago',
    severity: 'high',
    read: false,
  },
  {
    id: 2,
    type: 'engagement',
    title: 'Viral post detected',
    description: 'Your post "Summer Collection" reached 1.2M engagement',
    group: 'Cosmetics & Beauty',
    timestamp: '4 hours ago',
    severity: 'medium',
    read: false,
  },
  {
    id: 3,
    type: 'milestone',
    title: 'Follower milestone',
    description: 'Reached 100K followers on TikTok',
    group: 'All',
    timestamp: '1 day ago',
    severity: 'low',
    read: true,
  },
  {
    id: 4,
    type: 'mention',
    title: 'Negative sentiment detected',
    description: 'Multiple critical comments on Instagram post',
    group: 'E-commerce Platform',
    timestamp: '2 days ago',
    severity: 'high',
    read: true,
  },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-700 border-green-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(mockAlerts);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread') return !alert.read;
    if (filter === 'high') return alert.severity === 'high';
    return true;
  });

  const handleMarkAsRead = (id: number) => {
    setAlerts(
      alerts.map((alert) =>
        alert.id === id ? { ...alert, read: true } : alert
      )
    );
  };

  const handleDeleteAlert = (id: number) => {
    setAlerts(alerts.filter((alert) => alert.id !== id));
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display">Alerts & Notifications</h2>
          <p className="text-muted-foreground mt-1">
            Stay updated with real-time competitive intelligence
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            {unreadCount} unread
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'unread', 'high'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'High Priority'}
          </Button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <Card className="p-8 text-center bg-card border border-border">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No alerts to display</p>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-4 border transition-all cursor-pointer ${
                alert.read
                  ? 'bg-card border-border'
                  : 'bg-foreground/5 border-foreground/20'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="mt-1">
                  {alert.read ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{alert.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {alert.description}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs bg-foreground/10 px-2 py-1 rounded">
                          {alert.group}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded border ${getSeverityColor(
                          alert.severity
                        )}`}>
                          {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {alert.timestamp}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {!alert.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(alert.id)}
                        >
                          Mark read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAlert(alert.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
