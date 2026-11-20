# SnapSchool: cofounder, partner and engineering handbook

Last reviewed: 2026-11-20. This handbook explains the existing project to a new business partner, developer or coding agent. It describes implementation and recorded evidence; it is not a claim that every feature has passed production acceptance.

## Choose your reading path

| Reader | Read first | Then |
|---|---|---|
| Cofounder / business partner | [Product and operations](product-and-operations.md) | Engineering overview below, then the delivery priorities in the product guide |
| Developer / technical partner | This overview | [Engineering guide](engineering.md), [local setup](../getting-started.md), [current state](../agents/current-state.md) |
| Coding agent | [Root AGENTS.md](../../AGENTS.md) | [Agent handoff index](../agents/README.md), this handbook, then the actual feature code |

## What we are building

SnapSchool brings school administration and family communication into one system. The web dashboard manages school records and operations. The mobile app exposes role-specific school information and actions. Hnia adds assistant capabilities through backend integrations; a separate voice service supports voice-agent work.

The central operational chain is:

```text
School setup and administrator access
  → students and shared guardian records
  → levels and exact class assignments
  → parent account preparation and distribution of login slips
  → mobile sign-in and access to the correct children
  → ongoing academic, attendance, billing and communication workflows
```

Importing students, assigning classes and activating parent access are distinct steps. Completing one does not imply the others are complete.

## The three projects

These directories sit beside one another in the current workspace. They are separate projects with their own dependency manifests, rather than a single npm workspace.

| Project | Responsibility | Stack observed in its manifest | Boundary |
|---|---|---|---|
| `SnapSchool_Web` | School dashboard, business rules, database access, mobile HTTP APIs, integrations and Python PDF entry point | Next.js 15, React 18, TypeScript, Prisma 6, PostgreSQL, Supabase, Tailwind | This repository and its handoff rules |
| `SnapSchool_Mobile` | Mobile client consuming school APIs | Expo 54, React Native 0.81, React 19, TypeScript | Separate installation, build and release process |
| `voice-agent` | Voice-agent process | TypeScript and LiveKit Agents with provider plugins | Separate process and provider configuration |

The sibling manifests were inspected for this guide. Their complete implementations, deployment state and release readiness were not audited. Read each project's own instructions before editing it. In particular, do not force the web and mobile React versions to match simply because they share a brand.

## How the pieces communicate

```text
Administrator browser ── Supabase session ──┐
                                          ▼
Mobile app ── phone/password + token ──► Next.js server
                                          │
                              authorization + school scope
                                          │
                                   domain rules
                                          │
                                      Prisma
                                          │
                                     PostgreSQL

PDF upload → authenticated web import route → signed Python worker
           → extracted review data → explicit transactional import

Assistant / messaging / voice features → their own server integrations
```

Web authentication and mobile authentication have separate entry points. A valid identity must still be authorized for its school and records. Supabase provides web authentication infrastructure; Prisma is the application's database access layer. Knowing the Supabase URL is not permission to read a school's records.

## Where the truth lives

| Question | Source |
|---|---|
| What does the product do and how does a school use it? | [Product and operations](product-and-operations.md) |
| Where should an engineer make a change? | [Engineering guide](engineering.md) and [feature map](../agents/feature-map.md) |
| What remains broken or unverified? | [Current state](../agents/current-state.md) |
| Why was a recent change made? | [Agent change log](../agents/change-log.md) and Git history |
| What are the required working rules? | [AGENTS.md](../../AGENTS.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md) |
| How do I run the web project? | [Getting started](../getting-started.md) |

Historical documents in `docs/archive/` can explain earlier decisions but should not override current code and current handoffs. A pushed commit, a successful build, an applied migration and a user-verified flow are different milestones.

## Keeping this handbook useful

Update these pages when product behavior, project boundaries, onboarding or operational responsibilities change. Update the agent change log and root AGENTS.md in the same change. Keep detailed incident status in current-state rather than copying it into several conflicting lists. Never add real family records, credentials, private exports or access codes to documentation.
