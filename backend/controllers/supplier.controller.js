const db = require('../config/db');

// GET ALL SUPPLIERS
exports.getAllSuppliers = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// CREATE SUPPLIER
exports.createSupplier = async (req, res) => {
  try {
    const { name, contactPerson, phone, email } = req.body;

    const checkDup = await db.query('SELECT id FROM suppliers WHERE UPPER(name) = UPPER($1)', [name]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ message: `Ang supplier na "${name}" ay nakarehistro na!` });
    }

    const query = `
      INSERT INTO suppliers (name, contact_person, phone, email)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await db.query(query, [
      name.toUpperCase(),
      contactPerson.toUpperCase(),
      phone,
      email.toUpperCase()
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE SUPPLIER (MAY SAFETY CHECK LABAN SA ACTIVE VARIANTS)
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplierCheck = await db.query('SELECT name FROM suppliers WHERE id = $1', [id]);
    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    const supplierName = supplierCheck.rows[0].name;

    // CHECK KUNG GINAGAMIT PA SA INVENTORY VARIANTS
    const inUseCheck = await db.query('SELECT id FROM inventory_variants WHERE UPPER(supplier) = UPPER($1)', [supplierName]);
    if (inUseCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Hindi maaaring burahin ang supplier na ito dahil ginagamit pa ito ng ilang active inventory variants!' });
    }

    await db.query('DELETE FROM suppliers WHERE id = $1', [id]);
    res.status(200).json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};