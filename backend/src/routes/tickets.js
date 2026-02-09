const express = require('express');
const router = express.Router();
const { pool } = require('../db/config');
const checklistTemplate = require('../db/checklistTemplate');
const XLSX = require('xlsx');

// Compute ticket status from checklist: all Hoàn thành -> Hoàn thành; any in progress -> Đang thực hiện; else Chưa thực hiện
async function computeTicketStatusFromChecklist(ticketId) {
  const { rows } = await pool.query(
    'SELECT status FROM checklist_items WHERE ticket_id = $1',
    [ticketId]
  );
  if (rows.length === 0) return { status: 'Chưa thực hiện', completed_at: null };
  const allDone = rows.every((r) => r.status === 'Hoàn thành');
  const anyInProgress = rows.some((r) => r.status === 'Đang thực hiện' || r.status === 'Hoàn thành');
  if (allDone) return { status: 'Hoàn thành', completed_at: new Date() };
  if (anyInProgress) return { status: 'Đang thực hiện', completed_at: null };
  return { status: 'Chưa thực hiện', completed_at: null };
}

// List all tickets
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, employee_name, employee_id, email, position, manager,
             last_working_day, status, completed_at, created_at, created_by
      FROM tickets
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one ticket with checklist items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ticketRes = await pool.query(
      'SELECT * FROM tickets WHERE id = $1',
      [id]
    );
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const checklistRes = await pool.query(
      'SELECT * FROM checklist_items WHERE ticket_id = $1 ORDER BY sort_order, id',
      [id]
    );
    res.json({
      ...ticketRes.rows[0],
      checklist: checklistRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create ticket (with checklist from template)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      employee_name,
      employee_id,
      email,
      position,
      manager,
      last_working_day,
      status = 'Chưa thực hiện',
      created_by,
    } = req.body;
    if (!employee_name || !employee_id || !email) {
      return res.status(400).json({ error: 'employee_name, employee_id, email are required' });
    }
    const ticketRes = await client.query(
      `INSERT INTO tickets (employee_name, employee_id, email, position, manager, last_working_day, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [employee_name, employee_id, email, position || null, manager || null, last_working_day || null, status, created_by || null]
    );
    const ticket = ticketRes.rows[0];
    let sortOrder = 0;
    for (const group of checklistTemplate) {
      for (const task of group.tasks) {
        await client.query(
          `INSERT INTO checklist_items (ticket_id, category, task, sort_order) VALUES ($1, $2, $3, $4)`,
          [ticket.id, group.category, task, sortOrder++]
        );
      }
    }
    const checklistRes = await client.query(
      'SELECT * FROM checklist_items WHERE ticket_id = $1 ORDER BY sort_order, id',
      [ticket.id]
    );
    res.status(201).json({ ...ticket, checklist: checklistRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update ticket
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['employee_name', 'employee_id', 'email', 'position', 'manager', 'last_working_day', 'status', 'completed_at'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE tickets SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk update checklist items (same status, date, evidence for many items)
router.patch('/:id/checklist/bulk', async (req, res) => {
  try {
    const { id } = req.params;
    const { item_ids: itemIds, status, completed_at, evidence_note } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'item_ids must be a non-empty array' });
    }
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (completed_at !== undefined) updates.completed_at = completed_at;
    if (evidence_note !== undefined) updates.evidence_note = evidence_note;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Provide at least one of: status, completed_at, evidence_note' });
    }
    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    const placeholders = itemIds.map((_, i) => `$${values.length + i + 1}`).join(',');
    const { rowCount } = await pool.query(
      `UPDATE checklist_items SET ${setClause} WHERE ticket_id = $${values.length + itemIds.length + 1} AND id IN (${placeholders})`,
      [...values, ...itemIds, id]
    );
    const ticketUpdate = await computeTicketStatusFromChecklist(id);
    await pool.query(
      'UPDATE tickets SET status = $1, completed_at = $2 WHERE id = $3',
      [ticketUpdate.status, ticketUpdate.completed_at, id]
    );
    res.json({ updated: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update checklist item (and auto-update ticket status from checklist)
router.patch('/:id/checklist/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status, completed_at, evidence_note } = req.body;
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (completed_at !== undefined) updates.completed_at = completed_at;
    if (evidence_note !== undefined) updates.evidence_note = evidence_note;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...Object.values(updates), itemId, id];
    const { rows } = await pool.query(
      `UPDATE checklist_items SET ${setClause} WHERE id = $${values.length - 1} AND ticket_id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Checklist item not found' });

    // Tự động cập nhật Trạng thái ticket theo checklist
    const ticketUpdate = await computeTicketStatusFromChecklist(id);
    await pool.query(
      'UPDATE tickets SET status = $1, completed_at = $2 WHERE id = $3',
      [ticketUpdate.status, ticketUpdate.completed_at, id]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export ticket to xlsx
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];
    const checklistRes = await pool.query(
      'SELECT * FROM checklist_items WHERE ticket_id = $1 ORDER BY sort_order, id',
      [id]
    );
    const formatDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
    const wb = XLSX.utils.book_new();
    const infoData = [
      ['Offboard checklist'],
      [],
      ['Họ và tên nhân viên', ticket.employee_name],
      ['ID', ticket.employee_id],
      ['Email', ticket.email],
      ['Vị trí', ticket.position || ''],
      ['Manager', ticket.manager || ''],
      ['Ngày làm việc cuối cùng', formatDate(ticket.last_working_day)],
      ['Trạng thái', ticket.status || ''],
      ['Ngày hoàn tất', formatDate(ticket.completed_at)],
      [],
      ['Hạng mục', 'Công việc', 'Trạng thái', 'Ngày hoàn tất', 'Evidence / Ghi chú'],
      ...checklistRes.rows.map((r) => [
        r.category,
        r.task,
        r.status || '',
        formatDate(r.completed_at),
        r.evidence_note || '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(infoData);
    ws['!cols'] = [{ wch: 35 }, { wch: 55 }, { wch: 18 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Offboard checklist');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Offboard checklist - ${ticket.employee_name} ${ticket.employee_id}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
