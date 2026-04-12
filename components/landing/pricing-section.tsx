"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    description: "Cho Agency nho va Brand moi bat dau",
    price: { monthly: 0, annual: 0 },
    features: [
      "1 brand chinh",
      "1 nen tang (FB hoac YT hoac TT)",
      "30 ngay lich su data",
      "SOV Matrix co ban",
      "2 báo cao tuan",
      "Ho tro community",
    ],
    cta: "Bat dau mien phi",
    popular: false,
  },
  {
    name: "Professional",
    description: "Cho Agency va Brand can theo doi day du",
    price: { monthly: 5000000, annual: 4200000 },
    features: [
      "10 brands (chinh + doi thu)",
      "3 nen tang FB / YT / TT",
      "1 nam lich su data",
      "SOV + SOS Matrix",
      "Rankings & Trends",
      "Bao cao tuan tu dong",
      "Team 5 nguoi",
      "Xuat bao cao PDF",
    ],
    cta: "Dung thu 14 ngay",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "Cho to chuc lon can quy mo dau tu",
    price: { monthly: null, annual: null },
    features: [
      "Unlimited brands",
      "3 nen tang FB / YT / TT",
      "Khong gioi han lich su",
      "Tat ca analytics + Benchmark",
      "Crawl tuyen sinh theo yeu cau",
      "Team khong gioi han",
      "Priority support 24/7",
      "Custom integration",
      "SLA guarantee",
    ],
    cta: "Lien he Sales",
    popular: false,
  },
];

function formatPrice(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(0)}M`;
  }
  return amount.toLocaleString('vi-VN');
}

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="relative py-32 lg:py-40 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            Bang gia
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            Gia ca minh bach,
            <br />
            <span className="text-stroke">khong phi an.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            Bat dau mien phi. Nang cap khi can. Khong co phi an, khong co bất ngờ.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center gap-4 mb-16">
          <span
            className={`text-sm transition-colors ${
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-14 h-7 bg-foreground/10 rounded-full p-1 transition-colors hover:bg-foreground/20"
          >
            <div
              className={`w-5 h-5 bg-foreground rounded-full transition-transform duration-300 ${
                isAnnual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm transition-colors ${
              isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Annual
          </span>
          {isAnnual && (
            <span className="ml-2 px-2 py-1 bg-foreground text-primary-foreground text-xs font-mono">
              Tiết kiệm 17%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-px bg-foreground/10">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className={`relative p-8 lg:p-12 bg-background ${
                plan.popular ? "md:-my-4 md:py-12 lg:py-16 border-2 border-foreground" : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-8 px-3 py-1 bg-foreground text-primary-foreground text-xs font-mono uppercase tracking-widest">
                  Pho bien nhat
                </span>
              )}

              {/* Plan Header */}
              <div className="mb-8">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-3xl text-foreground mt-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-foreground/10">
                {plan.price.monthly !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-5xl lg:text-6xl text-foreground">
                      {formatPrice(isAnnual ? plan.price.annual : plan.price.monthly)}đ
                    </span>
                    <span className="text-muted-foreground">/tháng</span>
                  </div>
                ) : (
                  <span className="font-display text-4xl text-foreground">Tuỳ chỉnh</span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                  plan.popular
                    ? "bg-foreground text-primary-foreground hover:bg-foreground/90"
                    : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Tat ca cac goi deu bao gom data crawl tu dong hang tuan.{" "}
          <a href="#" className="underline underline-offset-4 hover:text-foreground transition-colors">
            So sanh tat ca tinh nang
          </a>
        </p>
      </div>
    </section>
  );
}
