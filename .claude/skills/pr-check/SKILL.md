---
name: pr-check
description: Check whether a myRating pull request is ready to merge — mergeability/conflicts, CI checks, reviews, branch hygiene, and myRating's app-boundary rules, plus code quality (hardcoded text, magic values, duplicated constants/components/hooks, inefficiencies) on the diff. Use when the user asks to check, vet, or review a PR / merge request, asks "is PR #N ready to merge", or before merging anything into main. Takes an optional PR number, URL, or branch; defaults to the PR for the current branch.
---

# pr-check

Read-only readiness check for a PR on `NathanLe2247/MyRating`. Produces a
verdict (READY / NEEDS WORK / BLOCKED) with the reasons. **Never merges,
approves, comments, or pushes** — only report. If the user wants it merged
after the check, they ask separately.

## 1. Resolve the PR

Argument may be a number (`12`), URL, or branch name. With no argument, use
the current branch's PR:

```bash
gh pr view ${ARG} --json number,title,url,state,isDraft,author,baseRefName,headRefName,mergeable,mergeStateStatus,reviewDecision,additions,deletions,changedFiles,commits,labels,body
```

If there's no PR for the branch, say so and list open ones with
`gh pr list --state open` — don't guess which one they meant.

If `state` is `MERGED` or `CLOSED`, report that and stop.

## 2. Merge mechanics

From the JSON above:

| Field | Blocker when |
|---|---|
| `isDraft` | `true` — PR is still a draft |
| `baseRefName` | not `main` (flag it; may be intentional for stacked PRs) |
| `mergeable` | `CONFLICTING` → conflicts with base. `UNKNOWN` → GitHub is still computing; re-run `gh pr view` once after a few seconds |
| `mergeStateStatus` | `DIRTY` (conflicts), `BLOCKED` (protection rules unmet), `BEHIND` (needs update from base), `UNSTABLE` (non-required checks failing) |
| `reviewDecision` | `CHANGES_REQUESTED`; `REVIEW_REQUIRED` if branch protection requires review |

For conflicts, list the conflicting files:

```bash
git fetch origin main <head-branch>
git merge-tree --write-tree --name-only origin/main origin/<head-branch>
```

(non-zero exit + file list = conflicts; don't actually merge locally.)

## 3. CI checks

```bash
gh pr checks <number>
```

Report each failing or pending check by name. For a failure, pull the
failing log tail so the report says *why*:

```bash
gh run view <run-id> --log-failed | tail -50
```

No checks configured is not a failure — note "no CI configured" so the user
knows nothing was verified automatically.

## 4. Reviews and open threads

```bash
gh pr view <number> --json reviews,latestReviews --jq '.latestReviews[] | "\(.author.login): \(.state)"'
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved path line comments(first:1){nodes{author{login} body}}}}}}}' -f o=NathanLe2247 -f r=MyRating -F n=<number>
```

Unresolved review threads count as NEEDS WORK — list each with `path:line`
and the first comment's gist.

## 5. Diff review against myRating rules

Get the diff: `gh pr diff <number>` (and `gh pr diff <number> --name-only`
for the file list). Check it against the repo's boundary rules from
`.claude/CLAUDE.md` and `agent/agents/code-reviewer.md`:

- **Shared shapes** — `RatingEntry`, `Court`, `Tournament`, `NewsItem`
  defined or re-declared anywhere outside `shared/`.
- **Mobile-only leakage** — queueing, chat/presence, HealthKit/WHOOP code or
  imports in `frontend/`.
- **Ratings math** — Glicko-2 / rating/RD/volatility computation outside
  `backend/supabase/functions/ratings/`; clients writing ratings or match
  state directly to Supabase instead of via edge functions.
- **Auth** — Supabase Auth APIs (`supabase.auth.signIn*`, `signUp`, etc.)
  used as the identity provider; auth must be Clerk, Supabase only consumes
  the Clerk JWT.
- **Health credentials** — raw WHOOP tokens / HealthKit data persisted in
  `shared/` or client-visible tables.
- **Mobile structure** — components, types, or logic defined inline in
  `mobile/app/` route files instead of `mobile/src/`.
- **Migrations** — new files in `backend/supabase/migrations/` that edit an
  already-merged migration instead of adding a new one; new tables without
  RLS enabled.
- **Secrets** — committed `.env` files, API keys, Clerk secret keys,
  Supabase service-role keys.

Also flag ordinary correctness bugs you notice (ignored error results,
silent dead-ends, UI controls that do nothing).

## 6. Code quality

Review every non-generated file in the diff (skip lockfiles). These findings
are **NEEDS WORK** when they're clear-cut (a literal user-facing string, a
duplicated constant); judgment calls go under Notes.

