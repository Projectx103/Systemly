const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow your GitHub Pages
app.use(cors({
  origin: ['https://projectx103.github.io', 'http://localhost:3000'],
  credentials: true
}));

// PostgreSQL connection with your Aiven credentials
const pool = new Pool({
  user: 'avnadmin',
  host: 'pg-27b3b54a-molinajefferson001-3f19.e.aivencloud.com',
  database: 'defaultdb',
  password: 'AVNS_TWjHVE9Oa2xzoAOjnwg',
  port: 15498,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.stack);
  } else {
    console.log('✅ Connected to Aiven PostgreSQL');
    release();
  }
});

// Create tables if they don't exist
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        seller_name VARCHAR(100) NOT NULL,
        buyer_name VARCHAR(100) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_data TEXT NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP
      )
    `);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    client.release();
  }
}

initDatabase();

// Configure multer for memory storage (no disk writes on Render)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    message: 'Systemly File Exchange API',
    timestamp: new Date().toISOString()
  });
});

// API Routes

// 1. Upload file (Seller) - Store file as base64 in database
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { seller_name, buyer_name } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!seller_name || !buyer_name) {
      return res.status(400).json({ error: 'Seller and buyer names are required' });
    }

    // Convert file buffer to base64 string for database storage
    const fileBase64 = file.buffer.toString('base64');

    const result = await pool.query(
      `INSERT INTO transactions (seller_name, buyer_name, file_name, file_data, file_type, file_size, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id, seller_name, buyer_name, file_name, file_size, status, uploaded_at`,
      [seller_name, buyer_name, file.originalname, fileBase64, file.mimetype, file.size]
    );

    console.log(`✅ File uploaded: ${file.originalname} by ${seller_name} for ${buyer_name}`);

    res.json({
      success: true,
      transaction: result.rows[0],
      message: 'File uploaded successfully. Buyer notified.'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// 2. Get transactions for buyer
app.get('/api/buyer/:buyer_name', async (req, res) => {
  try {
    const { buyer_name } = req.params;
    
    // Don't return file_data in list view to reduce payload size
    const result = await pool.query(
      `SELECT id, seller_name, buyer_name, file_name, file_type, file_size, status, uploaded_at, confirmed_at 
       FROM transactions 
       WHERE buyer_name = $1 
       ORDER BY uploaded_at DESC`,
      [buyer_name]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch buyer transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// 3. Get transactions for seller
app.get('/api/seller/:seller_name', async (req, res) => {
  try {
    const { seller_name } = req.params;
    
    // Don't return file_data in list view
    const result = await pool.query(
      `SELECT id, seller_name, buyer_name, file_name, file_type, file_size, status, uploaded_at, confirmed_at 
       FROM transactions 
       WHERE seller_name = $1 
       ORDER BY uploaded_at DESC`,
      [seller_name]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch seller transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// 4. Confirm transaction (Buyer)
app.post('/api/confirm/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE transactions 
       SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING id, seller_name, buyer_name, file_name, status, confirmed_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log(`✅ Transaction ${id} confirmed`);

    res.json({
      success: true,
      transaction: result.rows[0],
      message: 'Transaction confirmed successfully'
    });
  } catch (error) {
    console.error('Confirmation error:', error);
    res.status(500).json({ error: 'Confirmation failed' });
  }
});

// 5. Download file - Return base64 file data
app.get('/api/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT file_name, file_data, file_type FROM transactions WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const transaction = result.rows[0];
    
    // Convert base64 back to buffer
    const fileBuffer = Buffer.from(transaction.file_data, 'base64');
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${transaction.file_name}"`);
    res.setHeader('Content-Type', transaction.file_type || 'application/octet-stream');
    res.send(fileBuffer);
    
    console.log(`✅ File downloaded: ${transaction.file_name}`);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// 6. Get file info (without downloading)
app.get('/api/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, seller_name, buyer_name, file_name, file_type, file_size, status, uploaded_at, confirmed_at FROM transactions WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});