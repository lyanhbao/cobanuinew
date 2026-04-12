'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { UserPlus, Trash2, Mail, Shield } from 'lucide-react';
import type { ClientRole } from '@/lib/types';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: ClientRole;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<ClientRole, string> = {
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<ClientRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  analyst: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function TeamPage() {
  const { clientId } = useApp();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ClientRole>('viewer');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/clients/${clientId}/members`)
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return; }
    if (!clientId) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed to invite');
      setMembers((prev) => [...prev, d.data ?? d.member]);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('viewer');
      toast.success('Invitation sent');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/members/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleUpdateRole = async (id: string, role: ClientRole) => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display">Team Management</h2>
          <p className="text-muted-foreground mt-1">Manage team members and their permissions</p>
        </div>
        <Button className="gap-2" onClick={() => setShowInviteModal(true)}>
          <UserPlus className="w-4 h-4" />
          Invite Member
        </Button>
      </div>

      {/* Team Members Table */}
      <Card className="overflow-hidden bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.full_name || '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{member.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={member.role} onValueChange={(v) => handleUpdateRole(member.id, v as ClientRole)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${member.is_active ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-xs capitalize">{member.is_active ? 'Active' : 'Pending'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No team members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Permissions Guide */}
      <Card className="p-6 bg-card border border-border">
        <h3 className="text-lg font-semibold mb-4">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { role: 'Admin', color: 'bg-purple-100 text-purple-700', perms: ['Full access', 'Manage members', 'Edit groups', 'View all data'] },
            { role: 'Analyst', color: 'bg-blue-100 text-blue-700', perms: ['View all data', 'Create groups', 'Add brands', 'Export reports'] },
            { role: 'Viewer', color: 'bg-gray-100 text-gray-700', perms: ['View assigned groups', 'View reports', 'Comment on activity', 'No edit access'] },
          ].map((item) => (
            <div key={item.role} className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" /> {item.role}
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {item.perms.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <span className="text-xs">+</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <Input
                type="email"
                placeholder="member@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as ClientRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
