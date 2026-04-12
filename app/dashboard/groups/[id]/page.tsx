'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowLeft, Star, Crown } from 'lucide-react';
import type { Group, Brand, CuratedBrand } from '@/lib/types';
import AddBrandModal from '@/components/dashboard/AddBrandModal';

const CRAWL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  crawling: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clientId } = useApp();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [brands, setBrands] = useState<(Brand & { curated_brand?: CuratedBrand })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/groups/${groupId}`).then((r) => r.json()),
      fetch(`/api/groups/${groupId}/brands`).then((r) => r.json()),
    ])
      .then(([gData, bData]) => {
        setGroup(gData.data ?? gData.group ?? null);
        setBrands(bData.brands ?? bData.data ?? []);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, [groupId]);

  const handleRemoveBrand = async (brandId: string) => {
    setRemovingId(brandId);
    try {
      const res = await fetch(`/api/groups/${groupId}/brands/${brandId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      setBrands((prev) => prev.filter((b) => b.id !== brandId));
      toast.success('Brand removed');
    } catch {
      toast.error('Failed to remove brand');
    } finally {
      setRemovingId(null);
    }
  };

  const handleBrandAdded = (brand: Brand & { curated_brand?: CuratedBrand }) => {
    setBrands((prev) => [...prev, brand]);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/groups')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-display">{group?.name ?? 'Group'}</h2>
          {group?.benchmark_category_id && (
            <p className="text-sm text-muted-foreground">Benchmark Category</p>
          )}
        </div>
        <div className="ml-auto">
          <Button className="gap-2" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add Brand
          </Button>
        </div>
      </div>

      {/* Crawl Status */}
      <Card className="p-6 bg-card border border-border">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Crawl Status
        </h3>
        <div className="flex flex-wrap gap-3">
          {brands.map((brand) => (
            <div key={brand.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
              <div>
                <div className="flex items-center gap-1.5">
                  {brand.is_primary ? <Crown className="w-3 h-3 text-amber-600" /> : <Star className="w-3 h-3 text-muted-foreground" />}
                  <span className="text-sm font-medium">{brand.curated_brand?.name ?? brand.curated_brand_id}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {brand.last_crawl_at ? `Last crawl: ${new Date(brand.last_crawl_at).toLocaleDateString()}` : 'Never crawled'}
                </p>
              </div>
              <Badge className={`text-xs ${CRAWL_STATUS_COLORS[brand.crawl_status] ?? ''}`}>
                {brand.crawl_status}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={() => handleRemoveBrand(brand.id)}
                disabled={removingId === brand.id}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {brands.length === 0 && (
            <p className="text-sm text-muted-foreground">No brands in this group yet.</p>
          )}
        </div>
      </Card>

      {/* Brands Table */}
      <Card className="overflow-hidden bg-card border border-border">
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold">Tracked Brands ({brands.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-foreground/5 border-b border-border">
              <tr>
                <th className="text-left py-3 px-6 font-semibold">Brand</th>
                <th className="text-left py-3 px-6 font-semibold">Type</th>
                <th className="text-left py-3 px-6 font-semibold">Crawl Status</th>
                <th className="text-left py-3 px-6 font-semibold">First Crawl</th>
                <th className="text-left py-3 px-6 font-semibold">Last Crawl</th>
                <th className="text-right py-3 px-6 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-b border-border/50 hover:bg-foreground/5 transition-colors">
                  <td className="py-3 px-6 font-medium">{brand.curated_brand?.name ?? brand.curated_brand_id}</td>
                  <td className="py-3 px-6">
                    {brand.is_primary ? (
                      <Badge className="gap-1"><Crown className="w-3 h-3" />Primary</Badge>
                    ) : (
                      <Badge variant="secondary">Competitor</Badge>
                    )}
                  </td>
                  <td className="py-3 px-6">
                    <Badge className={`${CRAWL_STATUS_COLORS[brand.crawl_status] ?? ''}`}>
                      {brand.crawl_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-6 text-muted-foreground">
                    {brand.first_crawl_at ? new Date(brand.first_crawl_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-6 text-muted-foreground">
                    {brand.last_crawl_at ? new Date(brand.last_crawl_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-6 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveBrand(brand.id)}
                      disabled={removingId === brand.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No brands tracked yet. <Button variant="link" className="p-0" onClick={() => setShowAddModal(true)}>Add your first brand</Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Brand Modal */}
      {showAddModal && (
        <AddBrandModal
          groupId={groupId}
          existingBrandIds={brands.map((b) => b.curated_brand_id)}
          onClose={() => setShowAddModal(false)}
          onBrandAdded={handleBrandAdded}
        />
      )}
    </div>
  );
}
