// 公司估值盲點掃描器 — API 伺服器
// 隱私原則：不寫入資料庫、不寫入檔案、不記錄請求內容（僅記錄路徑與狀態碼）。
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as engine from '../shared/engine.js';

const app = express();
const PORT = process.env.PORT || 8787;
const ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ORIGINS.includes('*') ? true : ORIGINS, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '20kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode}`));
  next();
});

const handle = (fn) => (req, res) => {
  try {
    res.json(fn(req.body || {}));
  } catch (err) {
    if (err instanceof engine.InputError) return res.status(400).json({ error: err.message, field: err.field });
    console.error(err.message);
    res.status(500).json({ error: '計算時發生錯誤，請稍後再試。' });
  }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/reference', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(engine.referenceData());
});
app.post('/api/scan', handle(engine.scan));
app.post('/api/compare', handle(engine.compare));
app.post('/api/diagnose', handle(engine.diagnose));
app.post('/api/exit', handle(engine.exitSim));
app.post('/api/buyers', handle(engine.buyerView));

// 選用：若已建置前端，同一服務一併提供靜態頁面（單一服務部署）
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: 'index.html' }));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