**Hardcoded text** — every user-facing string comes from `src/i18n/en.ts`
(mobile) or the app's equivalent. Flag string literals rendered in JSX,
passed as `label`/`placeholder`/`title`/`accessibilityLabel`, or used as
error messages. Not flagged: route paths, style values, test IDs, log
messages, i18n files themselves.

**Magic values** — colors, font families, sizes, radii, spacing, durations,
and limits belong in `src/constants/` (`theme.ts` for `Colors`/`Brand`/
`Spacing`/fonts). Flag:
- hex/rgb colors outside `constants/` (exception: third-party brand marks
  like the Google "G", if commented);
- numbers repeated across files that mean the same thing (e.g. a `48`
  input height, `24`/`999` pill radius, `480` max width) — suggest one
  named constant;
- arithmetic on tokens that reads like a missing token
  (`Spacing.two + Spacing.one`, `Spacing.two + 2`);
- values that duplicate an existing constant (e.g. a literal `480` when
  `MaxContentWidth` exists).

**Duplication / reuse** — before accepting a new component, hook, constant,
or helper, search the *whole repo* (not just the diff) for an existing one:

```bash
git grep -nE '<name-or-shape>' origin/main -- mobile/src shared
```

Flag: a new hook/component that does what an existing one already does
(e.g. two post-auth navigation hooks, two Google sign-in hooks, two button
components with the same look); two constants objects with the same name or
overlapping keys; copy-pasted blocks across screens that should be one
component; local types that already exist in `shared/` or `src/types/`.
Also check other **open PRs** for overlap — the same file or the same
abstraction being introduced twice is a merge-order problem:

```bash
gh pr list --state open --json number,headRefName --jq '.[] | "\(.number) \(.headRefName)"'
gh pr diff <other> --name-only    # intersect with this PR's file list
```

**Inefficiencies** — flag only with a concrete cost:
- work repeated on every render that could be hoisted to module scope or
  memoized (static arrays/objects, regexes, `StyleSheet.create` inside a
  component);
- inline closures/objects passed to memoized children or list items;
- state that can be derived from other state/props;
- effects that should be event handlers; missing effect cleanup;
- redundant or sequential network calls that could be one / parallel;
  Supabase queries in loops (N+1), `select('*')` where few columns are used;
- new dependencies that duplicate an existing one, or heavy deps for
  something small;
- dead code: unused exports, props, imports, i18n keys, or files left behind
  after a rewrite.

**Leftovers** — `console.log`, commented-out code, `TODO`s that ship visible
behavior (e.g. a control that does nothing yet), `as never` / `as any` casts
without a comment.

For a deeper correctness pass, suggest `/code-review` instead of
duplicating it here.

## 7. Branch hygiene (lightweight, non-blocking)

- Commits: `gh pr view <number> --json commits --jq '.commits[].messageHeadline'`
  — flag WIP/fixup commits that should be squashed.
- Size: >800 changed lines or >30 files → suggest splitting.
- Empty or missing PR description → mention it.

## Output

Lead with the verdict, then only sections that have something to say:

```
PR #12 — Redesign sign-in screens  →  NEEDS WORK
https://github.com/NathanLe2247/MyRating/pull/12

Blockers
- CI: `typecheck` failing — mobile/app/sign-in.tsx:42 TS2322 ...
- 1 unresolved thread: mobile/src/components/auth-form.tsx:88 (reviewer: "...")

Rule violations
- mobile/app/sign-in.tsx:15 defines `AuthFormProps` inline — move to mobile/src/types/

Code quality
- mobile/src/components/auth/auth-card.tsx:24 hardcoded "OR" — add to en.ts
- mobile/src/components/auth/primary-button.tsx:12 `borderRadius: 999` repeated in 4 files — add a `Radius.pill` token
- mobile/src/hooks/use-navigate-after-auth.ts duplicates hooks/use-auth-navigate.ts — reuse it

Notes (non-blocking)
- 3 "wip" commits — consider squash-merging
```

Verdicts:
- **READY** — not draft, no conflicts, required checks green, no changes
  requested, no unresolved threads, no rule violations, no clear-cut
  code-quality findings.
- **NEEDS WORK** — fixable issues: failing checks, unresolved threads, rule
  violations, hardcoded text, duplicated constants/abstractions, behind base.
- **BLOCKED** — conflicts, changes requested, or draft.
