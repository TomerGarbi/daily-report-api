/**
 * Seed script — populates Groups and Users in the database.
 *
 * Run with:
 *   npx ts-node scripts/seed.ts
 *
 * Safe to re-run: uses upserts so existing documents are not duplicated.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load env before importing anything that reads process.env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { Group }  from "../models/Group";
import { User }   from "../models/User";
import { Report } from "../models/Report";
import { getMongoUri, getMongoDbName } from "../config/mongodbConfig";

// ─── Seed data ────────────────────────────────────────────────────────────────

const GROUP_NAMES = ["IT-Admins", "Managers", "Finance", "Staff"];

/**
 * Dev users — mirrors the DEV_USERS list in authService.ts.
 * Each user's groups list must reference names from GROUP_NAMES above.
 */
const SEED_USERS: Array<{
  username: string;
  role: "admin" | "manager" | "user" | "guest";
  groupNames: string[];
}> = [
  { username: "admin.dev",   role: "admin",   groupNames: ["IT-Admins", "Managers"] },
  { username: "manager.dev", role: "manager", groupNames: ["Managers", "Finance"]   },
  { username: "user.dev",    role: "user",    groupNames: ["Staff"]                 },
  { username: "guest.dev",   role: "guest",   groupNames: []                        },
  { username: "sarah.admin",    role: "admin",   groupNames: ["IT-Admins"]             },
  { username: "david.manager",  role: "manager", groupNames: ["Managers"]              },
  { username: "rachel.finance", role: "manager", groupNames: ["Finance", "Managers"]   },
  { username: "alex.dev",       role: "user",    groupNames: ["Staff"]                 },
  { username: "maya.dev",       role: "user",    groupNames: ["Staff"]                 },
  { username: "tom.ops",        role: "user",    groupNames: ["Staff", "IT-Admins"]    },
  { username: "lisa.guest",     role: "guest",   groupNames: []                        },
];

// ─── Report seed data ─────────────────────────────────────────────────────────

/**
 * Each entry references a seeded user (username) and group (groupName).
 * The script resolves real ObjectIds at runtime.
 */
