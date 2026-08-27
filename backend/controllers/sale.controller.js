const db = require('../config/db');

exports.processCheckout = async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { cart, cash, grandTotal, totalCost, change } = req.body;
    const userId = req.user.id;
    const txnNumber = "TXN-" + Math.floor(100000 + Math.random() * 900000);
    const totalProfit = grandTotal - totalCost;

    await client.query('BEGIN'); // START SQL TRANSACTION

    // 1. INSERT SALES TRANSACTION
    const txnResult = await client.query(
      `INSERT INTO sales_transactions (txn_number, user_id, grand_total, total_cost, total_profit, cash, change)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [txnNumber, userId, grandTotal, totalCost, totalProfit, cash, change]
    );

    const transactionId = txnResult.rows[0].id;

    // 2. PROCESS EACH ITEM IN CART: DEDUCT STOCK & RECORD ITEM
    for (const item of cart) {
      // CHECK AVAILABLE STOCK FIRST
      const stockCheck = await client.query(
        'SELECT id, stock FROM inventory_variants WHERE code = $1 FOR UPDATE',
        [item.batchCode]
      );

      if (stockCheck.rows.length === 0 || stockCheck.rows[0].stock < item.qty) {
        throw new Error(`Kulang ang stock para sa item: ${item.partName} (${item.batchCode})`);
      }

      const variantId = stockCheck.rows[0].id;

      // DEDUCT STOCK
      await client.query(
        'UPDATE inventory_variants SET stock = stock - $1 WHERE id = $2',
        [item.qty, variantId]
      );

      // INSERT ITEM SNAPSHOT
      await client.query(
        `INSERT INTO sales_items (transaction_id, variant_id, variant_code, part_name, oem, brand, qty, cost, price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [transactionId, variantId, item.batchCode, item.partName, item.oem, item.brand, item.qty, item.cost, item.price, item.price * item.qty]
      );
    }

    await client.query('COMMIT'); // COMMIT TRANSACTION
    res.status(201).json({ message: 'Checkout successful', txnNumber, grandTotal, change });

  } catch (err) {
    await client.query('ROLLBACK'); // ROLLBACK IF ANY ERROR OCCURS
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};