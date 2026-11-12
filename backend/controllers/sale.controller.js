const db = require('../config/db');

// POST /api/sales - Mag-save ng transaction sa sales_transactions at sales_items
exports.createSale = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const {
      user_id,
      batch_code,
      qty,
      price,
      payment_method,
      cash_tendered,
      change_amount,
      items
    } = req.body;

    // I-validate kung CASH o G-CASH lamang
    const rawMethod = (payment_method || 'CASH').toString().trim().toUpperCase();
    const validPaymentMethod = rawMethod === 'G-CASH' ? 'GCASH' : rawMethod;

    if (validPaymentMethod !== 'CASH' && validPaymentMethod !== 'GCASH') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. CASH o G-CASH lamang ang pinapayagan.'
      });
    }

    const saleItems = items && items.length > 0 ? items : [{
      variant_code: batch_code,
      qty: parseInt(qty, 10),
      price: parseFloat(price)
    }];

    let grandTotal = 0;
    let totalCost = 0;
    const validatedItems = [];

    for (const item of saleItems) {
      const vCode = item.variant_code || item.batchCode;
      const itemQty = parseInt(item.qty, 10);
      const itemPrice = parseFloat(item.price);

      if (isNaN(itemQty) || itemQty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Invalid quantity. Dapat ay 1 o higit pa.' });
      }

      if (isNaN(itemPrice) || itemPrice <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Invalid selling price. Dapat ay mas mataas sa ₱0.00.' });
      }

      const variantRes = await client.query(
        `SELECT v.id, v.stock, v.cost, m.part_name, m.oem, m.brand 
         FROM inventory_variants v
         LEFT JOIN master_items m ON v.master_id = m.id
         WHERE v.code = $1 
         FOR UPDATE OF v`,
        [vCode]
      );

      if (variantRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: `Hindi nahanap ang variant code: ${vCode}` });
      }

      const variant = variantRes.rows[0];
      const dbCost = parseFloat(variant.cost) || 0;

      if (itemPrice < dbCost) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Hindi pwedeng mas mababa sa puhunan/cost (₱${dbCost.toFixed(2)}) ang selling price para sa ${vCode}.`
        });
      }

      if (parseInt(variant.stock, 10) < itemQty) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Kulang ang stock para sa ${vCode}. Available stock: ${variant.stock}`
        });
      }

      const subtotal = itemPrice * itemQty;
      grandTotal += subtotal;
      totalCost += dbCost * itemQty;

      validatedItems.push({
        variantId: variant.id,
        vCode,
        partName: item.part_name || variant.part_name || 'ITEM',
        oem: item.oem || variant.oem || '',
        brand: item.brand || variant.brand || '',
        qty: itemQty,
        cost: dbCost,
        price: itemPrice,
        subtotal
      });
    }

    const totalProfit = grandTotal - totalCost;
    const cash = parseFloat(cash_tendered) || grandTotal;
    const change = parseFloat(change_amount) || 0;
    const cashierId = req.user?.id || (user_id ? parseInt(user_id, 10) : null);
    const txnNumber = 'TXN-' + Date.now();

    // 1. I-insert sa sales_transactions kasama ang payment_method
    const txnResult = await client.query(
      `INSERT INTO sales_transactions (
         txn_number, user_id, payment_method, grand_total, total_cost, total_profit, cash, change, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'Asia/Manila')
       RETURNING id, txn_number, user_id, payment_method, created_at`,
      [txnNumber, cashierId, validPaymentMethod, grandTotal, totalCost, totalProfit, cash, change]
    );

    const transactionId = txnResult.rows[0].id;
    const insertedItems = [];

    // 2. Bawasan ang stock at i-insert sa sales_items
    for (const vItem of validatedItems) {
      await client.query(
        `UPDATE inventory_variants 
         SET stock = stock - $1 
         WHERE id = $2`,
        [vItem.qty, vItem.variantId]
      );

      const itemInsert = await client.query(
        `INSERT INTO sales_items (
           transaction_id, variant_id, variant_code, part_name, oem, brand, qty, cost, price, subtotal
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          transactionId,
          vItem.variantId,
          vItem.vCode,
          vItem.partName,
          vItem.oem,
          vItem.brand,
          vItem.qty,
          vItem.cost,
          vItem.price,
          vItem.subtotal
        ]
      );

      insertedItems.push(itemInsert.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Matagumpay na naisaad ang sale transaction!',
      transaction: {
        id: transactionId,
        txn_number: txnResult.rows[0].txn_number,
        user_id: txnResult.rows[0].user_id,
        payment_method: txnResult.rows[0].payment_method,
        created_at: txnResult.rows[0].created_at,
        grand_total: grandTotal,
        total_cost: totalCost,
        total_profit: totalProfit,
        cash: cash,
        change: change,
        items: insertedItems
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in createSale:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// GET /api/sales - Kukunin ang transactions kasama ang paymentMethod sa Philippine Time
// GET /api/sales - Kukunin ang transactions sa Philippine Time
exports.getSales = async (req, res, next) => {
  try {
    const queryText = `
      SELECT 
        st.id,
        st.txn_number AS "txnNumber",
        st.user_id AS "userId",
        COALESCE(u.full_name, 'SYSTEM') AS "cashierName",
        COALESCE(st.payment_method, 'CASH') AS "paymentMethod",
        TO_CHAR(st.created_at, 'YYYY-MM-DD') AS date,
        TO_CHAR(st.created_at, 'HH12:MI AM') AS time,
        st.grand_total AS "grandTotal",
        st.total_cost AS "totalCost",
        st.total_profit AS "totalProfit",
        st.cash,
        st.change AS change,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', si.id,
              'batchCode', si.variant_code,
              'partName', si.part_name,
              'oem', si.oem,
              'brand', si.brand,
              'qty', si.qty,
              'cost', si.cost,
              'price', si.price,
              'subtotal', si.subtotal
            )
          ) FILTER (WHERE si.id IS NOT NULL), '[]'
        ) AS items
      FROM sales_transactions st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN sales_items si ON st.id = si.transaction_id
      GROUP BY st.id, u.full_name
      ORDER BY st.created_at DESC;
    `;

    const result = await db.query(queryText);
    return res.json({ success: true, sales: result.rows });
  } catch (error) {
    console.error('Error in getSales:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};