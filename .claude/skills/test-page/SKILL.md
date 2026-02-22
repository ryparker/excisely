---
name: test-page
argument-hint: <url>
description: Test a page or user flow using Playwright. Navigate to a URL, interact with elements, take screenshots, and verify behavior. Use when you need to visually check a page, test a form, verify a user flow, or debug UI issues.
---

# Test Page

Use the Playwright MCP to navigate to a page, interact with it, take screenshots, and verify it works correctly.

## Required Input

- **URL**: The page URL (e.g., `http://localhost:3000/validate` or a Vercel deployment URL)

## Instructions

### 1. Navigate to the Page

```
mcp__playwright__browser_navigate(url: "<url>")
```

Wait for the page to load:
```
mcp__playwright__browser_wait_for(time: 2)
```

### 2. Take a Screenshot

```
mcp__playwright__browser_take_screenshot(fullPage: true)
```

View the screenshot with the Read tool to assess the page.

### 3. Interact and Verify

Common interactions:

```
# Click a button or link
mcp__playwright__browser_click(selector: "button:has-text('Validate')")

# Fill a form field
mcp__playwright__browser_fill(selector: "input[name='brandName']", value: "Old Tom Distillery")

# Select from dropdown
mcp__playwright__browser_select_option(selector: "select[name='beverageType']", value: "distilled_spirits")

# Upload a file
mcp__playwright__browser_fill(selector: "input[type='file']", value: "/path/to/test-image.jpg")

# Wait for navigation or loading
mcp__playwright__browser_wait_for(time: 3)

# Take another screenshot to verify
mcp__playwright__browser_take_screenshot(fullPage: true)
```

### 4. Common Test Flows

#### Login Flow
1. Navigate to `/login`
2. Fill email: `jenny.park@ttb.gov`
3. Fill password: `specialist123`
4. Click "Sign In"
5. Wait 2s
6. Screenshot — verify dashboard loaded

#### Validate Label Flow
1. Login first (see above)
2. Navigate to `/validate`
3. Select beverage type
4. Upload label image
5. Fill application data fields
6. Click "Validate"
7. Wait 5s (AI processing)
8. Screenshot — verify results page with annotated image

#### Review Queue Flow
1. Login first
2. Navigate to `/review`
3. Screenshot — verify queue table with pending items
4. Click first item
5. Screenshot — verify review detail with override controls

### 5. Assess Results

After taking screenshots:
- Check that the page renders correctly (no broken layouts, missing content)
- Verify status badges show correct colors and text
- Check that forms have proper labels and validation
- Look for console errors (visible in Playwright output)
- Verify navigation works (links go to correct pages)

## Test Users

| Role | Email | Password |
|------|-------|----------|
| Admin | sarah.chen@ttb.gov | admin123 |
| Specialist (senior) | dave.morrison@ttb.gov | specialist123 |
| Specialist (junior) | jenny.park@ttb.gov | specialist123 |

## Tips

- Always wait 2-3 seconds after navigation or form submission for the page to settle
- Take screenshots before AND after interactions to see changes
- If the dev server isn't running, ask the user to start it with `yarn dev`
- For deployed URLs that return 403, use the Vercel MCP `get_access_to_vercel_url` first
- Use `fullPage: true` on screenshots to capture the entire page including below-the-fold content
