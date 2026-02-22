---
name: check-deployment
description: Verify that the Vercel deployment is healthy. Checks build status, runtime logs, and page accessibility. Use when you need to check if the app is deployed, diagnose deployment failures, or verify production is working.
---

# Check Deployment

Verify the Vercel deployment is healthy using the Vercel MCP tools and CLI.

## Instructions

### 1. Find the Project

Read `.vercel/project.json` to get the project ID and org ID:
```bash
cat .vercel/project.json
```

If that file doesn't exist, use the Vercel MCP:
```
mcp__claude_ai_Vercel__list_teams()  → get teamId
mcp__claude_ai_Vercel__list_projects(teamId)  → find the project
```

### 2. Check Latest Deployment

```
mcp__claude_ai_Vercel__list_deployments(projectId, teamId)
```

Look at the most recent deployment. Check its `state`:
- `READY` = deployed successfully
- `ERROR` = build failed
- `BUILDING` = still in progress
- `QUEUED` = waiting to build

### 3. If Build Failed — Get Logs

```
mcp__claude_ai_Vercel__get_deployment_build_logs(idOrUrl, teamId, limit: 200)
```

Read the logs to identify:
- TypeScript errors
- Missing environment variables
- Dependency installation failures
- Build timeout

### 4. If Build Succeeded — Verify Page Loads

```
mcp__claude_ai_Vercel__web_fetch_vercel_url(url: "https://<deployment-url>/")
```

Verify the page returns HTML, not an error page. Check for:
- 200 status
- Expected page content (login page or dashboard)
- No "Application error" or "500 Internal Server Error"

If you get a 403, generate a share link:
```
mcp__claude_ai_Vercel__get_access_to_vercel_url(url: "https://<deployment-url>/")
```

### 5. Check Runtime Logs for Errors

```
mcp__claude_ai_Vercel__get_runtime_logs(
  projectId,
  teamId,
  level: ["error", "fatal"],
  since: "1h",
  limit: 50
)
```

Look for:
- Database connection errors
- OpenAI API failures
- Auth errors
- Unhandled exceptions

### 6. Report

Summarize findings:
- Deployment status (ready/error/building)
- Build time
- Any errors found in build or runtime logs
- Whether the app is accessible and returning expected content

## Quick Check (All-in-One)

For a fast health check, run these steps in order. Stop at the first failure and report the issue.

## Tips

- If environment variables are missing in production, they need to be set in the Vercel dashboard (Project Settings → Environment Variables)
- Runtime logs are only available for serverless/edge functions, not static pages
- Build logs are the most useful for diagnosing deployment failures
