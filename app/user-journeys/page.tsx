"use client";

import { useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { journeys, actorPersonas, dataModel } from "@/lib/journey-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UserJourneys() {
  const [selectedJourney, setSelectedJourney] = useState(journeys[0]);

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Navigation />
      
      {/* Header */}
      <section className="relative pt-32 pb-16 lg:py-40 px-6 lg:px-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-4">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
              <span className="w-8 h-px bg-foreground/30" />
              User Journey Documentation
            </span>
          </div>
          <h1 className="text-[clamp(2.5rem,10vw,5rem)] font-display leading-[0.9] tracking-tight mb-6">
            How Users Experience COBAN
          </h1>
          <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl leading-relaxed">
            Complete user journey maps documenting every workflow, actor, and system interaction in the COBAN platform.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative py-12 px-6 lg:px-12 border-t border-foreground/10">
        <div className="max-w-[1400px] mx-auto">
          <Tabs defaultValue="journeys" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-12">
              <TabsTrigger value="journeys">Journeys</TabsTrigger>
              <TabsTrigger value="personas">Actor Personas</TabsTrigger>
              <TabsTrigger value="datamodel">Data Model</TabsTrigger>
            </TabsList>

            {/* Journeys Tab */}
            <TabsContent value="journeys" className="space-y-8">
              <div className="grid lg:grid-cols-3 gap-6 mb-12">
                {journeys.map((journey) => (
                  <Card
                    key={journey.id}
                    className={`p-6 cursor-pointer transition-all duration-300 ${
                      selectedJourney.id === journey.id
                        ? "border-foreground/50 bg-foreground/5"
                        : "border-foreground/10 hover:border-foreground/30"
                    }`}
                    onClick={() => setSelectedJourney(journey)}
                  >
                    <div className="mb-3">
                      <Badge variant="outline" className="mb-2">
                        {journey.actor}
                      </Badge>
                      <h3 className="text-lg font-display font-semibold">{journey.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{journey.description}</p>
                    <div className="text-xs font-mono text-muted-foreground">
                      Duration: {journey.duration}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Selected Journey Detail */}
              <Card className="p-8 border-foreground/20 bg-background">
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className="bg-foreground text-background">
                      {selectedJourney.actor}
                    </Badge>
                    <span className="text-sm font-mono text-muted-foreground">
                      {selectedJourney.duration}
                    </span>
                  </div>
                  <h2 className="text-3xl font-display font-bold mb-3">
                    {selectedJourney.title}
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    {selectedJourney.description}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold font-display mb-6">Steps</h3>
                  <div className="space-y-4">
                    {selectedJourney.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="shrink-0">
                          <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-sm font-mono font-semibold">
                            {idx + 1}
                          </div>
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-base text-foreground">{step}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Personas Tab */}
            <TabsContent value="personas">
              <div className="grid lg:grid-cols-2 gap-6">
                {actorPersonas.map((persona) => (
                  <Card key={persona.id} className="p-8 border-foreground/10">
                    <h3 className="text-2xl font-display font-bold mb-3">{persona.name}</h3>
                    <p className="text-muted-foreground mb-6">{persona.description}</p>
                    <div>
                      <h4 className="text-sm font-semibold font-mono text-foreground/70 mb-3">
                        Key Responsibilities
                      </h4>
                      <ul className="space-y-2">
                        {persona.responsibilities.map((resp, idx) => (
                          <li key={idx} className="text-sm text-foreground flex gap-3">
                            <span className="text-foreground/30">•</span>
                            {resp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Data Model Tab */}
            <TabsContent value="datamodel">
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-display font-bold mb-6">Database Schema</h3>
                  <div className="grid lg:grid-cols-2 gap-6">
                    {dataModel.tables.map((table) => (
                      <Card key={table.name} className="p-6 border-foreground/10">
                        <h4 className="text-lg font-mono font-semibold mb-2">{table.name}</h4>
                        <p className="text-sm text-muted-foreground mb-4">{table.description}</p>
                        <div className="bg-foreground/5 rounded p-4">
                          <div className="text-xs font-mono space-y-1">
                            {table.fields.map((field) => (
                              <div key={field} className="text-foreground/70">
                                {field}
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <Card className="p-8 border-foreground/20 bg-foreground/5">
                  <h4 className="text-xl font-display font-bold mb-4">System Architecture Notes</h4>
                  <ul className="space-y-3 text-foreground/80">
                    <li>
                      <strong>Weekly Automation:</strong> Every Sunday at 12 PM, a BullMQ scheduler triggers crawl, aggregation, and report generation jobs.
                    </li>
                    <li>
                      <strong>Multi-tenancy:</strong> Data isolation via account_id and row-level security policies. Each agency sees only their clients.
                    </li>
                    <li>
                      <strong>Real-time Features:</strong> WebSocket connections for live activity feeds and instant alert notifications.
                    </li>
                    <li>
                      <strong>Data Retention:</strong> Posts retained for 12 months; weekly reports kept indefinitely for historical comparison.
                    </li>
                  </ul>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
