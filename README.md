# KiranaPilot 🛒🤖

> **AI Financial Intelligence for Small Merchants**
>
> KiranaPilot is an agentic financial intelligence platform purpose-built for India's local retail and kirana ecosystem. It provides real-time daily ledger management, khata credit tracking, cash-flow risk forecasting, and automated merchant insights.

---

## 📁 Project Structure

```text
KiranaPilot/
├── client/                 # React + Vite + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/     # Layout, Sidebar, TopNavigation
│   │   ├── pages/          # Home, Dashboard, Transactions, Customers, Forecast, Settings
│   │   ├── App.jsx         # Route declarations
│   │   ├── main.jsx        # App mounting & BrowserRouter
│   │   └── index.css       # Tailwind directives
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   └── package.json
└── server/                 # Node.js + Express Backend API
    ├── server.js           # Express app & /api/health endpoint
    ├── .env                # Local environment (PORT)
    ├── .env.example
    └── package.json
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18 or higher (tested on Node v24)
- **NPM**: v9 or higher

---

### 1. Backend Setup & Run

Open a terminal and navigate to `server/`:

```bash
cd server
npm install
npm run dev
```

The backend starts at:
```
http://localhost:5000
```

#### Health Check Endpoint:
- **URL**: `GET http://localhost:5000/api/health`
- **Response**:
  ```json
  {
    "success": true,
    "message": "KiranaPilot API is running"
  }
  ```

---

### 2. Frontend Setup & Run

Open a separate terminal and navigate to `client/`:

```bash
cd client
npm install
npm run dev
```

The frontend will start at:
```
http://localhost:5173
```

---

## 🧭 Routes & Pages

| Route | View | Description |
| :--- | :--- | :--- |
| `/` | **Landing / Home** | Displays "KiranaPilot", tagline, and "Open Dashboard" button |
| `/dashboard` | **Financial Dashboard** | Today's Sales, Cash Available, Khata Outstanding, 7-Day Forecast |
| `/transactions` | **Transactions** | Daily counter sales, payouts, and customer credit ledger |
| `/customers` | **Khata & Customers** | Customer credit dues, repayment trust score, and debt risk |
| `/forecast` | **Cash-Flow Forecast** | 7-day liquidity timeline and upcoming distributor dues |
| `/settings` | **Settings** | Merchant store details, currency locale, and engine status |

---

## ⚙️ Environment Variables

### Server (`server/.env`)
```env
PORT=5000
```

### Client (`client/.env.example`)
```env
VITE_API_URL=http://localhost:5000
```

> **Note**: `.env` files are ignored by git in `.gitignore`. No secret keys or credentials should be committed.

---

## 🔮 Roadmap (Future Modules)
The initial foundation is completed. The following features will be implemented in future dedicated modules:
- MySQL Database integration and migrations
- Merchant authentication and multi-tenancy
- Vernacular Voice-to-text transaction input
- Computer Vision / OCR for handwritten bahi-khata ledger photos
- LLM Agentic transaction extraction & classification
- Cash-flow predictive models & distributor credit assistance
