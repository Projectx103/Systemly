const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: ['https://projectx103.github.io', 'http://localhost:3000', 'http://localhost:5500'],
  credentials: true
}));

// PostgreSQL connection
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

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.stack);
  } else {
    console.log('✅ Connected to Aiven PostgreSQL');
    release();
  }
});

// Create tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    // File transactions table (existing)
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

    // ✅ NEW: Offers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        listing_id VARCHAR(255) NOT NULL,
        listing_name VARCHAR(500) NOT NULL,
        seller_id VARCHAR(255) NOT NULL,
        seller_email VARCHAR(255) NOT NULL,
        buyer_id VARCHAR(255) NOT NULL,
        buyer_email VARCHAR(255) NOT NULL,
        buyer_name VARCHAR(255) NOT NULL,
        offer_amount DECIMAL(12, 2) NOT NULL,
        message TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ✅ NEW: Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        listing_id VARCHAR(255) NOT NULL,
        listing_name VARCHAR(500) NOT NULL,
        seller_id VARCHAR(255) NOT NULL,
        seller_email VARCHAR(255) NOT NULL,
        buyer_id VARCHAR(255) NOT NULL,
        buyer_email VARCHAR(255) NOT NULL,
        buyer_name VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables initialized (transactions, offers, messages)');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    client.release();
  }
}

initDatabase();

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    message: 'Systemly API - File Exchange, Offers & Messages',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      fileExchange: [
        'POST /api/upload',
        'GET /api/buyer/:buyer_name',
        'GET /api/seller/:seller_name',
        'POST /api/confirm/:id',
        'GET /api/download/:id'
      ],
      offers: [
        'POST /api/offers',
        'GET /api/offers/seller/:sellerId',
        'GET /api/offers/buyer/:buyerId',
        'PATCH /api/offers/:offerId',
        'DELETE /api/offers/:offerId'
      ],
      messages: [
        'POST /api/messages',
        'GET /api/messages/seller/:sellerId',
        'PATCH /api/messages/:messageId/read'
      ]
    }
  });
});

// ============================================
// FILE EXCHANGE ENDPOINTS (EXISTING)
// ============================================

// Upload file
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

    const fileBase64 = file.buffer.toString('base64');

    const result = await pool.query(
      `INSERT INTO transactions (seller_name, buyer_name, file_name, file_data, file_type, file_size, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id, seller_name, buyer_name, file_name, file_size, status, uploaded_at`,
      [seller_name, buyer_name, file.originalname, fileBase64, file.mimetype, file.size]
    );

    console.log(`✅ File uploaded: ${file.originalname}`);

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

