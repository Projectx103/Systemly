const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "systemly-db",
      private_key_id: "50cced1e129b6c21cce4cc83d04e5b0b0ed5880b",
      private_key: `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCcs/JWDtXIQk3s
4SrdT32OJR3gxL0zPkFl6A5qcoo6aOw6wn5iGH0bXl5F4Av8srkKfm+R73gfKQyI
VLMKtQEIpxhU5LHrp5KSRT8g5r7HTn2U+7eZhGhfz9sub/z9Wn4Z6+ajHUpAABE/
lem+YvpswCfdXqFaKF9WnOx62Z9GKdHrCkEj3waAFEkwa56NvwDn/oLdIiia6x7g
i2iuXS7pSEfHGtd49TqwzjwtvytaUanyDBW/pHvZqJ6ciXPJDpvSv7+S5C8b0B6g
UspGQkQ2VxmtAPezUHHGL1poaAdGnNnBr3SzoGJSfwpQecJYTgtfwvgiMaOu3HUm
fjgP6ULzAgMBAAECggEAL90/Hk41uo+WIc69OxA2t55au/ccG3TeoPP6w0TtN94o
meIinHACdsOiZBGFV9B3eN8Z0SemN05gh5vnfFPBVxVC91tLhUGQIaGJINGaYGJ3
NXSVpgytnOZueoa2beSgM+a8cgJWVaovmo598StmdqVTB+kJu/Is/NW93eBvKAzP
uFSbTmYgFuWlmr2Qy9o+7VzB3jpFloylSutGLMJvjx/6BcCeaLa8YGAVzil/Z1Dr
j2bKDosubUIitBhKhE6ND71aG6N4kDoVxC0MUuKAJwMwaqWq48H3RTHe/Mli+jxa
IYU1rqB2VaUewdM2p9OC1+WdYtL3MdqjVoivln6VsQKBgQDIovLPFqcuCPGoSUmd
ebmF0PizJuRBb/3GlOYUNKyO4/Hj1CHhDN7DlNV77OI1dUGsIZ3ywsvwka8CoF6M
ryNqnCPe/xrq7ubeoK+uC0mLj1bDtvnNlt76DM30SPHfaMnuHcP0VhRKg8VScp/+
WmGfWOQdo5Wp5gwMPQdn3PZHtwKBgQDH8YJjNEGB5ljsCwcngJUV6ZORn7t2dwqO
S0fOeiR8Fz9OKTaMxbHh9Kdp9BcGnJlHCXZhH2j9jbDRVe4ZMutakUyxYAYV9jGU
77fFJD+omKKuIIKhaNSq6hcLV371DMQoabCH9sBiuJu8oy1r99wR2ZfpgK0wVGPL
cfFMxPdGpQKBgQCUA4JVPEUBNR/yIn7oadBv5AZVRC/IBrKVOWuzJFjY4Vil1u1X
dYMxji8gSVVoUqSsM/CuEv8Y7qDJsz2NU/cwwxfDfzeAcdZoDusL3s/W4VwE7ovD
G7ZLif62ZMnrIwc1X0gcjRRTFHsRo/ZcUpkKUS2YoAHdYRUqQiugd+ZIaQKBgQC2
EYfoCke0oCtNFmW3ZPFdeMs2CjxMje4A0TBcJwFeNlUhOYpA+i0XUw+3/duR27v/
4e/4VP/oE8R1e0hLjgCfAjzSMFyaVwujUf8H+BA32HYbFeOeU7WExZGidFRZlPxy
yHtF9D4QJ4c5aWYNMTEm1/vrV49duRr+wY03mQyLOQKBgQCoOSNo3NZTPpMr91y0
FiVk096O8+U87rCFft2gYIQfvWxnw7QqQCJtihOcUjK1J0eQBlrcl8cJps3+hbxD
0I5TEW6jnpl1m2ZF6Ip7oOVoj1HejB/uj4HI07W9gB3sHiq+T9DhpKZKkEGP1E0d
FpmuPdbG4Pgc67bsOs/BXTx+xQ==
-----END PRIVATE KEY-----`,
      client_email: "firebase-adminsdk-fbsvc@systemly-db.iam.gserviceaccount.com",
      client_id: "117556834623041686298",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40systemly-db.iam.gserviceaccount.com",
      universe_domain: "googleapis.com"
    }),
    databaseURL: "https://systemly-db.firebaseio.com"
  });

  console.log('✅ Firebase Admin initialized');
}


