# Expense-Aware Food Ordering — Chrome Extension

A Chrome extension that injects a **budget-awareness widget** into Swiggy's web checkout so users see how much of their monthly food budget remains before they place an order.

> Built for the [Swiggy MCP Builders Club](https://mcp.swiggy.com/builders/) using the Swiggy Food server (`get_food_cart`, `get_food_orders`).

---

## Problem

Food delivery apps are designed to encourage impulse purchases. Swiggy has no native budget awareness at checkout, so users often overspend without realizing it until the end of the month.

## Solution

Before you complete checkout on Swiggy (`/checkout`), the extension shows a clear budget warning on the order summary—for example:

> This ₹420 order will leave you with ₹180 of your ₹2,000 monthly budget.

Users set a monthly food budget in the extension popup. The banner combines that budget with live cart total and monthly spend (from Swiggy MCP once credentials are connected; mocked data works for local demo before approval).

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  User on swiggy.com (cart / checkout)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3, React 18)                       │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Content      │  │ Service Worker  │  │ Popup              │  │
│  │ Script       │  │ (background)    │  │                    │  │
│  │ Budget banner│◄─┤ OAuth 2.1 PKCE  │  │ Set monthly budget │  │
│  │ on checkout  │  │ MCP API proxy   │  │ Spend summary      │  │
│  └──────┬───────┘  └────────┬────────┘  └────────────────────┘  │
│         │                   │                                    │
│         │    chrome.runtime.sendMessage                        │
│         └───────────────────┘                                    │
│  Budget prefs → chrome.storage.sync                              │
│  OAuth tokens → chrome.storage.session                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ Bearer token (user's Swiggy session)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Swiggy MCP (JSON-RPC over HTTPS)                               │
│  POST https://mcp.swiggy.com/food                               │
│  • get_food_cart   → current cart total                         │
│  • get_food_orders → order history → monthly spend              │
└─────────────────────────────────────────────────────────────────┘
```

**v1 design:** No custom backend. Budget settings live in `chrome.storage.sync`; the service worker holds OAuth tokens and proxies MCP calls so the content script never touches secrets directly.

**Phase 2 (planned):** Google Sheets and Notion sync for budgets users already track elsewhere.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm 9+
- Google Chrome (desktop)
- Git

### Clone the repository

```bash
git clone https://github.com/<your-username>/expense-aware-food-ordering-extension.git
cd expense-aware-food-ordering-extension
```

### Install and build (after Phase 1 scaffold)

From the repo root:

```bash
cd extension
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/dist`
4. Open [swiggy.com](https://www.swiggy.com), add items, open checkout (`/checkout`), and confirm the budget banner appears

### Development (watch mode)

```bash
cd extension
npm run dev
```

Reload the extension in `chrome://extensions` after rebuilds.

> **Before MCP credentials:** You can build and demo the full UI with mocked cart and spend data. Swiggy recommends a short Loom walkthrough with working local code when applying for API access.

---

## Project Structure

```
expense-aware-food-ordering-extension/
├── extension/                      # Chrome extension source
│   ├── public/
│   │   └── manifest.json           # Manifest V3
│   ├── src/
│   │   ├── background/             # Service worker — OAuth, MCP proxy
│   │   ├── content/                # Content script — budget banner on Swiggy
│   │   ├── popup/                  # Extension popup — budget settings
│   │   └── shared/                 # Budget logic, Swiggy MCP client
│   ├── package.json
│   └── webpack.config.js           # Multi-entry: background, content, popup
├── documentation/
│   ├── IMPLEMENTATION_BREAKDOWN.md # Phase-by-phase build plan
│   ├── guides/                     # Step-by-step implementation guides
│   └── MCP_Application_Strategy.md
├── .gitignore
├── LICENSE
└── README.md
```

Implementation phases and checklists: see [documentation/IMPLEMENTATION_BREAKDOWN.md](./documentation/IMPLEMENTATION_BREAKDOWN.md).

---

## Swiggy MCP Access

This extension needs Swiggy MCP Food API credentials. Apply only after you have a public repo and a short demo video of the local flow.

| Step | Action |
|------|--------|
| 1 | Apply at [Swiggy MCP Builders — Access](https://mcp.swiggy.com/builders/access/) |
| 2 | Select **Swiggy Food** MCP server |
| 3 | Integration type: **Web App** (Chrome Extension) |
| 4 | Set Redirect URI to your extension's Chrome identity URL (see below) |
| 5 | Submit the [developer application form](https://forms.gle/4vkeKyqm15Qb6fnJA) with repo + Loom links |

### Redirect URI (Chrome Extension)

After loading the unpacked extension, copy the **Extension ID** from `chrome://extensions`. Your OAuth redirect URI is:

```
https://<extension-id>.chromiumapp.org/
```

Chrome manages this URL via `chrome.identity` — you do not host it yourself.

### OAuth endpoints

| Purpose | URL |
|---------|-----|
| Authorize | `https://mcp.swiggy.com/auth/authorize` |
| Token | `https://mcp.swiggy.com/auth/token` |

Use OAuth 2.1 with PKCE (`chrome.identity.launchWebAuthFlow`).

### MCP Food API

| Item | Value |
|------|--------|
| Endpoint | `POST https://mcp.swiggy.com/food` |
| Staging (dev) | `POST https://mcp-staging.swiggy.com/food` |
| Protocol | JSON-RPC 2.0 — `method: "tools/call"` |
| Auth header | `Authorization: Bearer <access_token>` |

### Tools used in v1

| Tool | Purpose |
|------|---------|
| `get_food_cart` | Current cart items and total before checkout |
| `get_food_orders` | Past orders — filtered to current calendar month for spend |

Example request body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_food_cart",
    "arguments": {}
  }
}
```

### Support

- Builders program: [mcp.swiggy.com/builders](https://mcp.swiggy.com/builders/)
- Questions: builders@swiggy.in

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension | Chrome Manifest V3, React 18 |
| Build | Webpack 5, Babel |
| Auth | OAuth 2.1 + PKCE via `chrome.identity` |
| Local state | `chrome.storage.sync` (budget), `chrome.storage.session` (tokens) |
| APIs | Swiggy MCP Food — `get_food_cart`, `get_food_orders` |
| Phase 2 | Google Sheets API, Notion API |

---

## License

MIT — see [LICENSE](./LICENSE).
