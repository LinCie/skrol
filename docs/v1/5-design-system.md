# Skrol Design System v1

## 1. Direction

Skrol is an API-first, privacy-conscious URL shortener. The UI should feel like a compact developer tool: calm, precise, technical, trustworthy, and intentionally small.

Skrol should feel:

* developer-first
* reliable
* restrained
* privacy-conscious
* operational
* low-friction

Skrol should not feel:

* marketing-heavy
* playful SaaS
* surveillance-analytics
* over-designed
* visually noisy

Core visual idea:

```text
neutral developer dashboard + teal technical accent + mono-heavy URL/API surfaces
```

---

## 2. shadcn Setup

Recommended shadcn configuration:

```json
{
  "style": "new-york",
  "tailwind": {
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

Use `new-york` because it is denser and more application-like. Use CSS variables so Skrol can theme shadcn through semantic tokens.

---

## 3. Typography

Recommended fonts:

```text
UI font:   Geist Sans or Inter
Mono font: Geist Mono or JetBrains Mono
```

Use sans for general UI. Use mono for:

* short URLs
* aliases
* destination URLs
* API keys
* IDs
* status codes
* error codes
* code examples

Type scale:

```text
Page title:       text-2xl font-semibold tracking-tight
Section title:    text-base font-semibold
Body:             text-sm or text-base
Metadata:         text-xs text-muted-foreground
Technical values: font-mono text-sm
```

---

## 4. Color Tokens

Skrol uses a cool neutral base with a teal primary accent.

Color roles:

| Token         | Use                                  |
| ------------- | ------------------------------------ |
| `background`  | App background                       |
| `foreground`  | Main text                            |
| `card`        | Panels and dashboard surfaces        |
| `primary`     | Main CTA, active nav, selected state |
| `secondary`   | Secondary filled UI                  |
| `muted`       | Empty states and helper surfaces     |
| `accent`      | Hover and subtle selected states     |
| `destructive` | Delete, revoke, flagged states       |
| `success`     | Active, copied, healthy              |
| `warning`     | Expired, rate-limited, caution       |
| `info`        | API guidance and privacy notes       |
| `border`      | Dividers and card outlines           |
| `ring`        | Focus states                         |

## 4.1 Global CSS Tokens

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--skrol-font-sans);
  --font-mono: var(--skrol-font-mono);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
}

:root {
  --skrol-font-sans: "Geist", "Inter", ui-sans-serif, system-ui, sans-serif;
  --skrol-font-mono: "Geist Mono", "JetBrains Mono", Consolas, monospace;

  --radius: 0.75rem;

  --background: oklch(0.985 0.004 247);
  --foreground: oklch(0.18 0.026 248);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.18 0.026 248);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.18 0.026 248);
  --primary: oklch(0.52 0.145 182);
  --primary-foreground: oklch(0.985 0.004 247);
  --secondary: oklch(0.95 0.014 247);
  --secondary-foreground: oklch(0.22 0.026 248);
  --muted: oklch(0.96 0.012 247);
  --muted-foreground: oklch(0.49 0.025 248);
  --accent: oklch(0.93 0.045 184);
  --accent-foreground: oklch(0.22 0.035 248);
  --destructive: oklch(0.58 0.22 25);
  --destructive-foreground: oklch(0.985 0.004 247);
  --border: oklch(0.90 0.012 247);
  --input: oklch(0.90 0.012 247);
  --ring: oklch(0.62 0.15 182);
  --success: oklch(0.58 0.14 155);
  --success-foreground: oklch(0.985 0.004 247);
  --warning: oklch(0.72 0.15 78);
  --warning-foreground: oklch(0.22 0.035 55);
  --info: oklch(0.58 0.13 235);
  --info-foreground: oklch(0.985 0.004 247);
  --chart-1: oklch(0.52 0.145 182);
  --chart-2: oklch(0.58 0.13 235);
  --chart-3: oklch(0.62 0.16 290);
  --chart-4: oklch(0.72 0.15 78);
  --chart-5: oklch(0.58 0.14 155);
  --sidebar: oklch(0.975 0.006 247);
  --sidebar-foreground: oklch(0.22 0.026 248);
  --sidebar-primary: oklch(0.52 0.145 182);
  --sidebar-primary-foreground: oklch(0.985 0.004 247);
  --sidebar-accent: oklch(0.93 0.045 184);
  --sidebar-accent-foreground: oklch(0.22 0.035 248);
  --sidebar-border: oklch(0.90 0.012 247);
  --sidebar-ring: oklch(0.62 0.15 182);
}

.dark {
  --background: oklch(0.14 0.018 248);
  --foreground: oklch(0.96 0.008 247);
  --card: oklch(0.18 0.022 248);
  --card-foreground: oklch(0.96 0.008 247);
  --popover: oklch(0.18 0.022 248);
  --popover-foreground: oklch(0.96 0.008 247);
  --primary: oklch(0.72 0.135 182);
  --primary-foreground: oklch(0.13 0.02 248);
  --secondary: oklch(0.24 0.026 248);
  --secondary-foreground: oklch(0.96 0.008 247);
  --muted: oklch(0.24 0.026 248);
  --muted-foreground: oklch(0.72 0.018 247);
  --accent: oklch(0.27 0.05 184);
  --accent-foreground: oklch(0.96 0.008 247);
  --destructive: oklch(0.68 0.20 25);
  --destructive-foreground: oklch(0.985 0.004 247);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 14%);
  --ring: oklch(0.72 0.135 182);
  --success: oklch(0.70 0.14 155);
  --success-foreground: oklch(0.12 0.018 155);
  --warning: oklch(0.78 0.14 78);
  --warning-foreground: oklch(0.17 0.025 55);
  --info: oklch(0.72 0.13 235);
  --info-foreground: oklch(0.12 0.018 235);
  --chart-1: oklch(0.72 0.135 182);
  --chart-2: oklch(0.72 0.13 235);
  --chart-3: oklch(0.74 0.15 290);
  --chart-4: oklch(0.78 0.14 78);
  --chart-5: oklch(0.70 0.14 155);
  --sidebar: oklch(0.16 0.02 248);
  --sidebar-foreground: oklch(0.92 0.008 247);
  --sidebar-primary: oklch(0.72 0.135 182);
  --sidebar-primary-foreground: oklch(0.13 0.02 248);
  --sidebar-accent: oklch(0.24 0.035 248);
  --sidebar-accent-foreground: oklch(0.96 0.008 247);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.72 0.135 182);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-family: var(--skrol-font-sans);
  }

  code,
  kbd,
  samp,
  pre {
    font-family: var(--skrol-font-mono);
  }
}
```

