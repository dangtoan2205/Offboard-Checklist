require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/offboard_checklist',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Tránh crash khi DB ngắt kết nối (ví dụ: dừng Docker db) — chỉ log, pool sẽ tạo kết nối mới khi DB lại sẵn sàng
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = { pool };