const SEED_REPORTS: Array<{
  title: string;
  description: string;
  content: Record<string, unknown>;
  status: "draft" | "published";
  groupName: string;
  authorUsername: string;
  /** Override the auto-generated createdAt timestamp (for realistic seed data). */
  createdAt?: Date;
}> = [
  // ── IT-Admins ───────────────────────────────────────────────────────────
  {
    title: "Weekly Infrastructure Health Check",
    description: "Summary of server uptime, disk usage, and network latency for the past week.",
    content: {
      servers: [
        { name: "web-01", uptimePercent: 99.95, diskUsagePercent: 62 },
        { name: "db-01",  uptimePercent: 100,   diskUsagePercent: 74 },
        { name: "cache-01", uptimePercent: 99.8, diskUsagePercent: 31 },
      ],
      avgLatencyMs: 12,
      incidents: [],
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "admin.dev",
  },
  {
    title: "Security Patch Rollout — Q1 2026",
    description: "Tracks the deployment status of OS and middleware security patches across all managed endpoints.",
    content: {
      patchCycle: "Q1-2026",
      totalEndpoints: 148,
      patched: 140,
      pending: 8,
      criticalCVEs: ["CVE-2026-0021", "CVE-2026-0034"],
    },
    status: "draft",
    groupName: "IT-Admins",
    authorUsername: "admin.dev",
  },

  // ── Managers ────────────────────────────────────────────────────────────
  {
    title: "Q1 2026 Team Performance Review",
    description: "Aggregated KPI metrics for all managed teams during Q1 2026.",
    content: {
      period: "Q1-2026",
      teams: [
        { team: "Engineering", kpiScore: 87, headcount: 12 },
        { team: "Support",     kpiScore: 91, headcount: 8  },
        { team: "QA",          kpiScore: 83, headcount: 5  },
      ],
      highlights: "Support team exceeded SLA targets for the third consecutive quarter.",
    },
    status: "published",
    groupName: "Managers",
    authorUsername: "manager.dev",
  },
  {
    title: "Onboarding Progress — February 2026",
    description: "Status report on new-hire onboarding tasks and completion rates.",
    content: {
      newHires: 6,
      fullyOnboarded: 4,
      inProgress: 2,
      averageDaysToComplete: 14,
      blockers: ["AD account provisioning delay for 2 hires"],
    },
    status: "draft",
    groupName: "Managers",
    authorUsername: "manager.dev",
  },

  // ── Finance ─────────────────────────────────────────────────────────────
  {
    title: "Monthly Budget Variance Report — January 2026",
    description: "Comparison of planned vs. actual expenditure across all cost centres for January 2026.",
    content: {
      month: "2026-01",
      totalBudget: 250000,
      totalActual: 237450,
      variance: -12550,
      costCentres: [
        { name: "Engineering", budget: 120000, actual: 115200 },
        { name: "Marketing",   budget: 50000,  actual: 52100  },
        { name: "Operations",  budget: 80000,  actual: 70150  },
      ],
    },
    status: "published",
    groupName: "Finance",
    authorUsername: "manager.dev",
  },
  {
    title: "Annual Forecast Draft — FY2026",
    description: "Preliminary revenue and cost projections for the full fiscal year 2026.",
    content: {
      fiscalYear: 2026,
      projectedRevenue: 3200000,
      projectedCosts: 2750000,
      projectedProfit: 450000,
      assumptions: ["5% headcount growth", "No major CapEx in H1", "Stable vendor pricing"],
      status: "under-review",
    },
    status: "draft",
    groupName: "Finance",
    authorUsername: "manager.dev",
  },

  // ── Staff ────────────────────────────────────────────────────────────────
  {
    title: "Daily Stand-up Notes — 2026-02-22",
    description: "Brief notes from today's morning stand-up covering blockers and task ownership.",
    content: {
      date: "2026-02-22",
      attendees: ["user.dev", "alice", "bob"],
      items: [
        { owner: "user.dev", task: "Fix login redirect bug", status: "in-progress" },
        { owner: "alice",    task: "Write unit tests for report module", status: "done" },
        { owner: "bob",      task: "Update API documentation", status: "blocked", blocker: "Waiting for schema sign-off" },
      ],
    },
    status: "published",
    groupName: "Staff",
    authorUsername: "user.dev",
  },
  {
    title: "Equipment Request — Additional Monitors",
    description: "Request to procure two additional 27-inch monitors for the development team.",
    content: {
      requestedBy: "user.dev",
      items: [{ description: '27" 4K Monitor', quantity: 2, estimatedUnitCost: 450 }],
      justification: "Improve developer productivity by enabling side-by-side code and test views.",
      approvalStatus: "pending",
    },
    status: "draft",
    groupName: "Staff",
    authorUsername: "user.dev",
  },

  // ── January 2026 back-fill ─────────────────────────────────────────────

  // IT-Admins — Jan 6
  {
    title: "Network Switch Replacement Plan — January 2026",
    description: "Assessment of aging core switches and replacement schedule for Q1 2026.",
    content: {
      switchesAssessed: 8,
      requireReplacement: 3,
      estimatedCost: 14500,
      plannedDowntimeWindows: ["2026-01-18 02:00", "2026-01-25 02:00"],
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "admin.dev",
    createdAt: new Date("2026-01-06T09:15:00Z"),
  },
  // IT-Admins — Jan 14
  {
    title: "Backup Validation Report — Week 2 January 2026",
    description: "Results of automated restore tests for all critical backup jobs.",
    content: {
      jobsTested: 22,
      passed: 21,
      failed: 1,
      failureDetail: "db-01 incremental backup — checksum mismatch resolved by re-seeding.",
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "admin.dev",
    createdAt: new Date("2026-01-14T11:00:00Z"),
  },
  // IT-Admins — Jan 28
  {
    title: "VPN Usage Spike Investigation — January 2026",
    description: "Root-cause analysis of the 40 % VPN traffic spike observed during the last week of January.",
    content: {
      peakDate: "2026-01-26",
      peakConcurrentSessions: 312,
      normalBaseline: 220,
      cause: "Remote branch office switch outage forced all users onto VPN.",
      resolution: "On-site engineer restored switch; sessions normalised by 2026-01-27 morning.",
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "admin.dev",
    createdAt: new Date("2026-01-28T14:30:00Z"),
  },

  // Managers — Jan 5
  {
    title: "January Kick-off Goals",
    description: "Team objectives and OKR alignment for January 2026.",
    content: {
      objectives: [
        { team: "Engineering", goal: "Ship v2.0 beta", keyResult: "Feature-complete by Jan 31" },
        { team: "Support",     goal: "Reduce ticket backlog by 30 %", keyResult: "Backlog < 50 open tickets" },
      ],
    },
    status: "published",
    groupName: "Managers",
    authorUsername: "manager.dev",
    createdAt: new Date("2026-01-05T08:00:00Z"),
  },
  // Managers — Jan 20
  {
    title: "Mid-Month Manager Sync — January 2026",
    description: "Notes and action items from the mid-month management stand-up.",
    content: {
      date: "2026-01-20",
      attendees: ["manager.dev", "alice.mgr", "bob.mgr"],
      actionItems: [
        { owner: "manager.dev", action: "Submit Q1 budget revision", dueDate: "2026-01-27" },
        { owner: "alice.mgr",   action: "Finalise annual leave schedule", dueDate: "2026-01-23" },
      ],
    },
    status: "published",
    groupName: "Managers",
    authorUsername: "manager.dev",
    createdAt: new Date("2026-01-20T10:45:00Z"),
  },

  // Finance — Jan 10
  {
    title: "December 2025 Expense Reconciliation",
    description: "Final reconciliation of December 2025 corporate card expenses.",
    content: {
      month: "2025-12",
      totalSubmitted: 18340,
      totalApproved: 17890,
      rejected: 450,
      rejectionReason: "Missing receipts for 3 travel claims.",
    },
    status: "published",
    groupName: "Finance",
    authorUsername: "manager.dev",
    createdAt: new Date("2026-01-10T13:00:00Z"),
  },
  // Finance — Jan 22
  {
    title: "Q4 2025 Audit Preparation Checklist",
    description: "Pre-audit readiness checklist for the external Q4 2025 financial audit.",
    content: {
      auditDate: "2026-02-10",
      checklistItems: [
        { item: "Bank reconciliations",  complete: true  },
        { item: "Fixed asset register",  complete: true  },
        { item: "Payroll reconciliation", complete: false },
        { item: "AR aging report",        complete: true  },
      ],
      completionPercent: 75,
    },
    status: "draft",
    groupName: "Finance",
    authorUsername: "manager.dev",
    createdAt: new Date("2026-01-22T09:30:00Z"),
  },

  // Staff — Jan 8
  {
    title: "Daily Stand-up Notes — 2026-01-08",
    description: "Morning stand-up notes covering blockers and task ownership.",
    content: {
      date: "2026-01-08",
      attendees: ["user.dev", "alice", "bob"],
      items: [
        { owner: "user.dev", task: "Set up staging environment", status: "done" },
        { owner: "alice",    task: "Code review — auth module", status: "in-progress" },
        { owner: "bob",      task: "Dependency upgrade audit",   status: "blocked", blocker: "Awaiting security sign-off" },
      ],
    },
    status: "published",
    groupName: "Staff",
    authorUsername: "user.dev",
    createdAt: new Date("2026-01-08T08:30:00Z"),
  },
  // Staff — Jan 15
  {
    title: "Weekly Team Retro — 2026-01-15",
    description: "Sprint retrospective highlights: what went well, what to improve.",
    content: {
      sprint: 42,
      wentWell: ["Fast PR turnaround", "Zero production incidents"],
      toImprove: ["Test coverage still below 80 %", "Stand-up running long"],
      actionItems: [{ owner: "user.dev", action: "Add integration tests for report API", dueDate: "2026-01-22" }],
    },
    status: "published",
    groupName: "Staff",
    authorUsername: "user.dev",
    createdAt: new Date("2026-01-15T17:00:00Z"),
  },

  // ── February 2026 back-fill ────────────────────────────────────────────

  // IT-Admins — Feb 3
  {
    title: "Cloud Cost Review — February 2026",
    description: "Monthly breakdown of cloud infrastructure spend and savings opportunities.",
    content: {
      month: "2026-02",
      totalSpend: 8420,
      budgeted: 9000,
      savingsIdentified: 780,
      recommendations: ["Right-size 4 underutilised EC2 instances", "Move nightly backups to cold storage"],
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "admin.dev",
    createdAt: new Date("2026-02-03T10:00:00Z"),
  },
  // IT-Admins — Feb 17
  {
    title: "Incident Report — Auth Service Outage 2026-02-14",
    description: "Post-mortem for the 23-minute authentication service disruption on Valentine's Day.",
    content: {
      incidentDate: "2026-02-14",
      durationMinutes: 23,
      impactedUsers: 412,
      rootCause: "Certificate renewal job failed silently; expired cert rejected by load balancer.",
      resolution: "Manual cert renewal applied; automated renewal pipeline fixed and tested.",
      preventionActions: ["Add cert-expiry Prometheus alert with 14-day warning", "Weekly renewal-job dry-run"],
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "admin.dev",
    createdAt: new Date("2026-02-17T09:00:00Z"),
  },

  // Managers — Feb 4
  {
    title: "February Staffing Forecast",
    description: "Headcount planning and contractor requirements for February 2026.",
    content: {
      currentHeadcount: 38,
      plannedHires: 3,
      openRequisitions: ["Senior Backend Engineer", "QA Analyst", "Junior DevOps"],
      contractorsEngaged: 2,
    },
    status: "draft",
    groupName: "Managers",
    authorUsername: "manager.dev",
    createdAt: new Date("2026-02-04T11:30:00Z"),
  },
  // Managers — Feb 18
  {
    title: "Q1 Review Prep — February 2026",
    description: "Materials and agenda for the upcoming Q1 all-hands review meeting.",
    content: {
      meetingDate: "2026-03-02",
      agenda: ["KPI review", "Budget actuals vs forecast", "OKR progress", "Q2 planning preview"],
      slideDeckStatus: "in-progress",
      dataRequests: [{ department: "Finance", item: "Feb actuals", dueDate: "2026-02-26" }],
    },
    status: "draft",
    groupName: "Managers",
    authorUsername: "manager.dev",
    createdAt: new Date("2026-02-18T14:00:00Z"),
  },

  // Finance — Feb 7
  {
    title: "Monthly Budget Variance Report — February 2026",
    description: "Comparison of planned vs. actual expenditure across all cost centres for February 2026.",
    content: {
      month: "2026-02",
      totalBudget: 255000,
      totalActual: 241800,
      variance: -13200,
      costCentres: [
        { name: "Engineering", budget: 122000, actual: 118500 },
        { name: "Marketing",   budget: 52000,  actual: 55300  },
        { name: "Operations",  budget: 81000,  actual: 68000  },
      ],
    },
    status: "draft",
    groupName: "Finance",
    authorUsername: "manager.dev",
    createdAt: new Date("2026-02-07T09:00:00Z"),
  },

  // Staff — Feb 10
  {
    title: "Daily Stand-up Notes — 2026-02-10",
    description: "Morning stand-up notes from February 10.",
    content: {
      date: "2026-02-10",
      attendees: ["user.dev", "alice", "bob"],
      items: [
        { owner: "user.dev", task: "Report pagination endpoint", status: "done" },
        { owner: "alice",    task: "Frontend date-range filter", status: "in-progress" },
        { owner: "bob",      task: "Swagger docs update",       status: "done" },
      ],
    },
    status: "published",
    groupName: "Staff",
    authorUsername: "user.dev",
    createdAt: new Date("2026-02-10T08:30:00Z"),
  },
  // Staff — Feb 19
  {
    title: "Weekly Team Retro — 2026-02-19",
    description: "Sprint retrospective for sprint 46.",
    content: {
      sprint: 46,
      wentWell: ["Auth service post-mortem actioned quickly", "Onboarding doc updated"],
      toImprove: ["Flaky end-to-end tests causing false CI failures", "PR description quality"],
      actionItems: [
        { owner: "alice",    action: "Fix flaky Cypress tests",         dueDate: "2026-02-24" },
        { owner: "user.dev", action: "Add PR template to repo",         dueDate: "2026-02-21" },
      ],
    },
    status: "published",
    groupName: "Staff",
    authorUsername: "user.dev",
    createdAt: new Date("2026-02-19T17:00:00Z"),
  },

  // ── Reports by new users ───────────────────────────────────────────────

  // sarah.admin — IT-Admins
  {
    title: "Firewall Rule Audit — March 2026",
    description: "Quarterly review of firewall rules to remove stale entries and ensure compliance.",
    content: {
      totalRules: 214,
      staleRemoved: 18,
      flaggedForReview: 7,
      complianceStatus: "pass",
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "sarah.admin",
    createdAt: new Date("2026-03-05T10:00:00Z"),
  },
  {
    title: "SSL Certificate Inventory — March 2026",
    description: "Full inventory of active SSL/TLS certificates with expiry dates and renewal status.",
    content: {
      totalCertificates: 34,
      expiringSoon: 5,
      expired: 0,
      autoRenewalEnabled: 29,
    },
    status: "draft",
    groupName: "IT-Admins",
    authorUsername: "sarah.admin",
    createdAt: new Date("2026-03-12T14:00:00Z"),
  },

  // david.manager — Managers
  {
    title: "Cross-Team Dependency Map — Q1 2026",
    description: "Visual summary of inter-team dependencies and bottleneck areas for Q1.",
    content: {
      dependencies: [
        { from: "Engineering", to: "QA", type: "blocking", status: "resolved" },
        { from: "Marketing", to: "Engineering", type: "feature-request", status: "in-progress" },
        { from: "Support", to: "Engineering", type: "bug-fix", status: "open" },
      ],
      criticalPath: "Marketing → Engineering → QA",
    },
    status: "published",
    groupName: "Managers",
    authorUsername: "david.manager",
    createdAt: new Date("2026-03-08T09:30:00Z"),
  },

  // rachel.finance — Finance
  {
    title: "Vendor Contract Renewals — Q2 2026",
    description: "Upcoming vendor contract renewals with cost comparison and negotiation notes.",
    content: {
      contracts: [
        { vendor: "CloudHost Inc.", renewal: "2026-04-15", currentAnnual: 42000, negotiatedAnnual: 39500 },
        { vendor: "SecureID Corp.", renewal: "2026-05-01", currentAnnual: 18000, negotiatedAnnual: 17200 },
        { vendor: "DataPipe Ltd.",  renewal: "2026-06-10", currentAnnual: 27000, negotiatedAnnual: 25000 },
      ],
      totalSavings: 5300,
    },
    status: "published",
    groupName: "Finance",
    authorUsername: "rachel.finance",
    createdAt: new Date("2026-03-10T11:00:00Z"),
  },
  {
    title: "Travel & Expense Policy Update — 2026",
    description: "Proposed changes to the corporate travel and expense reimbursement policy.",
    content: {
      changes: [
        "Increase domestic per-diem from $75 to $90",
        "Require pre-approval for flights over $500",
        "Add ride-share receipts as valid expense category",
      ],
      effectiveDate: "2026-04-01",
      approvalStatus: "pending-review",
    },
    status: "draft",
    groupName: "Finance",
    authorUsername: "rachel.finance",
    createdAt: new Date("2026-03-18T15:30:00Z"),
  },

  // alex.dev — Staff
  {
    title: "API Performance Benchmarks — Sprint 48",
    description: "Load testing results for the report retrieval and creation endpoints.",
    content: {
      endpoints: [
        { path: "GET /api/reports", p50Ms: 45, p95Ms: 120, p99Ms: 310, rps: 500 },
        { path: "POST /api/reports", p50Ms: 82, p95Ms: 210, p99Ms: 480, rps: 200 },
      ],
      environment: "staging",
      notes: "P99 for POST exceeds 400ms target — investigate DB write contention.",
    },
    status: "published",
    groupName: "Staff",
    authorUsername: "alex.dev",
    createdAt: new Date("2026-03-03T16:00:00Z"),
  },

  // maya.dev — Staff
  {
    title: "Frontend Accessibility Audit — March 2026",
    description: "WCAG 2.1 AA compliance audit results for the main dashboard views.",
    content: {
      pagesAudited: 12,
      issuesFound: 23,
      critical: 3,
      major: 8,
      minor: 12,
      topIssues: ["Missing alt text on chart images", "Low contrast on secondary buttons", "Keyboard trap in date picker"],
    },
    status: "published",
    groupName: "Staff",
    authorUsername: "maya.dev",
    createdAt: new Date("2026-03-14T11:30:00Z"),
  },

  // tom.ops — IT-Admins (cross-group user)
  {
    title: "Kubernetes Cluster Health — March 2026",
    description: "Monthly health check of production k8s cluster nodes, pods, and resource utilisation.",
    content: {
      nodes: 6,
      healthyNodes: 6,
      totalPods: 84,
      restartingPods: 2,
      cpuUtilisation: "62%",
      memoryUtilisation: "71%",
      alerts: ["Pod daily-report-worker restarted 3x — OOMKilled"],
    },
    status: "published",
    groupName: "IT-Admins",
    authorUsername: "tom.ops",
    createdAt: new Date("2026-03-07T08:45:00Z"),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`[seed] ${msg}`);

// ─── Main ─────────────────────────────────────────────────────────────────────

const seed = async (): Promise<void> => {
  const uri    = getMongoUri();
  const dbName = getMongoDbName();

  log(`Connecting to MongoDB${dbName ? ` (${dbName})` : ""}...`);
  await mongoose.connect(uri, dbName ? { dbName } : undefined);
  log("Connected.");

  // ── 1. Upsert groups ──────────────────────────────────────────────────────
  log("Seeding groups...");
  const groupIdMap = new Map<string, mongoose.Types.ObjectId>();

  for (const name of GROUP_NAMES) {
    const doc = await Group.findOneAndUpdate(
      { name },
      { $setOnInsert: { name } },
      { upsert: true, returnDocument: "after" }
    );
    groupIdMap.set(name, doc._id as mongoose.Types.ObjectId);
    log(`  ✓ Group "${name}" → ${doc._id}`);
  }

  // ── 2. Upsert users ───────────────────────────────────────────────────────
  log("Seeding users...");

  for (const u of SEED_USERS) {
    const groupIds = u.groupNames.map((n) => {
      const id = groupIdMap.get(n);
      if (!id) throw new Error(`Unknown group name in seed data: "${n}"`);
      return id;
    });

    const doc = await User.findOneAndUpdate(
      { username: u.username },
      {
        // $set updates groups/role on every run so the seed stays in sync
        $set: { role: u.role, groups: groupIds },
      },
      { upsert: true, returnDocument: "after" }
    );
    log(`  ✓ User "${u.username}" (${u.role}) → ${doc._id}`);
  }

  // ── 3. Upsert reports ─────────────────────────────────────────────────────
  log("Seeding reports...");

  for (const r of SEED_REPORTS) {
    const groupId = groupIdMap.get(r.groupName);
    if (!groupId) throw new Error(`Unknown group name in report seed: "${r.groupName}"`);

    const authorDoc = await User.findOne({ username: r.authorUsername }).lean();
    if (!authorDoc) throw new Error(`Author not found in DB: "${r.authorUsername}" — run seed again after users are created`);

    const userRef = { username: authorDoc.username, userId: authorDoc._id as mongoose.Types.ObjectId };

    // When a custom createdAt is provided we must disable Mongoose's automatic
    // timestamp injection (timestamps: false) so it doesn't overwrite our value.
    const hasCustomDate = Boolean(r.createdAt);

    const doc = await Report.findOneAndUpdate(
      { title: r.title, group: groupId },
      {
        $set: {
          description: r.description,
          content:     r.content,
          status:      r.status,
          updatedBy:   userRef,
          ...(hasCustomDate ? { updatedAt: r.createdAt } : {}),
        },
        $setOnInsert: {
          createdBy: userRef,
          version:   1,
          ...(hasCustomDate ? { createdAt: r.createdAt } : {}),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        // Prevent Mongoose from stamping createdAt/updatedAt with Date.now()
        // when we are supplying our own dates.
        ...(hasCustomDate ? { timestamps: false } : {}),
      }
    );
    log(`  ✓ Report "${r.title}" (${r.status}) → ${doc._id}`);
  }

  log("Done.");
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error("[seed] Fatal error:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
