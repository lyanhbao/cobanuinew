export const journeys = [
  {
    id: "j1",
    title: "Platform Admin Setup",
    actor: "Platform Admin",
    duration: "One-time",
    steps: [
      "Seed product categories (Dairy, Snacks, etc.)",
      "Seed curated brands (Vinamilk, Nestlé, etc.)",
      "Create agency accounts and owner users",
      "Configure system settings and email templates"
    ],
    description: "Initial platform configuration to enable agencies to onboard."
  },
  {
    id: "j3",
    title: "Agency Owner Onboarding",
    actor: "Agency Owner",
    duration: "Day 0",
    steps: [
      "Receive and accept agency invitation",
      "Configure agency details (name, industry)",
      "Declare client relationships (add client companies)",
      "Map client brands for each client",
      "Create initial brand group with competitors",
      "Wait for initial data collection (30-90 mins)"
    ],
    description: "Agency owner sets up their account, clients, and initial competitive groups."
  },
  {
    id: "j4",
    title: "Agency Admin User Assignment",
    actor: "Agency Admin",
    duration: "Day 1+",
    steps: [
      "Invite agency team members",
      "Assign users to specific clients",
      "Set user roles (Admin, Analyst, Viewer)",
      "Configure access permissions per client",
      "Enable/disable features based on plan"
    ],
    description: "Admin distributes access to agency team and manages permissions."
  },
  {
    id: "j5",
    title: "Daily: Select Client & View Dashboard",
    actor: "Agency User",
    duration: "Every login",
    steps: [
      "Log in to platform",
      "Select active client from dropdown (if assigned to multiple)",
      "View dashboard with KPIs, rankings, and trends",
      "See weekly report summary and activity feed"
    ],
    description: "Regular workflow to access client data and insights."
  },
  {
    id: "j6",
    title: "Create Competitive Group",
    actor: "Client Admin",
    duration: "Ad-hoc",
    steps: [
      "Navigate to Groups section",
      "Create new group (e.g., 'Dairy - Premium Segment')",
      "Select primary brand (client's brand)",
      "Add competing brands to monitor",
      "System triggers initial crawl (30-90 mins pending state)",
      "Once data ready, view analytics in group dashboard"
    ],
    description: "Set up a new competitive intelligence group for market analysis."
  },
  {
    id: "j7",
    title: "View Group Analytics & Reports",
    actor: "All Users",
    duration: "Weekly + on-demand",
    steps: [
      "Open specific group dashboard",
      "View weekly metrics (impressions, engagement, rankings)",
      "Check brand SOV (Share of Voice) and ranking changes",
      "See top-performing posts and trends",
      "Download weekly PDF/CSV reports",
      "Review competitor activity insights"
    ],
    description: "Access detailed competitive analytics and historical performance data."
  },
  {
    id: "j8",
    title: "Add New Competitive Group",
    actor: "Client Admin",
    duration: "Ad-hoc",
    steps: [
      "From existing group, click 'Clone' or 'Create New'",
      "Repeat group creation steps (see J6)",
      "Can have multiple groups per client for different market segments",
      "Each group tracks independently"
    ],
    description: "Expand monitoring to new market segments or sub-categories."
  },
  {
    id: "j9",
    title: "Add Competitor to Existing Group",
    actor: "Client Admin",
    duration: "15 mins",
    steps: [
      "Open group settings",
      "Click 'Add Competitor'",
      "Enter competitor's Facebook/YouTube/TikTok URL",
      "Validate profile (auto-crawl link)",
      "Add to group",
      "System adds to next crawl cycle (within 24 hours)"
    ],
    description: "Extend group monitoring to include new competitor accounts."
  },
  {
    id: "j10",
    title: "Direct Client Self-serve Signup",
    actor: "Direct Client (Startup/Small Brand)",
    duration: "Day 0",
    steps: [
      "Sign up directly on COBAN website",
      "Create account (email + password)",
      "Add company details",
      "Add single brand to monitor",
      "Create first group with 3-5 competitors",
      "Immediate dashboard access (after initial crawl)"
    ],
    description: "Small brands/startups independently sign up without agency intermediary."
  },
  {
    id: "j11",
    title: "Direct Client Ongoing Usage",
    actor: "Direct Client User",
    duration: "Continuous",
    steps: [
      "Log in → Dashboard (no client selector)",
      "View weekly metrics and trends",
      "Manage own groups and competitors",
      "Monitor brand performance vs. competition",
      "Receive weekly reports and alerts",
      "Plan campaigns based on competitive insights"
    ],
    description: "Regular usage for solo brands managing their competitive landscape."
  },
  {
    id: "j12",
    title: "Automated Weekly System Flow",
    actor: "System (BullMQ Scheduler)",
    duration: "Every Sunday 12 PM",
    steps: [
      "Job 1: Delta Crawl - Fetch new posts from all platforms",
      "Job 2: Gap Calculation - Compute weekly engagement changes",
      "Job 3: Aggregation - Summarize brand stats, trends",
      "Job 4: Rankings & SOV - Rank brands, calculate share-of-voice",
      "Job 5: Activity Report - Flag viral posts and re-engaged content",
      "Job 6: Finalize & Email - Send reports to all users"
    ],
    description: "Automated backend process updating all analytics and sending insights."
  }
];

