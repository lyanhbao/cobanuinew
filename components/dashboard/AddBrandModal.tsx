'use client';

import { useState, useEffect } from 'react';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { Search, Star, Crown, Loader2 } from 'lucide-react';
import type { CuratedBrand, Brand } from '@/lib/types';

interface AddBrandModalProps {
  groupId: string;
  existingBrandIds: string[];
  onClose: () => void;
  onBrandAdded: (brand: Brand & { curated_brand: CuratedBrand }) => void;
}

export default function AddBrandModal({
  groupId,
  existingBrandIds,
  onClose,
  onBrandAdded,
}: AddBrandModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CuratedBrand[]>([]);
  const [selected, setSelected] = useState<CuratedBrand | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/curated-brands?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults((d.brands ?? d.data ?? []).filter((b: CuratedBrand) => !existingBrandIds.includes(b.id))))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, existingBrandIds]);

  const handleSubmit = async () => {
    if (!selected) { toast.error('Please select a brand'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curated_brand_id: selected.id, is_primary: isPrimary }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed to add brand');
      onBrandAdded({ ...(d.data ?? d.brand), curated_brand: selected });
      toast.success(`${selected.name} added to group`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add brand');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Brand</DialogTitle>
          <DialogDescription>
            Search and select a brand from our curated database to add to this group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          {!selected && (
            <div>
              <label className="block text-sm font-medium mb-2">Search Brands</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Command className="border border-border rounded-lg">
                  <CommandInput
                    placeholder="Search by brand name, advertiser..."
                    value={query}
                    onValueChange={setQuery}
                    className="pl-9"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searching ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : query.length < 2 ? (
                        'Type at least 2 characters to search'
                      ) : (
                        'No brands found'
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {results.map((brand) => (
                        <CommandItem
                          key={brand.id}
                          value={brand.id}
                          onSelect={() => setSelected(brand)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <p className="font-medium">{brand.name}</p>
                              {brand.advertiser && (
                                <p className="text-xs text-muted-foreground">{brand.advertiser}</p>
                              )}
                            </div>
                            {brand.categories?.length > 0 && (
                              <div className="flex gap-1">
                                {brand.categories.slice(0, 2).map((cat) => (
                                  <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            </div>
          )}

          {/* Selected brand */}
          {selected && (
            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg bg-foreground/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{selected.name}</p>
                    {selected.advertiser && (
                      <p className="text-sm text-muted-foreground">{selected.advertiser}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    Change
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Brand Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPrimary(false)}
                    className={`flex-1 p-4 rounded-lg border-2 transition-colors text-left ${
                      !isPrimary ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/30'
                    }`}
                  >
                    <Star className="w-5 h-5 mb-2" />
                    <p className="font-medium">Competitor</p>
                    <p className="text-xs text-muted-foreground">Track against your primary brand</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrimary(true)}
                    className={`flex-1 p-4 rounded-lg border-2 transition-colors text-left ${
                      isPrimary ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/30'
                    }`}
                  >
                    <Crown className="w-5 h-5 mb-2" />
                    <p className="font-medium">Primary Brand</p>
                    <p className="text-xs text-muted-foreground">Your main brand for benchmarking</p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selected || submitting}>
            {submitting ? 'Adding...' : 'Add Brand'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
