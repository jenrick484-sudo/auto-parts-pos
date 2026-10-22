const pool = require('../db/pool');

// Kunin ang lahat ng Master Items kasama ang kabuuang stock mula sa mga variant nito
exports.getAllMasters = async (req, res) => {
  try {
    const query = `
      SELECT m.*, 
             COALESCE(SUM(v.stock), 0) as total_stock
      FROM master_items m
      LEFT JOIN inventory_variants v ON m.id = v.master_id
      GROUP BY m.id
      ORDER BY m.part_name ASC, m.oem ASC;
    `;
    const result = await pool.query(query);
    res.json({ success: true, masters: result.rows });
  } catch (error) {
    console.error('Error fetching master items:', error);
    res.status(500).json({ success: false, message: 'Server error sa pagkuha ng master items.' });
  }
};

// Mag-save ng Bagong Master Item sa Database
exports.createMaster = async (req, res) => {
  try {
    const {
      oem,
      brand,
      part_name,
      make,
      model,
      year,
      engine,
      unit_type,
      pcs_per_box,
      size_per_pc,
      position,
      origin,
      description,
      images
    } = req.body;

    // I-validate ang mga pangunahing kinakailangang field
    if (!oem || !brand || !part_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kailangan ang OEM, Brand, at Part Name.' 
      });
    }

    const query = `
      INSERT INTO master_items (
        oem, brand, part_name, make, model, year, engine, 
        unit_type, pcs_per_box, size_per_pc, position, origin, description, images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const values = [
      oem.toUpperCase(),
      brand.toUpperCase(),
      part_name.toUpperCase(),
      make ? make.toUpperCase() : '',
      model ? model.toUpperCase() : '',
      year ? year.toUpperCase() : '',
      engine ? engine.toUpperCase() : '',
      unit_type || 'pc',
      pcs_per_box || null,
      size_per_pc ? size_per_pc.toUpperCase() : '',
      position ? position.toUpperCase() : '',
      origin ? origin.toUpperCase() : '',
      description ? description.toUpperCase() : '',
      images || []
    ];

    const result = await pool.query(query, values);
    res.status(201).json({ 
      success: true, 
      message: 'Matagumpay na nairehistro ang Master Item!', 
      master: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating master item:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Mayroon nang rehistradong OEM part number na ganito.' });
    }
    res.status(500).json({ success: false, message: 'Server error sa pag-save ng master item.' });
  }
};

// Kunin ang isang Master Item at ang mga kaugnay nitong supplier variants
exports.getMasterById = async (req, res) => {
  try {
    const { id } = req.params;
    const masterQuery = `SELECT * FROM master_items WHERE id = $1;`;
    const masterRes = await pool.query(masterQuery, [id]);

    if (masterRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hindi nahanap ang Master Item.' });
    }

    const variantsQuery = `SELECT * FROM inventory_variants WHERE master_id = $1;`;
    const variantsRes = await pool.query(variantsQuery, [id]);

    res.json({
      success: true,
      master: masterRes.rows[0],
      variants: variantsRes.rows
    });
  } catch (error) {
    console.error('Error fetching master item details:', error);
    res.status(500).json({ success: false, message: 'Server error sa pagkuha ng detalye.' });
  }
};