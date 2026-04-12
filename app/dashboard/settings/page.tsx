'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { User, Lock, Bell, Palette, Check } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Profile updated');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to change password');
      }
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-display">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-11 px-1 data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:shadow-none rounded-none bg-transparent data-[state=active]:bg-transparent gap-2"
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card className="p-6 bg-card border border-border">
            <h3 className="text-lg font-semibold mb-4">Account Information</h3>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input value={user?.email ?? ''} disabled />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : saved ? (
                    <><Check className="w-4 h-4 mr-2" />Saved</>
                  ) : 'Save Changes'}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card border border-border">
            <h3 className="text-lg font-semibold mb-4">Plan Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <Badge>Professional</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Renewal Date</span>
                <span className="font-medium">May 15, 2025</span>
              </div>
              <Separator />
              <Button variant="outline">Upgrade Plan</Button>
            </div>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="p-6 bg-card border border-border">
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? 'Changing...' : 'Update Password'}
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-card border border-border">
            <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
            <div className="space-y-3">
              {[
                { device: 'Chrome on macOS', ip: '192.168.1.1', last: 'Just now', current: true },
                { device: 'Safari on iPhone', ip: '192.168.1.2', last: '2 hours ago', current: false },
              ].map((session, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{session.device}</p>
                    <p className="text-xs text-muted-foreground">{session.ip} · {session.last}</p>
                  </div>
                  {session.current && <Badge variant="secondary">Current</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6">
          <Card className="p-6 bg-card border border-border">
            <h3 className="text-lg font-semibold mb-6">Notification Preferences</h3>
            <div className="space-y-4 max-w-lg">
              {[
                { id: 'email_alerts', label: 'Email alerts for high-priority events', default: true },
                { id: 'daily_digest', label: 'Daily digest email', default: true },
                { id: 'weekly_report', label: 'Weekly performance report', default: true },
                { id: 'competitor_mentions', label: 'New competitor mentions', default: true },
                { id: 'viral_posts', label: 'Viral post alerts', default: false },
              ].map((notif) => (
                <div key={notif.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <label className="text-sm font-medium cursor-pointer">{notif.label}</label>
                  <input
                    type="checkbox"
                    defaultChecked={notif.default}
                    className="w-4 h-4 cursor-pointer accent-foreground"
                  />
                </div>
              ))}
              <Button className="mt-2">Save Preferences</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
