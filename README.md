# KhataAI: AI Financial Intelligence for Small Merchants

KhataAI turns a kirana store's handwritten Khata (credit ledger) into a digital system. Merchants can scan ledger pages, record transactions by voice, track customer dues, see a 7-day cash-flow forecast, and ask questions in English, Hindi or Hinglish.

![Dashboard](screenshots/dashboard.png)

## Problem

Small merchants still keep credit records in handwritten books. This makes it hard to track who owes money, to enter transactions quickly, and to see upcoming cash shortages.

## Features

- **Handwritten Khata OCR**: upload a ledger image, extract text, and get transaction drafts that the merchant reviews before saving.
- **Voice-to-transaction**: say "Ramesh bought groceries worth Rs 850 on credit" and get a structured transaction draft.
- **Customer name matching**: merges variations such as "Ramesh", "Ramesh Bhai" and "Ramesh Ji" into one customer.
- **Dashboard**: today's sales, available cash, Khata outstanding, customer dues, recent transactions and alerts.
- **7-day cash-flow forecast**: based on [FILL: how it works, e.g. recent average sales, expenses and expected customer payments].
- **AI Copilot (Sarvam AI)**: ask "Ramesh ka payment batao" or "Who owes me money?" and get answers from live MySQL data.
- **Financial alerts**: low cash, projected cash gaps and high outstanding dues.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, [Vite / Tailwind CSS: keep what you use] |
| Backend | Node.js, Express.js |
| Database | MySQL |
| AI | Sarvam AI API (Copilot), [FILL: OCR engine used] |

## How It Works

1. **OCR flow:** Ledger image, then OCR, then text extraction, then AI processing, then transaction draft, then merchant review, then saved to the database.
2. **Name matching:** [FILL: one or two lines, e.g. normalises names and compares similarity before creating a new customer].
3. **Forecast:** [FILL: one or two lines on the calculation].
4. **Copilot:** the question is sent to Sarvam AI together with the merchant's customer, Khata and transaction data from MySQL.

## Project Structure

```
Khata_AI/
├── client/      # React frontend
├── server/      # Node.js + Express API
├── database/    # MySQL schema and seed data
└── README.md
```

## Setup

### 1. Database
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql   # optional sample data
```
[FILL: correct file names from your database folder]

### 2. Backend
```bash
cd server
npm install
cp .env.example .env
npm start
```

`.env` variables:
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
SARVAM_API_KEY=your_sarvam_api_key
JWT_SECRET=your_jwt_secret   # remove if you do not use JWT
```
Never commit your `.env` file.

### 3. Frontend
```bash
cd client
npm install
npm run dev
```

## API Endpoints

[FILL: list your main routes, for example]

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/...` | Upload ledger image for OCR |
| POST | `/api/...` | Create transaction |
| GET | `/api/...` | List customers and dues |
| GET | `/api/...` | 7-day forecast |
| POST | `/api/...` | Copilot question |

## Testing

OCR was manually tested on 50+ handwritten ledger images. [FILL: one honest line, e.g. printed text worked well, messy handwriting was less reliable.]

## Known Limitations

- OCR accuracy drops on messy or faded handwriting, so transaction drafts always need merchant review.
- The forecast is [FILL: simple estimate, not a trained ML model, if true].
- [Add any other honest limits.]

## Screenshots

| Dashboard | OCR Review | Copilot |
|---|---|---|
| ![](screenshots/dashboard.png) | ![](screenshots/ocr.png) | ![](screenshots/copilot.png) |

## Author

Shivam Chitlangia | [GitHub](https://github.com/SHIVAM200669) | shivamchitlangia1@gmail.com
