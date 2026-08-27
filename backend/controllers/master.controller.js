const db = require('../config/db');

exports.getAllMasters = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM master_items ORDER BY part_name ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createMaster = async (req, res) => {
  try {
    const {
      oem, brand, partName, make, model, year, engine,
      unitType, pcsPerBox, sizePerPc, position, origin, description, images
    } = req.body;

    const query = `
      INSERT INTO master_items 
      (oem, brand, part_name, make, model, year, engine, unit_type, pcs_per_box, size_per_pc, position, origin, description, images)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const values = [
      oem.toUpperCase(), brand.toUpperCase(), partName.toUpperCase(),
      make ? make.toUpperCase() : null, model ? model.toUpperCase() : null,
      year ? year.toUpperCase() : null, engine ? engine.toUpperCase() : null,
      unitType || 'pc', pcsPerBox || null, sizePerPc || null,
      position ? position.toUpperCase() : null, origin ? origin.toUpperCase() : null,
      description ? description.toUpperCase() : null, images || []
    ];

    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};