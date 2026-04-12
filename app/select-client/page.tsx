'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Building2, ArrowRight } from 'lucide-react';
import type { Client } from '@/lib/types';

export default function SelectClientPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, fetchWithAuth } = useAuth();
  const { clientId, setClientId } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (!isAuthenticated) return;

    fetchWithAuth('/api/clients')
      .then((r) => r.json())
      .then((d) => {
        const list = d.data ?? d.clients ?? [];
        setClients(list);
        setLoading(false);
        if (list.length === 0) {
          router.push('/onboarding');
        }
      })
      .catch(() => {
        setClients([]);
        setLoading(false);
      });
  }, [isAuthenticated, authLoading, router]);

  const handleSelectClient = (id: string) => {
    setClientId(id);
    router.push('/dashboard/overview');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-10">
          <h1 className="text-4xl font-display mb-2">Select Client</h1>
          <p className="text-muted-foreground">
            Choose a client to view their competitive intelligence dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="p-6 cursor-pointer hover:border-foreground/40 transition-colors border border-border bg-card"
              onClick={() => handleSelectClient(client.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-foreground/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{client.name}</h3>
              {client.industry && (
                <p className="text-sm text-muted-foreground">{client.industry}</p>
              )}
            </Card>
          ))}

          {/* Create Client card */}
          <Card
            className="p-6 cursor-pointer hover:border-foreground/40 transition-colors border border-dashed border-border bg-card flex flex-col items-center justify-center min-h-[160px] text-center"
            onClick={() => router.push('/onboarding')}
          >
            <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Add New Client</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first client</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
