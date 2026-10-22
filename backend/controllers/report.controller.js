const db = require('../config/db');

// GET SALES SUMMARY (YEARLY, MONTHLY, OR DAILY)
exports.getSalesReport = async (req, res) => {
  try {
    const { year, month, date } = req.query;

    let query = `
      SELECT 
        DATE(created_at) AS txn_date,
        COUNT(id) AS total_txns,
        COALESCE(SUM(grand_total), 0) AS gross_sales,
        COALESCE(SUM(total_cost), 0) AS total_cost,
        COALESCE(SUM(total_profit), 0) AS net_profit
      FROM sales_transactions
    `;
    const params = [];

    if (date) {
      query += ` WHERE DATE(created_at) = $1`;
      params.push(date);
    } else if (year && month) {
      query += ` WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2`;
      params.push(year, month);
    } else if (year) {
      query += ` WHERE EXTRACT(YEAR FROM created_at) = $1`;
      params.push(year);
    }

    query += ` GROUP BY DATE(created_at) ORDER BY txn_date DESC`;

    const result = await db.query(query, params);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET DETAILED ITEMIZED LOG FOR A SPECIFIC DATE
exports.getDailyItemizedLog = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    const query = `
      SELECT 
        t.txn_number,
        t.created_at,
        i.variant_code,
        i.part_name,
        i.oem,
        i.brand,
        i.qty,
        i.cost,
        i.price,
        i.subtotal,
        (i.subtotal - (i.cost * i.qty)) AS item_profit
      FROM sales_items i
      JOIN sales_transactions t ON i.transaction_id = t.id
      WHERE DATE(t.created_at) = $1
      ORDER BY t.created_at DESC
    `;

    const result = await db.query(query, [date]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};