export const actorPersonas = [
  {
    id: "platform-admin",
    name: "Platform Admin",
    description: "Responsible for initial system setup and platform management",
    responsibilities: ["Category seeding", "Brand curation", "Account creation", "System monitoring"]
  },
  {
    id: "agency-owner",
    name: "Agency Owner",
    description: "Leads agency operations, manages clients and team",
    responsibilities: ["Client relationships", "Team management", "Account settings", "Billing"]
  },
  {
    id: "agency-admin",
    name: "Agency Admin",
    description: "Manages day-to-day operations and user permissions",
    responsibilities: ["User invitations", "Permission management", "Client assignment", "Support"]
  },
  {
    id: "client-admin",
    name: "Client Admin",
    description: "Manages competitive groups and brand strategy for one client",
    responsibilities: ["Group creation", "Competitor management", "Team collaboration", "Report distribution"]
  },
  {
    id: "agency-analyst",
    name: "Agency Analyst",
    description: "Analyzes data and creates insights for clients",
    responsibilities: ["Data analysis", "Report creation", "Insight generation", "Client support"]
  },
  {
    id: "direct-client",
    name: "Direct Client Owner",
    description: "Small brand/startup managing their own competitive intelligence",
    responsibilities: ["Account management", "Competitor tracking", "Strategy planning", "Report review"]
  }
];

export const dataModel = {
  tables: [
    {
      name: "accounts",
      description: "Agency or Direct Client accounts",
      fields: ["account_id", "account_type", "name", "created_at"]
    },
    {
      name: "users",
      description: "Platform users with roles and permissions",
      fields: ["user_id", "email", "role", "account_id", "created_at"]
    },
    {
      name: "clients",
      description: "Clients managed by agencies",
      fields: ["client_id", "agency_id", "name", "created_at"]
    },
    {
      name: "brands",
      description: "Brand entities to monitor",
      fields: ["brand_id", "name", "category", "primary_platform_id", "created_at"]
    },
    {
      name: "groups",
      description: "Competitive groups tracking primary brand + competitors",
      fields: ["group_id", "client_id", "primary_brand_id", "name", "created_at"]
    },
    {
      name: "group_brands",
      description: "Join table: groups to monitored brands",
      fields: ["group_id", "brand_id", "role", "created_at"]
    },
    {
      name: "posts",
      description: "Social media posts from monitored brands",
      fields: ["post_id", "brand_id", "platform", "likes", "comments", "shares", "views", "posted_at", "crawled_at"]
    },
    {
      name: "weekly_reports",
      description: "Aggregated weekly statistics per brand",
      fields: ["report_id", "group_id", "brand_id", "week_start", "total_posts", "total_engagement", "rank", "sov"]
    }
  ]
};
