'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp } from '@/context/AppContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, TrendingUp, FolderOpen, Trash2, Settings, ChevronRight } from 'lucide-react';
import type { Group } from '@/lib/types';

export default function GroupsPage() {
  const router = useRouter();
  const { clientId, setGroupId } = useApp();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/clients/${clientId}/groups`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const list = d?.groups ?? d?.data ?? [];
        setGroups(list.length > 0 ? list : MOCK_GROUPS);
      })
      .catch(() => setGroups(MOCK_GROUPS))
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Group name is required'); return; }
    if (!clientId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, benchmark_category: newCategory }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed to create group');
      const created = d.data ?? d.group;
      setGroups((prev) => [...prev, created]);
      toast.success('Group created!');
      setCreateOpen(false);
      setNewName('');
      setNewCategory('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/groups/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      toast.success('Group deleted');
    } catch {
      toast.error('Failed to delete group');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSelectGroup = (group: Group) => {
    setGroupId(group.id);
    router.push(`/dashboard/groups/${group.id}`);
  };

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display">Competitive Groups</h2>
          <p className="text-sm text-muted-foreground">Organize and monitor brands by category</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Group
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Search groups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border">
          <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No groups found.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>Create your first group</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((group) => (
            <Card
              key={group.id}
              className="group cursor-pointer transition-all hover:border-foreground/30 overflow-hidden border-border"
              onClick={() => handleSelectGroup(group)}
            >
              <div className="h-1.5 bg-foreground" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{group.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(group.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary">{group.benchmark_category_id ? 'Active' : 'Draft'}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {group.is_active ? 'Active tracking' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={(e) => { e.stopPropagation(); handleSelectGroup(group); }}
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(group); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Add a new competitive tracking group for your client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-2">Group Name</label>
              <Input
                placeholder="e.g. Dairy Segment, Beauty Category"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Benchmark Category (optional)</label>
              <Input
                placeholder="e.g. Beverages, Personal Care"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.name}&rdquo; and all associated tracking data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const MOCK_GROUPS: Group[] = [
  {
    id: 'g1', client_id: 'c1', name: 'Dairy Products',
    benchmark_category_id: null, is_active: true,
    created_by: null, created_at: '2024-01-15T00:00:00Z', updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 'g2', client_id: 'c1', name: 'Cosmetics & Beauty',
    benchmark_category_id: null, is_active: true,
    created_by: null, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: 'g3', client_id: 'c1', name: 'E-commerce Platform',
    benchmark_category_id: null, is_active: true,
    created_by: null, created_at: '2024-02-10T00:00:00Z', updated_at: '2024-02-10T00:00:00Z',
  },
];