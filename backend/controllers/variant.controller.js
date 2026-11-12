const db = require('../config/db');

// GET /api/variants - Kunin ang lahat ng inventory variants
exports.getAllVariants = async (req, res) => {
  try {
    const query = `
      SELECT 
        v.id,
        v.master_id AS "masterId",
        v.code,
        v.barcode,
        v.supplier,
        v.cost,
        v.price,
        v.stock,
        v.low_stock_limit AS "lowStockLimit",
        v.created_at
      FROM inventory_variants v
      ORDER BY v.master_id ASC, v.code ASC;
    `;
    const result = await db.query(query);
    return res.json({ success: true, variants: result.rows });
  } catch (error) {
    console.error('Error fetching variants:', error);
    return res.status(500).json({ success: false, message: 'Server error sa pagkuha ng variants.' });
  }
};

// POST /api/variants - Gumawa ng bagong variant gamit ang format na IT{masterId}.{001} (hal. IT1.001)
exports.createVariant = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const masterId = parseInt(req.body.masterId || req.body.master_id, 10);
    const supplier = (req.body.supplier || '').toString().trim().toUpperCase();
    const cost = parseFloat(req.body.cost);
    const price = parseFloat(req.body.price);
    const stock = parseInt(req.body.stock, 10) || 0;
    const lowStockLimit = parseInt(req.body.lowStockLimit || req.body.low_stock_limit, 10) || 2;

    if (isNaN(masterId) || !supplier || isNaN(cost) || isNaN(price)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Kailangan ang Master Item, Supplier, Cost, at Selling Price.'
      });
    }

    // I-lock ang master item row para maiwasan ang duplicate sequence number
    const masterCheck = await client.query(
      'SELECT id FROM master_items WHERE id = $1 FOR UPDATE',
      [masterId]
    );
    if (masterCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Hindi nahanap ang Master Item.' });
    }

    // Hanapin ang pinakamataas na 3-digit variant number para sa master item na ito
    const existingCodesRes = await client.query(
      'SELECT code FROM inventory_variants WHERE master_id = $1',
      [masterId]
    );

    let maxSeq = 0;
    const prefix = `IT${masterId}.`;

    existingCodesRes.rows.forEach(row => {
      const codeStr = (row.code || '').toUpperCase();
      if (codeStr.startsWith(prefix)) {
        const suffixPart = codeStr.slice(prefix.length);
        const parsedNum = parseInt(suffixPart, 10);
        if (!isNaN(parsedNum) && parsedNum > maxSeq) {
          maxSeq = parsedNum;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    const generatedCode = `${prefix}${nextSeq}`; // Halimbawa: IT1.001, IT1.002, IT2.001

    const insertQuery = `
      INSERT INTO inventory_variants (
        master_id, code, barcode, supplier, cost, price, stock, low_stock_limit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        master_id AS "masterId",
        code,
        barcode,
        supplier,
        cost,
        price,
        stock,
        low_stock_limit AS "lowStockLimit";
    `;

    const result = await client.query(insertQuery, [
      masterId,
      generatedCode,
      generatedCode,
      supplier,
      cost,
      price,
      stock,
      lowStockLimit
    ]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Matagumpay na nagawa ang variant ${generatedCode}!`,
      variant: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating variant:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// PATCH /api/variants/:code/restock - Magdagdag ng stock sa existing variant
exports.restockVariant = async (req, res) => {
  try {
    const { code } = req.params;
    const addQty = parseInt(req.body.addQty || req.body.qty, 10);

    if (isNaN(addQty) || addQty <= 0) {
      return res.status(400).json({ success: false, message: 'Dapat ay 1 o higit pa ang idadagdag na stock.' });
    }

    const result = await db.query(
      `UPDATE inventory_variants
       SET stock = stock + $1
       WHERE UPPER(code) = UPPER($2)
       RETURNING id, code, stock`,
      [addQty, code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Hindi nahanap ang variant code: ${code}` });
    }

    return res.json({
      success: true,
      message: `Naidagdag ang +${addQty} stock sa ${result.rows[0].code}.`,
      variant: result.rows[0]
    });
  } catch (error) {
    console.error('Error restocking variant:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};