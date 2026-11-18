const db = require('../config/db');

// 1. Kunin ang lahat ng Master Items kasama ang unang larawan (thumbnail) lamang
exports.getAllMasters = async (req, res) => {
  try {
    const query = `
      SELECT id, oem, brand, part_name, make, model, year, engine, 
             unit_type, position, origin, description, 
             images[1:1] AS images, created_at 
      FROM master_items 
      ORDER BY part_name ASC;
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching master items:', error);
    res.status(500).json({ success: false, message: 'Server error sa pagkuha ng master items.' });
  }
};

// 2. Kunin ang larawan ng isang partikular na item on-demand
exports.getMasterImage = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT images FROM master_items WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hindi nahanap ang Master Item.' });
    }
    
    res.json({ success: true, images: rows[0].images || [] });
  } catch (error) {
    console.error('Error fetching master image:', error);
    res.status(500).json({ success: false, message: 'Server error sa pagkuha ng larawan.' });
  }
};

// 3. Mag-save ng Bagong Master Item sa Database (Walang pcs_per_box at size_per_pc)
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
      position,
      origin,
      description,
      images
    } = req.body;

    if (!oem || !brand || !part_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kailangan ang OEM, Brand, at Part Name.' 
      });
    }

    const query = `
      INSERT INTO master_items (
        oem, brand, part_name, make, model, year, engine, 
        unit_type, position, origin, description, images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      position ? position.toUpperCase() : '',
      origin ? origin.toUpperCase() : '',
      description ? description.toUpperCase() : '',
      images || []
    ];

    const result = await db.query(query, values);
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

// 4. Kunin ang isang Master Item at ang mga kaugnay nitong supplier variants
exports.getMasterById = async (req, res) => {
  try {
    const { id } = req.params;
    const masterQuery = `SELECT * FROM master_items WHERE id = $1;`;
    const masterRes = await db.query(masterQuery, [id]);

    if (masterRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Hindi nahanap ang Master Item.' });
    }

    const variantsQuery = `SELECT * FROM inventory_variants WHERE master_id = $1;`;
    const variantsRes = await db.query(variantsQuery, [id]);

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
