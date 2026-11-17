/*
 * Jupiter site API (kubernetesproject2)
 *
 * Small Express API that sits behind nginx at /api.
 *   GET  /healthz                 -> liveness/readiness probe (always 200 while the process is up)
 *   GET  /api/health              -> { status, database: "connected" | "not configured" | "unreachable" }
 *   GET  /api/subscribers/count   -> { count }
 *   GET  /api/subscribers         -> latest 50 subscribers
 *   POST /api/subscribers {email} -> saves the email in MySQL
 *
 * MySQL is OPTIONAL:
 *   - DB_HOST not set  -> "not configured": the site works, subscribe returns 503 with a friendly message
 *   - DB_HOST set      -> connects (retrying in the background) and creates the table if needed
 *
 * STATIC_DIR (optional): also serve the website from this folder. Used only for running on a laptop
 * without Docker/nginx. In Docker/Kubernetes nginx serves the site and this is left unset.
 */
const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DB = {
  host: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'jupiter',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jupiter',
};

let pool = null;
let dbState = DB.host ? 'unreachable' : 'not configured';

async function connectWithRetry() {
  if (!DB.host) {
    console.log('[db] DB_HOST not set -> running WITHOUT MySQL (static mode)');
    return;
  }
  pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });
  for (;;) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      if (dbState !== 'connected') console.log(`[db] connected to mysql://${DB.host}:${DB.port}/${DB.database}`);
      dbState = 'connected';
    } catch (err) {
      if (dbState !== 'unreachable') console.log(`[db] lost connection: ${err.code || err.message}`);
      else console.log(`[db] waiting for MySQL at ${DB.host}:${DB.port} (${err.code || err.message})`);
      dbState = 'unreachable';
    }
    // keep checking so the status recovers if MySQL restarts
    await new Promise((r) => setTimeout(r, dbState === 'connected' ? 15000 : 3000));
  }
}

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: dbState }));

  function requireDb(_req, res, next) {
    if (dbState === 'connected') return next();
    const message = dbState === 'not configured'
      ? 'This site is running without MySQL, so emails are not saved.'
      : 'MySQL is configured but not reachable right now. Try again shortly.';
    return res.status(503).json({ database: dbState, message });
  }

  app.get('/api/subscribers/count', requireDb, async (_req, res) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM subscribers');
    res.json({ count: rows[0].count });
  });

  app.get('/api/subscribers', requireDb, async (_req, res) => {
    const [rows] = await pool.query('SELECT id, email, created_at FROM subscribers ORDER BY id DESC LIMIT 50');
    res.json(rows);
  });

  app.post('/api/subscribers', requireDb, async (req, res) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    try {
      await pool.query('INSERT INTO subscribers (email) VALUES (?)', [email]);
      res.status(201).json({ message: `Thanks! ${email} was saved in MySQL.` });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(200).json({ message: `${email} is already subscribed.` });
      console.error('[db] insert failed:', err.message);
      res.status(500).json({ message: 'Could not save your email.' });
    }
  });

  if (process.env.STATIC_DIR) {
    const dir = path.resolve(process.env.STATIC_DIR);
    console.log(`[web] also serving static site from ${dir}`);
    app.use(express.static(dir));
  }

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => console.log(`[api] listening on port ${PORT}`));
  connectWithRetry();
}

module.exports = { createApp };