---

## 5. Layout

Recommended dashboard shell:

```text
Sidebar width: 240px
Main max width: 1200px
Desktop page padding: 24–32px
Mobile page padding: 16px
Page rhythm: space-y-6
Card rhythm: space-y-4
```

Content widths:

| Page           | Max width |
| -------------- | --------: |
| Login / signup |     420px |
| Create link    |     760px |
| Settings       |     720px |
| Link detail    |    1100px |
| Links list     |    1200px |
| Admin lookup   |     900px |

Standard page header:

```tsx
<header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
  <div className="space-y-1">
    <h1 className="text-2xl font-semibold tracking-tight">Links</h1>
    <p className="text-sm text-muted-foreground">
      Create, inspect, and manage your short links.
    </p>
  </div>
  <Button>Create link</Button>
</header>
```

---

## 6. Radius, Borders, and Shadows

| Element | Treatment                     |
| ------- | ----------------------------- |
| Buttons | `rounded-md`                  |
| Inputs  | `rounded-md`                  |
| Badges  | `rounded-md`                  |
| Cards   | `rounded-xl border`           |
| Dialogs | `rounded-xl` or `rounded-2xl` |
| Tables  | borders, no shadow            |
| Sidebar | right border, no shadow       |

Use borders more than shadows. Shadows should be subtle and reserved for dialogs, dropdowns, and popovers.

---

## 7. Iconography

Use Lucide icons.

Recommended icons:

```text
Link2, KeyRound, BarChart3, Settings, ShieldAlert, Plus,
Copy, ExternalLink, Trash2, Ban, RefreshCw, Search,
AlertTriangle, CheckCircle2, Clock3, Terminal, Code2, Globe2
```

Icon sizing:

| Context             |                  Size |
| ------------------- | --------------------: |
| Button/sidebar icon |              `size-4` |
| Metadata icon       |            `size-3.5` |
| Empty state icon    | `size-8` or `size-10` |

Use icons for recognition. Do not add icons to every table cell.

---

## 8. Core Components

## 8.1 Buttons

| Variant     | Use                  |
| ----------- | -------------------- |
| Default     | Primary page action  |
| Secondary   | Secondary action     |
| Outline     | Copy, open, inspect  |
| Ghost       | Nav and row actions  |
| Destructive | Delete, revoke, flag |

Button labels should be verb-first:

```text
Create link
Copy URL
Disable link
Re-enable link
Delete link
Create API key
Revoke key
Save changes
```

## 8.2 Cards

Use cards for bounded dashboard areas:

* create link form
* link summary
* analytics panels
* API key list
* privacy note
* admin lookup result

Recommended style:

```tsx
<Card className="border-border/80 bg-card">
  ...
</Card>
```

Avoid deeply nested cards.

## 8.3 Tables

Tables should be compact and utilitarian.

Rules:

* subtle row hover: `hover:bg-accent/60`
* truncate long URLs
* use mono for short URLs and aliases
* right-align row actions
* keep destructive actions behind confirmation

## 8.4 Inputs

Use mono for URL, alias, and API-key fields.

URL helper text:

```text
Only public HTTP and HTTPS URLs are allowed.
```

Alias helper text:

```text
Use 3–64 lowercase letters, numbers, hyphens, or underscores.
```

## 8.5 Badges

Use badges only for compact statuses.

Status treatments:

| Status   | Visual tone          |
| -------- | -------------------- |
| Active   | success              |
| Disabled | muted                |
| Expired  | warning              |
| Flagged  | destructive          |
| Deleted  | muted + line-through |
| Revoked  | muted or destructive |