// Get buyer transactions
app.get('/api/buyer/:buyer_name', async (req, res) => {
  try {
    const { buyer_name } = req.params;
    const result = await pool.query(
      `SELECT id, seller_name, buyer_name, file_name, file_type, file_size, status, uploaded_at, confirmed_at 
       FROM transactions 
       WHERE buyer_name = $1 
       ORDER BY uploaded_at DESC`,
      [buyer_name]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch buyer error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get seller transactions
app.get('/api/seller/:seller_name', async (req, res) => {
  try {
    const { seller_name } = req.params;
    const result = await pool.query(
      `SELECT id, seller_name, buyer_name, file_name, file_type, file_size, status, uploaded_at, confirmed_at 
       FROM transactions 
       WHERE seller_name = $1 
       ORDER BY uploaded_at DESC`,
      [seller_name]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch seller error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Confirm transaction
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

// Download file
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
    const fileBuffer = Buffer.from(transaction.file_data, 'base64');
    
    res.setHeader('Content-Disposition', `attachment; filename="${transaction.file_name}"`);
    res.setHeader('Content-Type', transaction.file_type || 'application/octet-stream');
    res.send(fileBuffer);
    
    console.log(`✅ File downloaded: ${transaction.file_name}`);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ============================================
// ✅ NEW: OFFERS ENDPOINTS
// ============================================

// Create new offer
app.post('/api/offers', async (req, res) => {
  try {
    const {
      listingId,
      listingName,
      sellerId,
      sellerEmail,
      buyerId,
      buyerEmail,
      buyerName,
      offerAmount,
      message
    } = req.body;

    // Validation
    if (!listingId || !sellerId || !buyerId || !offerAmount) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['listingId', 'sellerId', 'buyerId', 'offerAmount']
      });
    }

    const result = await pool.query(
      `INSERT INTO offers (
        listing_id, listing_name, seller_id, seller_email, 
        buyer_id, buyer_email, buyer_name, offer_amount, message, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *`,
      [
        listingId,
        listingName,
        sellerId,
        sellerEmail,
        buyerId,
        buyerEmail,
        buyerName,
        offerAmount,
        message || ''
      ]
    );

    console.log(`✅ Offer created: ${listingName} - ₱${offerAmount} from ${buyerName}`);

    res.status(201).json({
      success: true,
      message: 'Offer submitted successfully',
      offer: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error creating offer:', error);
    res.status(500).json({ 
      error: 'Failed to create offer',
      details: error.message 
    });
  }
});

// Get offers for a seller
app.get('/api/offers/seller/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { status } = req.query; // Optional filter by status

    let query = `
      SELECT * FROM offers 
      WHERE seller_id = $1
    `;
    const values = [sellerId];

    if (status) {
      query += ` AND status = $2`;
      values.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, values);

    console.log(`📊 Seller ${sellerId} has ${result.rows.length} offers`);

    res.json({
      success: true,
      count: result.rows.length,
      offers: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching seller offers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch offers',
      details: error.message 
    });
  }
});

// Get offers for a buyer
app.get('/api/offers/buyer/:buyerId', async (req, res) => {
  try {
    const { buyerId } = req.params;

    const result = await pool.query(
      `SELECT * FROM offers 
       WHERE buyer_id = $1
       ORDER BY created_at DESC`,
      [buyerId]
    );

    console.log(`📊 Buyer ${buyerId} has ${result.rows.length} offers`);

    res.json({
      success: true,
      count: result.rows.length,
      offers: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching buyer offers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch offers',
      details: error.message 
    });
  }
});

// Update offer status (accept/reject/counter)
app.patch('/api/offers/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { status, counterAmount } = req.body;

    if (!['accepted', 'rejected', 'countered'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        allowed: ['accepted', 'rejected', 'countered']
      });
    }

    let query = `
      UPDATE offers 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
    `;
    const values = [status];

    if (status === 'countered' && counterAmount) {
      query += `, offer_amount = $2`;
      values.push(counterAmount);
    }

    query += ` WHERE id = $${values.length + 1} RETURNING *`;
    values.push(offerId);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    console.log(`✅ Offer ${offerId} ${status}`);

    res.json({
      success: true,
      message: `Offer ${status}`,
      offer: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error updating offer:', error);
    res.status(500).json({ 
      error: 'Failed to update offer',
      details: error.message 
    });
  }
});

// Delete offer
app.delete('/api/offers/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;

    const result = await pool.query(
      'DELETE FROM offers WHERE id = $1 RETURNING *',
      [offerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    console.log(`🗑️ Offer ${offerId} deleted`);

    res.json({
      success: true,
      message: 'Offer deleted',
      offer: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error deleting offer:', error);
    res.status(500).json({ 
      error: 'Failed to delete offer',
      details: error.message 
    });
  }
});

// ============================================
// ✅ NEW: MESSAGES ENDPOINTS
// ============================================

// Send message
app.post('/api/messages', async (req, res) => {
  try {
    const {
      listingId,
      listingName,
      sellerId,
      sellerEmail,
      buyerId,
      buyerEmail,
      buyerName,
      subject,
      message
    } = req.body;

    if (!listingId || !sellerId || !buyerId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['listingId', 'sellerId', 'buyerId', 'message']
      });
    }

    const result = await pool.query(
      `INSERT INTO messages (
        listing_id, listing_name, seller_id, seller_email,
        buyer_id, buyer_email, buyer_name, subject, message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        listingId,
        listingName,
        sellerId,
        sellerEmail,
        buyerId,
        buyerEmail,
        buyerName,
        subject || 'Inquiry about listing',
        message
      ]
    );

    console.log(`✅ Message sent: ${subject} from ${buyerName}`);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

// Get messages for seller
app.get('/api/messages/seller/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;

    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE seller_id = $1
       ORDER BY created_at DESC`,
      [sellerId]
    );

    // Count unread messages
    const unreadCount = result.rows.filter(m => !m.is_read).length;

    console.log(`📬 Seller ${sellerId} has ${result.rows.length} messages (${unreadCount} unread)`);

    res.json({
      success: true,
      count: result.rows.length,
      unreadCount,
      messages: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ 
      error: 'Failed to fetch messages',
      details: error.message 
    });
  }
});

// Mark message as read
app.patch('/api/messages/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;

    const result = await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE id = $1 RETURNING *',
      [messageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    console.log(`✅ Message ${messageId} marked as read`);

    res.json({
      success: true,
      message: 'Message marked as read',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error updating message:', error);
    res.status(500).json({ 
      error: 'Failed to update message',
      details: error.message 
    });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Systemly API Server running on port ${PORT}`);
  console.log(`📦 File Exchange: ACTIVE`);
  console.log(`💰 Offers System: ACTIVE`);
  console.log(`📧 Messages System: ACTIVE`);
});
