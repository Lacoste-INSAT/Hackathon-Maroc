// ─────────────────────────────────────────────────────────────
// TabibNet — Express Server Entry Point
// ─────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb } from './db/pool';
import { auditMiddleware } from './middleware/audit';

// Routes
import authRoutes from './routes/auth';
import doctorRoutes from './routes/doctors';
import appointmentRoutes from './routes/appointments';
import doctorPanelRoutes from './routes/doctorPanel';

const app = express();

// ── Middleware ───────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(auditMiddleware);

// ── Routes ──────────────────────────────────────────────────

app.use('/auth', authRoutes);
app.use('/doctors', doctorRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/doctor', doctorPanelRoutes);

// ── Health Check ────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tabibnet-api', timestamp: new Date().toISOString() });
});

// ── Start ───────────────────────────────────────────────────

async function main() {
  await initDb();
  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`🏥 TabibNet API running on port ${config.PORT}`);
    console.log(`   Frontend URL: ${config.FRONTEND_URL}`);
  });
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
