-- ============================================================
-- KiranaPilot Database Schema
-- Module 2: MySQL Database Integration
-- ============================================================

-- Create database
CREATE DATABASE IF NOT EXISTS kirana_pilot
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kirana_pilot;

-- ============================================================
-- Table: merchants
-- Core merchant/shopkeeper profile
-- ============================================================
CREATE TABLE IF NOT EXISTS merchants (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255)  NOT NULL,
  shop_name   VARCHAR(255)  NOT NULL,
  phone       VARCHAR(20)   NOT NULL,
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
  current_cash_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uk_merchants_phone (phone),
  INDEX   idx_merchants_shop_name (shop_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: customers
-- Customers linked to a specific merchant
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  merchant_id INT UNSIGNED  NOT NULL,
  name        VARCHAR(255)  NOT NULL,
  phone       VARCHAR(20)   NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uk_customers_merchant_phone (merchant_id, phone),
  INDEX   idx_customers_merchant_id (merchant_id),

  CONSTRAINT fk_customers_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: transactions
-- All financial transactions for a merchant
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  merchant_id       INT UNSIGNED  NOT NULL,
  customer_id       INT UNSIGNED  NULL,
  transaction_type  ENUM('CASH_SALE','CREDIT_SALE','KHATA_REPAYMENT','EXPENSE') NOT NULL,
  amount            DECIMAL(12,2) NOT NULL,
  description       VARCHAR(500)  NULL,
  transaction_date  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source            ENUM('MANUAL','VOICE','OCR') NOT NULL DEFAULT 'MANUAL',
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_transactions_merchant_id (merchant_id),
  INDEX idx_transactions_customer_id (customer_id),
  INDEX idx_transactions_type (transaction_type),
  INDEX idx_transactions_date (transaction_date),
  INDEX idx_transactions_source (source),

  CONSTRAINT fk_transactions_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_transactions_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: expenses
-- Recurring / one-time expenses for a merchant
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  merchant_id INT UNSIGNED  NOT NULL,
  description VARCHAR(500)  NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  due_date    DATE          NULL,
  status      ENUM('PENDING','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_expenses_merchant_id (merchant_id),
  INDEX idx_expenses_status (status),
  INDEX idx_expenses_due_date (due_date),

  CONSTRAINT fk_expenses_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: customer_payments
-- Payments received from customers (khata repayments, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_payments (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  merchant_id   INT UNSIGNED  NOT NULL,
  customer_id   INT UNSIGNED  NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  payment_date  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_customer_payments_merchant_id (merchant_id),
  INDEX idx_customer_payments_customer_id (customer_id),
  INDEX idx_customer_payments_date (payment_date),

  CONSTRAINT fk_customer_payments_merchant
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_customer_payments_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
