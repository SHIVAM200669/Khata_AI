# KhataAI – AI Financial Intelligence for Small Merchants

KhataAI is an AI-powered financial management platform designed for small kirana stores. It helps merchants move from handwritten Khata (credit ledger) books to a digital system using handwritten ledger OCR, voice-based transaction entry, customer tracking, cash-flow forecasting, and an AI-powered Copilot.

The goal is to make everyday bookkeeping simpler, faster, and more accessible for small business owners.

## Problem Statement

Many small merchants still maintain customer credit records in handwritten notebooks. Managing these records manually can make it difficult to:

- Track customer dues and outstanding payments.
- Record daily transactions efficiently.
- Identify duplicate customer entries.
- Monitor available cash and business expenses.
- Anticipate potential cash shortages.

KhataAI addresses these challenges by digitizing bookkeeping and providing AI-assisted financial insights.

## Key Features

### 1. Handwritten Khata OCR
- Upload handwritten ledger images.
- Extract text using OCR.
- Convert extracted information into structured transaction drafts.
- Allow merchants to review transactions before saving them.
- Manually tested OCR on 50+ handwritten ledger images.

### 2. Voice-to-Transaction
- Record transactions using natural language.
- Convert voice input into structured transaction information.
- Reduce the need for manual data entry.

Example:  
"Ramesh bought groceries worth Rs. 850 on credit."

### 3. Customer Name Matching
- Identify variations in customer names.
- Help avoid duplicate customer records.
- Maintain a more consistent customer and payment history.

Example: `Ramesh`, `Ramesh Bhai`, and `Ramesh Ji`.

### 4. AI Financial Copilot
- Integrated Sarvam AI for natural-language financial queries.
- Ask questions in English, Hindi, or Hinglish.
- Retrieve relevant customer, Khata, and transaction information from MySQL.

Example queries:
- "Ramesh ka payment batao."
- "Who owes me money?"
- "Show my customer dues."

### 5. Financial Dashboard
The dashboard provides an overview of:
- Today's sales.
- Available cash.
- Outstanding Khata balance.
- Customer dues.
- Recent transactions.
- Financial alerts.

### 6. 7-Day Cash-Flow Forecast
- Forecasts expected cash flow for the next seven days.
- Helps merchants identify potential cash shortages.
- Displays alerts when projected cash falls below the configured minimum threshold.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MySQL |
| AI Integration | Sarvam AI API |
| Document Processing | OCR |
| Development Tools | Git, GitHub, VS Code |

## How It Works

**1. Ledger Digitization**

Ledger Image → OCR Processing → Text Extraction → Transaction Draft → Merchant Review → MySQL Database

**2. Voice-Based Entry**

Voice Input → Speech Processing → AI Interpretation → Structured Transaction Draft → Merchant Review → Database

**3. Customer Management**

Customer names and transaction records are processed to identify name variations and reduce duplicate customer entries.

**4. AI Copilot**

Merchant Question → Sarvam AI → Relevant MySQL Customer and Transaction Data → Natural-Language Response

**5. Cash-Flow Forecasting**

The platform uses its financial transaction data to generate a seven-day cash-flow forecast and identify potential cash gaps.

## Project Structure

```text
KhataAI/
├── client/       # React frontend
├── server/       # Node.js and Express backend
├── database/     # MySQL schema and database files
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- MySQL Server
- Sarvam AI API key

### 1. Clone the Repository

```bash
git clone https://github.com/SHIVAM200669/KhataAI.git
cd KhataAI
```

### 2. Configure the Database

- Start your MySQL server.
- Create the database required by the application.
- Import the SQL schema and any required seed files from the `database/` directory.
- Configure your database credentials in the backend environment file.

### 3. Start the Backend

```bash
cd server
npm install
```

Configure the required environment variables in your `.env` file, then start the backend using the start script defined in `package.json`.

### 4. Start the Frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

The frontend will run at the local development URL displayed by Vite.

**Note:** Refer to the actual configuration files in the repository for exact database names, environment variables, and available scripts.

## Testing

- Manually tested the handwritten ledger OCR workflow on 50+ ledger images.
- Transaction drafts are reviewed before being saved.
- The application includes duplicate detection and customer Khata management workflows.

## Known Limitations

- OCR accuracy can vary depending on handwriting quality, image clarity, and lighting.
- Extracted transactions require merchant review before saving.
- Cash-flow forecasts are estimates and should not be treated as guaranteed financial predictions.
- AI-generated responses depend on the quality of the available transaction and customer data.

## Future Improvements

- Improve OCR accuracy for different handwriting styles.
- Enhance cash-flow forecasting.
- Add more regional language support.
- Improve financial reporting and merchant insights.
- Expand automated transaction validation.

## Author

**Shivam Chitlangia**

Computer Science and Engineering Student  
SRM Institute of Science and Technology, Chennai

[GitHub Profile](https://github.com/SHIVAM200669)
