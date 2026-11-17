-- Runs once, the first time the MySQL data volume is created.
-- (The API also creates this table if it is missing, so this file is a safety net.)
CREATE DATABASE IF NOT EXISTS jupiter;
USE jupiter;

CREATE TABLE IF NOT EXISTS subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
