---
name: test-page
argument-hint: <url>
description: Test a page or user flow using Playwright CLI. Navigate to a URL, interact with elements, take snapshots, and verify behavior. Use when you need to visually check a page, test a form, verify a user flow, or debug UI issues.
---

# Test Page

Use the `playwright-cli` (Bash tool) to navigate to a page, interact with it, take snapshots, and verify it works correctly.

**IMPORTANT:** Never use the Playwright MCP. Always use `playwright-cli` via the Bash tool.

## Required Input

- **URL**: The page URL (e.g., `http://localhost:3001/validate` or a Vercel deployment URL)

## Instructions

### 1. Open the Browser and Navigate

```bash
playwright-cli open <url>
```

This opens a headless browser and navigates to the URL. It returns a page snapshot with element refs.

### 2. Take a Snapshot

```bash
playwright-cli snapshot
```

Read the snapshot YAML file to see the page structure and find element refs (e.g., `e11`, `e14`).

### 3. Interact and Verify

All interactions use element refs from the snapshot:

```bash
# Fill a form field
playwright-cli fill <ref> "<text>"

# Click a button or link
playwright-cli click <ref>

# Select from dropdown
playwright-cli select <ref> "<value>"

# Upload a file
playwright-cli upload <file-path>

# Type text into focused element
playwright-cli type "<text>"

# Navigate to a URL
playwright-cli goto <url>

# Check console for errors
playwright-cli console
```

After each interaction, run `playwright-cli snapshot` to see the updated page state and get new element refs.

### 4. Common Test Flows

#### Login Flow

1. `playwright-cli open http://localhost:3001/login`
2. Read snapshot to find email/password field refs
3. `playwright-cli fill <email-ref> "jenny.park@ttb.gov"`
4. `playwright-cli fill <password-ref> "specialist123"`
5. `playwright-cli click <submit-ref>`
6. `playwright-cli snapshot` — verify dashboard loaded

#### Validate Label Flow

1. Login first (see above)
2. `playwright-cli goto http://localhost:3001/validate`
3. `playwright-cli snapshot` — find form field refs
4. Select beverage type, upload label image, fill fields
5. Click "Validate"
6. `sleep 5 && playwright-cli snapshot` — verify results with annotated image

#### Review Queue Flow

1. Login first
2. `playwright-cli goto http://localhost:3001/review`
3. `playwright-cli snapshot` — verify queue table with pending items
4. Click first item
5. `playwright-cli snapshot` — verify review detail with override controls

### 5. Assess Results

After taking snapshots:

- Check the snapshot YAML for correct page structure and content
- Verify status badges show correct text
- Check that forms have proper labels
- Run `playwright-cli console` to check for errors
- Verify navigation works (links go to correct pages)

### 6. Clean Up

```bash
playwright-cli close
```

## Test Users

| Role                | Email                 | Password      |
| ------------------- | --------------------- | ------------- |
| Admin               | sarah.chen@ttb.gov    | admin123      |
| Specialist (senior) | dave.morrison@ttb.gov | specialist123 |
| Specialist (junior) | jenny.park@ttb.gov    | specialist123 |

## Tips

- After each interaction, run `playwright-cli snapshot` to get updated element refs
- Element refs change after page updates — always use refs from the latest snapshot
- If the dev server isn't running, ask the user to start it with `yarn dev`
- For deployed URLs that return 403, use `vercel` CLI's `get_access_to_vercel_url` first
- Use `playwright-cli console` to check for JavaScript errors
- Use `playwright-cli network` to debug failed API calls
