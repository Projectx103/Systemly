const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: ['https://projectx103.github.io', 'http://localhost:3000'],
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
    // Original transactions table
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

    // NEW: Offer files table for admin review system
    await client.query(`
      CREATE TABLE IF NOT EXISTS offer_files (
        id SERIAL PRIMARY KEY,
        offer_id VARCHAR(100) NOT NULL,
        listing_id VARCHAR(100) NOT NULL,
        seller_id VARCHAR(100) NOT NULL,
        seller_name VARCHAR(255) NOT NULL,
        buyer_id VARCHAR(100) NOT NULL,
        buyer_name VARCHAR(255) NOT NULL,
        buyer_email VARCHAR(255),
        listing_name VARCHAR(255),
        offer_amount NUMERIC,
        instructions TEXT,
        whats_included TEXT,
        file_name VARCHAR(255) NOT NULL,
        file_data TEXT NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        status VARCHAR(50) DEFAULT 'pending-admin-review',
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP
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

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for offer files
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    message: 'Systemly File Exchange API',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ORIGINAL ENDPOINTS (Storagetest.html)
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
// NEW ENDPOINTS (Offer File Management)
// ============================================

// Upload files for accepted offers
app.post('/api/upload-offer-files', upload.array('files', 10), async (req, res) => {
  try {
    const {
      offerId,
      listingId,
      sellerId,
      sellerName,
      buyerId,
      buyerName,
      buyerEmail,
      listingName,
      offerAmount,
      instructions,
      whatsIncluded
    } = req.body;

    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`📤 Uploading ${files.length} files for offer ${offerId}`);

    // Store each file in database
    const fileRecords = [];
    
    for (const file of files) {
      const fileBase64 = file.buffer.toString('base64');
      
      const result = await pool.query(
        `INSERT INTO offer_files (
          offer_id, listing_id, seller_id, buyer_id, 
          file_name, file_data, file_type, file_size,
          seller_name, buyer_name, buyer_email, listing_name,
          offer_amount, instructions, whats_included,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending-admin-review') 
        RETURNING id, file_name, file_size`,
        [
          offerId, listingId, sellerId, buyerId,
          file.originalname, fileBase64, file.mimetype, file.size,
          sellerName, buyerName, buyerEmail, listingName,
          offerAmount, instructions, whatsIncluded
        ]
      );
      
      fileRecords.push(result.rows[0]);
    }

    console.log(`✅ ${files.length} files uploaded successfully for offer ${offerId}`);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      fileCount: files.length,
      files: fileRecords
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Upload failed: ' + error.message 
    });
  }
});

// Admin: Get file reviews
app.get('/api/admin/file-reviews', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (offer_id)
        offer_id as id, listing_id, seller_id, seller_name,
        buyer_id, buyer_name, buyer_email, listing_name,
        offer_amount, instructions, whats_included,
        status, created_at as uploaded_at,
        (SELECT COUNT(*) FROM offer_files of2 WHERE of2.offer_id = offer_files.offer_id) as file_count
      FROM offer_files
      ORDER BY offer_id, created_at DESC`
    );

    const reviews = result.rows.map(row => ({
      id: row.id,
      listingId: row.listing_id,
      listingName: row.listing_name,
      sellerId: row.seller_id,
      sellerName: row.seller_name,
      buyerId: row.buyer_id,
      buyerName: row.buyer_name,
      buyerEmail: row.buyer_email,
      offerAmount: row.offer_amount,
      instructions: row.instructions,
      whatsIncluded: row.whats_included,
      status: row.status,
      uploadedAt: row.uploaded_at,
      fileCount: parseInt(row.file_count)
    }));
    
    console.log(`📊 Retrieved ${reviews.length} file review submissions`);

    res.json({
      success: true,
      reviews: reviews
    });

  } catch (error) {
    console.error('Error fetching file reviews:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch file reviews' 
    });
  }
});

// Admin: Get file details for review
app.get('/api/admin/file-review/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    const result = await pool.query(
      `SELECT file_name, file_size, file_type, created_at
       FROM offer_files
       WHERE offer_id = $1
       ORDER BY created_at ASC`,
      [offerId]
    );

    res.json({
      success: true,
      files: result.rows.map(row => ({
        filename: row.file_name,
        size: row.file_size,
        type: row.file_type,
        uploadedAt: row.created_at
      }))
    });

  } catch (error) {
    console.error('Error fetching file details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch file details' 
    });
  }
});




// Admin: View file content (for preview)
app.get('/api/admin/view-file/:offerId/:filename', async (req, res) => {
  try {
    const { offerId, filename } = req.params;
    
    const result = await pool.query(
      `SELECT file_name, file_data, file_type
       FROM offer_files
       WHERE offer_id = $1 AND file_name = $2
       LIMIT 1`,
      [offerId, filename]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];
    
    // Return file data as JSON for preview
    res.json({
      success: true,
      filename: file.file_name,
      type: file.file_type,
      data: file.file_data, // Base64 data
      size: Buffer.from(file.file_data, 'base64').length
    });
    
    console.log(`👁️ Admin previewing: ${file.file_name}`);

  } catch (error) {
    console.error('View file error:', error);
    res.status(500).json({ error: 'Failed to load file' });
  }
});












// Admin: Download file
app.get('/api/admin/download-file/:offerId/:filename', async (req, res) => {
  try {
    const { offerId, filename } = req.params;
    
    const result = await pool.query(
      `SELECT file_name, file_data, file_type
       FROM offer_files
       WHERE offer_id = $1 AND file_name = $2
       LIMIT 1`,
      [offerId, filename]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];
    const fileBuffer = Buffer.from(file.file_data, 'base64');
    
    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.send(fileBuffer);
    
    console.log(`✅ Admin downloaded: ${file.file_name}`);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Admin: Approve files
app.post('/api/admin/approve-files/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    // Update all files for this offer
    await pool.query(
      `UPDATE offer_files 
       SET status = 'admin-approved', 
           approved_at = CURRENT_TIMESTAMP
       WHERE offer_id = $1`,
      [offerId]
    );

    console.log(`✅ Admin approved files for offer ${offerId}`);

    res.json({
      success: true,
      message: 'Files approved successfully'
    });

  } catch (error) {
    console.error('Error approving files:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to approve files' 
    });
  }
});

// Admin: Reject files
app.post('/api/admin/reject-files/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { reason } = req.body;
    
    // Update all files for this offer
    await pool.query(
      `UPDATE offer_files 
       SET status = 'admin-rejected', 
           rejected_at = CURRENT_TIMESTAMP,
           rejection_reason = $2
       WHERE offer_id = $1`,
      [offerId, reason || 'No reason provided']
    );

    console.log(`❌ Admin rejected files for offer ${offerId}`);

    res.json({
      success: true,
      message: 'Files rejected'
    });

  } catch (error) {
    console.error('Error rejecting files:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reject files' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Original file exchange: /api/upload`);
  console.log(`📤 Offer file upload: /api/upload-offer-files`);
  console.log(`👨‍💼 Admin file reviews: /api/admin/file-reviews`);
});

