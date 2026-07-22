-- Create database
CREATE DATABASE IF NOT EXISTS waafi_loan_system;
USE waafi_loan_system;

-- Users table (stores Waafi users)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    loan_limit DECIMAL(15,2) DEFAULT 50000.00,
    total_borrowed DECIMAL(15,2) DEFAULT 0.00,
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loans table (tracks all loans)
CREATE TABLE IF NOT EXISTS loans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    loan_reference VARCHAR(50) NOT NULL UNIQUE,
    amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) DEFAULT 5.00,
    total_repayable DECIMAL(15,2) NOT NULL,
    status ENUM('pending', 'approved', 'disbursed', 'repaid', 'defaulted') DEFAULT 'pending',
    disbursement_date TIMESTAMP NULL,
    due_date DATE NULL,
    repayment_date DATE NULL,
    waafi_transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Transactions table (logs all Waafi API calls)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    transaction_type ENUM('disbursement', 'repayment', 'verification', 'fee') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    waafi_reference VARCHAR(100),
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    response_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert test users
INSERT INTO users (phone_number, full_name, email, loan_limit) VALUES
('252611111111', 'Test User 1', 'test1@email.com', 50000.00),
('252622222222', 'Test User 2', 'test2@email.com', 75000.00),
('252633333333', 'Test User 3', 'test3@email.com', 100000.00);

-- Insert sample loans
INSERT INTO loans (user_id, loan_reference, amount, interest_rate, total_repayable, status, disbursement_date, due_date) VALUES
(1, 'LN-001-2025', 10000.00, 5.00, 10500.00, 'disbursed', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)),
(1, 'LN-002-2025', 5000.00, 5.00, 5250.00, 'repaid', NOW() - INTERVAL 15 DAY, DATE_ADD(NOW() - INTERVAL 15 DAY, INTERVAL 30 DAY));

SELECT * FROM users;
SELECT * FROM loans;
SELECT * FROM transactions;