Example badge classes:

```text
Active:   border-success/20 bg-success/10 text-success
Disabled: border-border bg-muted text-muted-foreground
Expired:  border-warning/25 bg-warning/10 text-warning-foreground
Flagged:  border-destructive/25 bg-destructive/10 text-destructive
Deleted:  border-border bg-muted text-muted-foreground line-through
```

---

## 9. Page Patterns

## 9.1 Login / Signup

Layout:

* centered card
* max width 420px
* wordmark at top
* short product description
* simple form

Login copy:

```text
Sign in to Skrol
Manage your short links, API keys, and aggregate analytics.
```

Signup copy:

```text
Create your Skrol account
Create privacy-conscious short links from the dashboard or API.
```

## 9.2 Links List

Required columns:

```text
Short link
Destination
Status
Clicks
Created
Expires
Actions
```

Empty state:

```text
No links yet
Create your first short link from the dashboard or API.
```

Primary action:

```text
Create link
```

## 9.3 Create Link

Fields:

* Destination URL
* Custom alias
* Title
* Expiration date

Success state:

```text
Link created
https://skrol.ink/docs
```

Actions:

```text
Copy URL
View link
Create another
```

## 9.4 Link Detail

Sections:

* short URL copy panel
* destination settings
* lifecycle controls
* total clicks
* clicks over time
* referrer breakdown
* device/browser breakdown

Use the alias/code as the page title.

Example:

```text
/docs
https://skrol.ink/docs
```

## 9.5 API Keys

Required table columns:

```text
Name
Prefix
Created
Last used
Expires
Status
Actions
```

One-time key display copy:

```text
Copy this key now
For security, Skrol will not show the full key again.
```

Use a mono code-style container with a clear copy button.

## 9.6 Admin Lookup

Keep admin minimal.

Fields and actions:

* search by code
* view metadata
* disable link
* flag link
* unflag link

Do not make the admin page feel like a full moderation suite.

---

## 10. Analytics Visual System

Analytics should feel aggregate, not identity-based.

Use panels for:

* total clicks
* clicks over time
* referrer domains
* device breakdown
* browser breakdown
* country breakdown, only if implemented

Chart rules:

* line chart for clicks over time
* bar/list for referrer domains
* restrained colors
* no gradients
* no 3D charts
* no visitor-profile language

Chart tokens:

```text
--chart-1: primary teal
--chart-2: info blue
--chart-3: muted purple
--chart-4: warning amber
--chart-5: success green
```

Empty analytics state:

```text
No clicks recorded yet
Analytics will appear after this short link receives traffic.
```

Avoid saying “No visitors yet.”

---

## 11. Privacy UI

Use privacy copy that reinforces restraint.

Recommended note:

```text
Skrol stores aggregate click metadata only. It does not set analytics cookies, fingerprint visitors, or store raw IP addresses in click events.
```

Privacy note style:

```tsx
<Card className="border-info/20 bg-info/5">
  ...
</Card>
```

Avoid analytics language like:

```text
visitor profiles
audience segments
identity graph
retargeting
tracking journey
```

---

## 12. Empty, Loading, and Error States

## 12.1 Empty states

Empty states should be calm and action-oriented.

Examples:

```text
No links yet
Create your first short link from the dashboard or API.
```

```text
No API keys
Create an API key to use Skrol from scripts, bots, and backend services.
```

```text
No clicks recorded yet
Analytics will appear after this short link receives traffic.
```

## 12.2 Loading states

Prefer skeletons over spinners for:

* links table
* analytics cards
* link detail metadata
* API key list

## 12.3 Error states

Use exact product language:

```text
Invalid URL
Unsafe URL
Alias already taken
Reserved alias
Rate limited
Unauthorized
Not found
```

Error messages should be short and actionable.

---

## 13. Motion

Motion should be functional only.

Use motion for:

* dropdowns
* dialogs
* toasts
* copy confirmation
* hover states

Timing:

```text
Fast:   100ms
Normal: 150ms
Slow:   200ms
Easing: ease-out
```

Avoid animated backgrounds, bouncy motion, and decorative page transitions.

---

## 14. Responsive Behavior

Desktop:

* sidebar navigation
* full tables
* multi-column analytics panels

Mobile:

* collapsed navigation
* stacked cards instead of dense tables where needed
* primary action remains visible
* URLs truncate cleanly

Mobile link card content:

```text
Short URL
Destination
Status + clicks
Created / expires
Actions
```

---

## 15. Accessibility

Rules:

* visible focus states on all controls
* do not rely on color alone for status
* icon-only buttons need accessible names
* every input needs a label
* destructive actions need confirmation
* tables should remain keyboard-usable

Good status pattern:

```text
[green badge] Active
```

Bad status pattern:

```text
green dot only
```

---

## 16. Final Frontend Direction

Skrol’s frontend should be a compact technical control panel.

Final design recipe:

```text
shadcn new-york
neutral base
teal primary
mono technical values
quiet cards
compact tables
clear lifecycle badges
privacy-conscious analytics
minimal admin surfaces
```

The design should support the MVP without making the product feel bigger, louder, or more marketing-oriented than it is.