// ============================================
// TIMEOUT CONFIGURATION
// ============================================
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});

// CORS configuration - REPLACE THE EXISTING ONE
app.use(cors({
  origin: '*', // Allow all origins for now (can restrict later)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add OPTIONS handler for preflight requests
app.options('*', cors());

// PostgreSQL connection
const pool = new Pool({
  user: 'avnadmin',
  host: 'pg-27b3b54a-molinajefferson001-3f19.e.aivencloud.com',
  database: 'defaultdb',
  password: 'AVNS_TWjHVE9Oa2xzoAOjnwg',
  port: 15498,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  query_timeout: 30000
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

// ============================================
// MULTER CONFIGURATION
// ============================================
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 10 // Max 10 files
  }
});

// ============================================
// BODY PARSER CONFIGURATION
// ============================================
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

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
// OFFER FILE UPLOAD ENDPOINT
// ============================================
app.post('/api/upload-offer-files', upload.array('files', 10), async (req, res) => {
  console.log('📥 Received upload request');
  console.log('📦 Body keys:', Object.keys(req.body));
  console.log('📁 Files count:', req.files ? req.files.length : 0);
  
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

    if (!offerId) {
      console.error('❌ Missing offerId');
      return res.status(400).json({ success: false, error: 'offerId is required' });
    }

    const files = req.files;

    if (!files || files.length === 0) {
      console.error('❌ No files in request');
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    console.log(`📤 Processing ${files.length} files for offer ${offerId}`);

    const client = await pool.connect();
    const fileRecords = [];
    
    try {
      await client.query('BEGIN');
      
      for (const file of files) {
        console.log(`  📄 Processing: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        const fileBase64 = file.buffer.toString('base64');
        
        const result = await client.query(
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
        console.log(`  ✅ Saved: ${file.originalname}`);
      }
      
      await client.query('COMMIT');
      console.log(`✅ All ${files.length} files uploaded successfully for offer ${offerId}`);

      res.json({
        success: true,
        message: 'Files uploaded successfully',
        fileCount: files.length,
        files: fileRecords
      });
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Upload error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Upload failed: ' + error.message 
    });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Admin: Get all file reviews
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

// Admin: Get files for specific offer
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

// Admin: View file content
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
    
    res.json({
      success: true,
      filename: file.file_name,
      type: file.file_type,
      data: file.file_data,
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
    
    console.log(`🔍 Attempting to approve offer ${offerId}`);
    
    // Update PostgreSQL
    await pool.query(
      `UPDATE offer_files 
       SET status = 'admin-approved', 
           approved_at = CURRENT_TIMESTAMP
       WHERE offer_id = $1`,
      [offerId]
    );

    // Update Firebase
    const db = admin.firestore();
    const offerRef = db.collection('offers').doc(offerId);
    
    // Check if offer exists
    const offerDoc = await offerRef.get();
    if (!offerDoc.exists) {
      console.error(`❌ Offer ${offerId} not found in Firestore`);
      return res.status(404).json({ 
        success: false,
        error: 'Offer not found in database' 
      });
    }
    
    // Update the offer with admin approval
    await offerRef.update({
      status: 'admin-approved',
      adminApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
      filesApproved: true
    });

    console.log(`✅ Admin approved files for offer ${offerId} (PostgreSQL + Firebase updated)`);

    res.json({
      success: true,
      message: 'Files approved successfully. Buyer will be notified to complete payment.'
    });

  } catch (error) {
    console.error('❌ Error approving files:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to approve files: ' + error.message 
    });
  }
});

// Admin: Reject files
app.post('/api/admin/reject-files/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { reason } = req.body;
    
    console.log(`🔍 Attempting to reject offer ${offerId}`);
    console.log(`📝 Rejection reason: ${reason}`);
    
    // Update PostgreSQL
    await pool.query(
      `UPDATE offer_files 
       SET status = 'admin-rejected', 
           rejected_at = CURRENT_TIMESTAMP,
           rejection_reason = $2
       WHERE offer_id = $1`,
      [offerId, reason || 'No reason provided']
    );

    // Update Firebase
    const db = admin.firestore();
    const offerRef = db.collection('offers').doc(offerId);
    
    // Check if offer exists
    const offerDoc = await offerRef.get();
    if (!offerDoc.exists) {
      console.error(`❌ Offer ${offerId} not found in Firestore`);
      return res.status(404).json({ 
        success: false,
        error: 'Offer not found in database' 
      });
    }
    
    // Update the offer with admin rejection
    await offerRef.update({
      status: 'admin-rejected',
      rejectionReason: reason || 'No reason provided',
      adminRejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      filesRejected: true,
      filesUploadedAt: null
    });

    console.log(`✅ Admin rejected files for offer ${offerId} (PostgreSQL + Firebase updated)`);

    res.json({
      success: true,
      message: 'Files rejected successfully. Seller can re-upload.'
    });

  } catch (error) {
    console.error('❌ Error rejecting files:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reject files: ' + error.message 
    });
  }
});

// Get file review by offer ID
app.get('/api/file-reviews/offer/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    console.log(`🔍 Looking for file review for offer: ${offerId}`);
    
    const result = await pool.query(
      `SELECT DISTINCT ON (offer_id)
        offer_id as id, 
        listing_id, 
        seller_id, 
        seller_name,
        buyer_id, 
        buyer_name, 
        buyer_email, 
        listing_name,
        offer_amount, 
        instructions, 
        whats_included,
        status, 
        created_at,
        (SELECT COUNT(*) FROM offer_files of2 WHERE of2.offer_id = offer_files.offer_id) as file_count
      FROM offer_files
      WHERE offer_id = $1
      ORDER BY offer_id, created_at DESC
      LIMIT 1`,
      [offerId]
    );

    if (result.rows.length === 0) {
      console.log(`ℹ️ No file review found for offer ${offerId}`);
      return res.json({ success: true, review: null });
    }
    
    const review = result.rows[0];
    
    console.log(`✅ Found file review for offer ${offerId}: status=${review.status}`);
    
    res.json({ 
      success: true, 
      review: {
        id: review.id,
        listingId: review.listing_id,
        listingName: review.listing_name,
        sellerId: review.seller_id,
        sellerName: review.seller_name,
        buyerId: review.buyer_id,
        buyerName: review.buyer_name,
        buyerEmail: review.buyer_email,
        offerAmount: review.offer_amount,
        instructions: review.instructions,
        whatsIncluded: review.whats_included,
        status: review.status,
        uploadedAt: review.created_at,
        fileCount: parseInt(review.file_count)
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting file review by offer:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// NEW: INVOICE PAYMENT WEBHOOK/ENDPOINT
// ============================================

// Update offer status when invoice is paid
app.post('/api/update-offer-payment/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { invoiceId, invoiceNumber } = req.body;
    
    console.log(`💰 Received payment update for offer ${offerId}`);
    console.log(`📋 Invoice: ${invoiceNumber} (ID: ${invoiceId})`);
    
    const db = admin.firestore();
    
    // Verify invoice exists and is paid
    const invoiceRef = db.collection('invoices').doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();
    
    if (!invoiceDoc.exists) {
      console.error(`❌ Invoice ${invoiceId} not found`);
      return res.status(404).json({ 
        success: false,
        error: 'Invoice not found' 
      });
    }
    
    const invoiceData = invoiceDoc.data();
    
    if (invoiceData.status !== 'paid') {
      console.error(`❌ Invoice ${invoiceId} is not paid (status: ${invoiceData.status})`);
      return res.status(400).json({ 
        success: false,
        error: 'Invoice is not marked as paid' 
      });
    }
    
    // Verify invoice is for this offer
    if (invoiceData.offerId !== offerId) {
      console.error(`❌ Invoice ${invoiceId} is not for offer ${offerId}`);
      return res.status(400).json({ 
        success: false,
        error: 'Invoice does not match offer' 
      });
    }
    
    // Update offer status to 'paid'
    const offerRef = db.collection('offers').doc(offerId);
    const offerDoc = await offerRef.get();
    
    if (!offerDoc.exists) {
      console.error(`❌ Offer ${offerId} not found`);
      return res.status(404).json({ 
        success: false,
        error: 'Offer not found' 
      });
    }
    
    await offerRef.update({
      status: 'paid',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      invoiceId: invoiceId,
      invoiceNumber: invoiceNumber
    });
    
    console.log(`✅ Offer ${offerId} status updated to 'paid'`);
    console.log(`💳 Payment confirmed via invoice ${invoiceNumber}`);
    
    res.json({
      success: true,
      message: 'Offer payment status updated successfully',
      offerId: offerId,
      status: 'paid'
    });
    
  } catch (error) {
    console.error('❌ Error updating offer payment status:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update payment status: ' + error.message 
    });
  }
});

// Check invoice status for an offer
app.get('/api/check-invoice-status/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    console.log(`🔍 Checking invoice status for offer ${offerId}`);
    
    const db = admin.firestore();
    
    // Find invoice for this offer
    const invoicesRef = db.collection('invoices');
    const querySnapshot = await invoicesRef.where('offerId', '==', offerId).get();
    
    if (querySnapshot.empty) {
      console.log(`ℹ️ No invoice found for offer ${offerId}`);
      return res.json({
        success: true,
        hasInvoice: false,
        invoice: null
      });
    }
    
    const invoiceDoc = querySnapshot.docs[0];
    const invoiceData = invoiceDoc.data();
    
    console.log(`📋 Found invoice ${invoiceData.invoiceNumber}: status=${invoiceData.status}`);
    
    res.json({
      success: true,
      hasInvoice: true,
      invoice: {
        id: invoiceDoc.id,
        invoiceNumber: invoiceData.invoiceNumber,
        status: invoiceData.status,
        amount: invoiceData.amount,
        createdAt: invoiceData.createdAt,
        paidAt: invoiceData.paidAt || null
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking invoice status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check invoice status: ' + error.message 
    });
  }
});

// Webhook endpoint for automatic invoice payment updates
app.post('/api/webhook/invoice-paid', async (req, res) => {
  try {
    const { invoiceId, offerId, invoiceNumber, amount, paidAt } = req.body;
    
    console.log(`🔔 Webhook received: Invoice ${invoiceNumber} paid`);
    console.log(`💰 Amount: ${amount}, Offer ID: ${offerId}`);
    
    if (!invoiceId || !offerId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: invoiceId and offerId' 
      });
    }
    
    const db = admin.firestore();
    
    // Update offer status
    const offerRef = db.collection('offers').doc(offerId);
    await offerRef.update({
      status: 'paid',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      invoiceId: invoiceId,
      invoiceNumber: invoiceNumber,
      paidAmount: amount
    });
    
    console.log(`✅ Webhook processed: Offer ${offerId} marked as paid`);
    
    res.json({
      success: true,
      message: 'Payment webhook processed successfully'
    });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Webhook processing failed: ' + error.message 
    });
  }
});




// ============================================
// BUYER ENDPOINTS - Add these before "START SERVER"
// ============================================

// Buyer: Get file review by offer ID (same as general endpoint but for clarity)
app.get('/api/buyer/file-reviews/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    console.log(`🔍 [BUYER] Looking for file review for offer: ${offerId}`);
    
    const result = await pool.query(
      `SELECT DISTINCT ON (offer_id)
        offer_id as id, 
        listing_id, 
        seller_id, 
        seller_name,
        buyer_id, 
        buyer_name, 
        buyer_email, 
        listing_name,
        offer_amount, 
        instructions, 
        whats_included,
        status, 
        created_at,
        (SELECT COUNT(*) FROM offer_files of2 WHERE of2.offer_id = offer_files.offer_id) as file_count
      FROM offer_files
      WHERE offer_id = $1
      ORDER BY offer_id, created_at DESC
      LIMIT 1`,
      [offerId]
    );

    if (result.rows.length === 0) {
      console.log(`ℹ️ No file review found for offer ${offerId}`);
      return res.json({ success: true, review: null });
    }
    
    const review = result.rows[0];
    
    console.log(`✅ Found file review for offer ${offerId}: status=${review.status}`);
    
    res.json({ 
      success: true, 
      review: {
        id: review.id,
        listingId: review.listing_id,
        listingName: review.listing_name,
        sellerId: review.seller_id,
        sellerName: review.seller_name,
        buyerId: review.buyer_id,
        buyerName: review.buyer_name,
        buyerEmail: review.buyer_email,
        offerAmount: review.offer_amount,
        instructions: review.instructions,
        whatsIncluded: review.whats_included,
        status: review.status,
        uploadedAt: review.created_at,
        fileCount: parseInt(review.file_count)
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting buyer file review:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Buyer: Get list of files for a specific file review
app.get('/api/buyer/file-reviews/:fileReviewId/files', async (req, res) => {
  try {
    const { fileReviewId } = req.params;
    
    console.log(`📁 [BUYER] Getting files for review: ${fileReviewId}`);
    
    const result = await pool.query(
      `SELECT file_name, file_size, file_type, created_at, instructions, whats_included, status
       FROM offer_files
       WHERE offer_id = $1
       ORDER BY created_at ASC`,
      [fileReviewId]
    );

    if (result.rows.length === 0) {
      console.log(`ℹ️ No files found for review ${fileReviewId}`);
      return res.json({
        success: false,
        error: 'No files found for this review'
      });
    }

    const firstRow = result.rows[0];
    
    res.json({
      success: true,
      files: result.rows.map(row => ({
        filename: row.file_name,
        size: row.file_size,
        type: row.file_type,
        uploadedAt: row.created_at
      })),
      instructions: firstRow.instructions,
      whatsIncluded: firstRow.whats_included,
      status: firstRow.status
    });

    console.log(`✅ [BUYER] Returned ${result.rows.length} files`);

  } catch (error) {
    console.error('❌ Error fetching buyer files:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch files: ' + error.message 
    });
  }
});

// Buyer: View single file content
app.get('/api/buyer/file-reviews/:fileReviewId/view/:filename', async (req, res) => {
  try {
    const { fileReviewId, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    
    console.log(`👁️ [BUYER] Viewing file: ${decodedFilename} from review ${fileReviewId}`);
    
    const result = await pool.query(
      `SELECT file_name, file_data, file_type, file_size, status
       FROM offer_files
       WHERE offer_id = $1 AND file_name = $2
       LIMIT 1`,
      [fileReviewId, decodedFilename]
    );

    if (result.rows.length === 0) {
      console.log(`❌ File not found: ${decodedFilename}`);
      return res.status(404).json({ 
        success: false,
        error: 'File not found' 
      });
    }

    const file = result.rows[0];
    
    // Check if files are approved or paid
    if (file.status !== 'admin-approved' && file.status !== 'paid') {
      console.log(`⚠️ Files not yet approved for review ${fileReviewId}`);
      return res.status(403).json({ 
        success: false,
        error: 'Files are not yet approved for viewing' 
      });
    }
    
    res.json({
      success: true,
      filename: file.file_name,
      type: file.file_type,
      data: file.file_data,
      size: file.file_size
    });
    
    console.log(`✅ [BUYER] File content sent: ${file.file_name}`);

  } catch (error) {
    console.error('❌ Error viewing buyer file:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load file: ' + error.message 
    });
  }
});

// Buyer: Download single file
app.get('/api/buyer/file-reviews/:fileReviewId/download/:filename', async (req, res) => {
  try {
    const { fileReviewId, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    
    console.log(`📥 [BUYER] Downloading: ${decodedFilename} from review ${fileReviewId}`);
    
    const result = await pool.query(
      `SELECT file_name, file_data, file_type, status
       FROM offer_files
       WHERE offer_id = $1 AND file_name = $2
       LIMIT 1`,
      [fileReviewId, decodedFilename]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'File not found' 
      });
    }

    const file = result.rows[0];
    
    // Check if files are approved or paid
    if (file.status !== 'admin-approved' && file.status !== 'paid') {
      return res.status(403).json({ 
        success: false,
        error: 'Files are not yet approved for download' 
      });
    }

    const fileBuffer = Buffer.from(file.file_data, 'base64');
    
    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(fileBuffer);
    
    console.log(`✅ [BUYER] Downloaded: ${file.file_name}`);

  } catch (error) {
    console.error('❌ Buyer download error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Download failed: ' + error.message 
    });
  }
});















// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Original file exchange: /api/upload`);
  console.log(`📤 Offer file upload: /api/upload-offer-files`);
  console.log(`👨‍💼 Admin file reviews: /api/admin/file-reviews`);
  console.log(`👤 Buyer file access: /api/buyer/file-reviews/:offerId`);
  console.log(`💳 Payment update: /api/update-offer-payment/:offerId`);
  console.log(`🔍 Invoice status check: /api/check-invoice-status/:offerId`);
  console.log(`🔔 Payment webhook: /api/webhook/invoice-paid`);
});

// Set server timeouts
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000;
server.headersTimeout = 300000;




