# COBAN Website - Quick Start Guide

## Overview
This is the marketing website and user journey documentation for COBAN, a competitive intelligence platform for Vietnamese brands and agencies.

## Live Preview
The website includes:
- **Landing page** at `/` - Marketing homepage
- **User journeys** at `/user-journeys` - Complete workflow documentation

## Project Structure

```
app/
├── page.tsx                    Landing page
├── layout.tsx                  Root layout & metadata
├── globals.css                 Global styles
└── user-journeys/page.tsx      User journeys documentation

components/landing/             Landing page sections
lib/journey-data.ts             Journey definitions
```

## Key Pages

### Landing Page (/)
Features showcase with sections on:
- Hero with dynamic animations
- Core features (Real-time Monitoring, Analytics, Collaboration, Security)
- 3-step workflow explanation
- Infrastructure overview
- Live metrics
- Pricing tiers
- Call-to-action
- Footer with links

### User Journeys (/user-journeys)
Interactive documentation featuring:
- **Journeys Tab**: 12 user workflows (setup, onboarding, daily usage, etc.)
- **Personas Tab**: 6 actor roles with responsibilities
- **Data Model Tab**: Database schema and architecture notes

## Customization

### Update Branding
- Logo/Company name: `components/landing/navigation.tsx` (line ~47)
- Site title: `app/layout.tsx` (metadata section)
- Favicon: `public/favicon.ico`

### Update Content
- Hero section: `components/landing/hero-section.tsx`
- Features: `components/landing/features-section.tsx`
- Pricing: `components/landing/pricing-section.tsx`
- User journeys: `lib/journey-data.ts`

### Update Styling
- Colors: `app/globals.css` (CSS custom properties in `:root`)
- Fonts: `app/layout.tsx` (Google Fonts imports)
- Tailwind: `tailwind.config.ts` (if additional customization needed)

## Development

### Run locally
```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production
```bash
npm run build
npm run start
```

## Content Updates

### Change Pricing
Edit `components/landing/pricing-section.tsx`:
- Update `plans` array with new tiers
- Modify currency (currently Vietnamese Dong: ₫)

### Update Metrics
Edit `components/landing/metrics-section.tsx`:
- Update `metrics` array with new statistics
- Change numbers and labels

### Modify Journeys
Edit `lib/journey-data.ts`:
- Add/remove journeys in `journeys` array
- Update personas in `actorPersonas` array
- Add database tables in `dataModel.tables` array

## Navigation Links

Current navigation structure:
- Features → #features
- How it works → #how-it-works
- Pricing → #pricing
- User Journeys → /user-journeys
- Sign in → #
- Get started → #

Update in: `components/landing/navigation.tsx`

## Adding New Pages

1. Create new directory in `app/` (e.g., `app/blog/`)
2. Add `page.tsx` inside
3. Import `Navigation` and `FooterSection` for consistency
4. Add link in footer or navigation

Example:
```tsx
// app/docs/page.tsx
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";

export default function Docs() {
  return (
    <main>
      <Navigation />
      {/* Your content */}
      <FooterSection />
    </main>
  );
}
```

## Colors & Design System

The site uses a clean, professional color palette:
- **Background**: Off-white (`oklch(0.985 0.002 90)`)
- **Foreground**: Dark blue (`oklch(0.12 0.01 60)`)
- **Accent**: Light gray (`oklch(0.92 0.01 90)`)
- **Primary**: Same as foreground for consistency

All colors are defined in `app/globals.css` using CSS custom properties (OKLch color space) for perfect consistency across the site.

## Animations

The site includes several animation effects:
- **Char-in**: Character-by-character reveal on hero
- **Marquee**: Horizontal scrolling stats bar
- **Fade transitions**: Smooth section reveals
- **Hover effects**: Interactive button and link states
- **SVG animations**: 3D shapes and wave backgrounds

## Mobile Responsiveness

All sections are fully responsive:
- Mobile: Single column, stacked layout
- Tablet (lg breakpoint): Two columns where appropriate
- Desktop: Full-width optimized layouts

Test with: `pnpm dev` then resize browser or use DevTools

## Analytics & Tracking

Currently, no analytics are implemented. To add:

1. **Google Analytics**: Add to `app/layout.tsx`
   ```tsx
   import { Analytics } from '@vercel/analytics/next';
   // In the JSX: <Analytics />
   ```

2. **Custom tracking**: Implement in individual components

## SEO

The site is SEO-optimized:
- Metadata in `app/layout.tsx`
- Semantic HTML structure
- Open Graph tags ready (add in layout.tsx)
- Mobile-friendly design
- Fast performance (Next.js optimizations)

## Deployment

### Deploy to Vercel
1. Push code to GitHub
2. Connect repository to Vercel
3. Vercel auto-deploys on push to main
4. Add custom domain in Vercel settings

### Environment Variables
None required for this landing page.

For future backend integration:
- `NEXT_PUBLIC_API_URL`
- Database connection strings (in backend only)
- Email service keys

## Troubleshooting

### Animations not working
- Check browser DevTools for CSS errors
- Ensure `app/globals.css` is loaded
- Verify `@import 'tailwindcss'` in globals.css

### Styling issues
- Clear `.next/` build cache: `rm -rf .next`
- Rebuild: `npm run build`
- Check Tailwind config: `tailwind.config.ts`

### Journey data not loading
- Verify `lib/journey-data.ts` exports are correct
- Check import path in `app/user-journeys/page.tsx`
- Browser DevTools Console for errors

## Support & Next Steps

This landing page is a foundation for the full COBAN platform. Next phases include:

1. **Authentication**: User login and onboarding
2. **Dashboard**: Real-time analytics and competitor tracking
3. **Admin Panel**: Platform management interface
4. **Backend**: Database, API routes, data processing

Refer to `COBAN_PROJECT_SUMMARY.md` for detailed development roadmap.

---

**Ready to get started?** 
- Run `pnpm dev` to start the dev server
- Edit content in `components/landing/` and `lib/`
- Visit `/user-journeys` to see journey documentation
- Deploy to Vercel with one click
