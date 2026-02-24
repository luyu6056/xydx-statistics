import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'game_stats.db');
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    game_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    dau INTEGER NOT NULL,
    new_users INTEGER NOT NULL,
    revenue REAL NOT NULL,
    retention_1d REAL NOT NULL,
    retention_7d REAL NOT NULL,
    retention_30d REAL NOT NULL
  );
`);

// Seed Data if empty
const count = db.prepare('SELECT count(*) as count FROM daily_stats').get() as { count: number };
if (count.count === 0) {
  console.log('Seeding database...');
  const insert = db.prepare(`
    INSERT INTO daily_stats (date, game_id, channel_id, server_id, dau, new_users, revenue, retention_1d, retention_7d, retention_30d)
    VALUES (@date, @game_id, @channel_id, @server_id, @dau, @new_users, @revenue, @retention_1d, @retention_7d, @retention_30d)
  `);

  const games = ['RPG_Legends'];
  const channels = ['AppStore', 'GooglePlay', 'TapTap'];
  const servers = ['S1', 'S2', 'S3', 'S4'];
  const today = new Date();

  const transaction = db.transaction(() => {
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      games.forEach(game => {
        channels.forEach(channel => {
          servers.forEach(server => {
            // Generate somewhat realistic random data
            const baseUsers = 1000 + Math.random() * 500;
            const dau = Math.floor(baseUsers * (Math.random() * 0.5 + 0.8));
            const new_users = Math.floor(dau * 0.15);
            const revenue = dau * (Math.random() * 2 + 0.5); // ARPU 0.5 - 2.5
            const retention_1d = 0.35 + Math.random() * 0.1;
            const retention_7d = 0.15 + Math.random() * 0.05;
            const retention_30d = 0.05 + Math.random() * 0.03;

            insert.run({
              date: dateStr,
              game_id: game,
              channel_id: channel,
              server_id: server,
              dau,
              new_users,
              revenue: parseFloat(revenue.toFixed(2)),
              retention_1d: parseFloat(retention_1d.toFixed(4)),
              retention_7d: parseFloat(retention_7d.toFixed(4)),
              retention_30d: parseFloat(retention_30d.toFixed(4)),
            });
          });
        });
      });
    }
  });
  transaction();
  console.log('Database seeded!');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/meta', (req, res) => {
    try {
      const channels = db.prepare('SELECT DISTINCT channel_id FROM daily_stats').all().map((r: any) => r.channel_id);
      const servers = db.prepare('SELECT DISTINCT server_id FROM daily_stats').all().map((r: any) => r.server_id);
      res.json({ channels, servers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  });

  app.get('/api/stats', (req, res) => {
    try {
      const { startDate, endDate, channels, servers } = req.query;
      
      let query = `
        SELECT 
          date,
          SUM(dau) as dau,
          SUM(new_users) as new_users,
          SUM(revenue) as revenue,
          AVG(retention_1d) as retention_1d,
          AVG(retention_7d) as retention_7d
        FROM daily_stats
        WHERE 1=1
      `;
      
      const params: any[] = [];

      if (startDate) {
        query += ` AND date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND date <= ?`;
        params.push(endDate);
      }
      
      if (channels) {
        const channelList = (channels as string).split(',');
        query += ` AND channel_id IN (${channelList.map(() => '?').join(',')})`;
        params.push(...channelList);
      }

      if (servers) {
        const serverList = (servers as string).split(',');
        query += ` AND server_id IN (${serverList.map(() => '?').join(',')})`;
        params.push(...serverList);
      }

      query += ` GROUP BY date ORDER BY date ASC`;

      const results = db.prepare(query).all(...params);
      res.json(results);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  app.get('/api/summary', (req, res) => {
    try {
      const { startDate, endDate, channels, servers } = req.query;
      
      let query = `
        SELECT 
          SUM(dau) as total_dau_volume, -- This is just volume, usually we want avg DAU or unique users, but for simple aggregation volume is ok for "Total Activity"
          AVG(dau) as avg_dau,
          SUM(new_users) as total_new_users,
          SUM(revenue) as total_revenue,
          AVG(retention_1d) as avg_retention_1d
        FROM daily_stats
        WHERE 1=1
      `;
      
      const params: any[] = [];

      if (startDate) {
        query += ` AND date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND date <= ?`;
        params.push(endDate);
      }
      
      if (channels) {
        const channelList = (channels as string).split(',');
        query += ` AND channel_id IN (${channelList.map(() => '?').join(',')})`;
        params.push(...channelList);
      }

      if (servers) {
        const serverList = (servers as string).split(',');
        query += ` AND server_id IN (${serverList.map(() => '?').join(',')})`;
        params.push(...serverList);
      }

      const result = db.prepare(query).get(...params);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
