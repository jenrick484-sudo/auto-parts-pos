const db = require('../config/db');

exports.getAllVariants = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT v.*, m.part_name, m.oem, m.brand, m.unit_type 
      FROM inventory_variants v
      JOIN master_items m ON v.master_id = m.id
      ORDER BY v.code ASC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createVariant = async (req, res) => {
  try {
    const { masterId, supplier, cost, price, stock, lowStockLimit } = req.body;

    // GENERATE UNIQUE CODE (IT1-COD-001)
    const countResult = await db.query('SELECT COUNT(*) FROM inventory_variants WHERE master_id = $1', [masterId]);
    const seq = String(parseInt(countResult.rows[0].count) + 1).padStart(3, '0');
    const code = `IT${masterId}-COD-${seq}`;
    const barcode = `BAR-${code}`;

    const query = `
      INSERT INTO inventory_variants (code, barcode, master_id, supplier, cost, price, stock, low_stock_limit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const result = await db.query(query, [code, barcode, masterId, supplier.toUpperCase(), cost, price, stock, lowStockLimit || 2]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.restockVariant = async (req, res) => {
  try {
    const { code } = req.params;
    const { addQty } = req.body;

    const result = await db.query(
      'UPDATE inventory_variants SET stock = stock + $1 WHERE code = $2 RETURNING *',
      [addQty, code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Variant code not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};