import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from './TicketDetail.module.css';

const API_BASE = '/api';

const STATUS_OPTIONS = ['Chưa thực hiện', 'Đang thực hiện', 'Hoàn thành'];
const STATUS_CLASS = {
  'Chưa thực hiện': styles.statusPending,
  'Đang thực hiện': styles.statusProgress,
  'Hoàn thành': styles.statusDone,
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ status: '', completed_at: '', evidence_note: '' });
  const [editingTicketInfo, setEditingTicketInfo] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    employee_name: '',
    employee_id: '',
    email: '',
    position: '',
    manager: '',
    last_working_day: '',
    status: 'Chưa thực hiện',
  });
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState(new Set());
  const [bulkForm, setBulkForm] = useState({
    status: 'Chưa thực hiện',
    completed_at: '',
    evidence_note: '',
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchTicket = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}`);
      if (!res.ok) throw new Error('Không tải được ticket');
      const data = await res.json();
      setTicket(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const startEdit = (item) => {
    setEditingItem(item.id);
    setEditForm({
      status: item.status || 'Chưa thực hiện',
      completed_at: formatDate(item.completed_at),
      evidence_note: item.evidence_note || '',
    });
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveItem = async () => {
    if (!editingItem) return;
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/checklist/${editingItem}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editForm.status,
          completed_at: editForm.completed_at || null,
          evidence_note: editForm.evidence_note || null,
        }),
      });
      if (!res.ok) throw new Error('Cập nhật thất bại');
      await fetchTicket();
      setEditingItem(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownload = async () => {
    if (!ticket) return;
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/export`);
      if (!res.ok) throw new Error('Export thất bại');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Offboard checklist - ${ticket.employee_name} ${ticket.employee_id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  const startEditTicketInfo = () => {
    setTicketForm({
      employee_name: ticket.employee_name || '',
      employee_id: ticket.employee_id || '',
      email: ticket.email || '',
      position: ticket.position || '',
      manager: ticket.manager || '',
      last_working_day: ticket.last_working_day ? formatDate(ticket.last_working_day) : '',
      status: ticket.status || 'Chưa thực hiện',
    });
    setEditingTicketInfo(true);
  };

  const cancelEditTicketInfo = () => {
    setEditingTicketInfo(false);
  };

  const saveTicketInfo = async () => {
    try {
      const payload = {
        ...ticketForm,
        last_working_day: ticketForm.last_working_day || null,
      };
      const res = await fetch(`${API_BASE}/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Cập nhật thông tin thất bại');
      await fetchTicket();
      setEditingTicketInfo(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const openBulkModal = () => {
    setBulkSelectedIds(new Set());
    setBulkForm({ status: 'Chưa thực hiện', completed_at: '', evidence_note: '' });
    setBulkModalOpen(true);
  };

  const toggleBulkSelectAll = () => {
    const list = ticket?.checklist || [];
    if (bulkSelectedIds.size >= list.length) {
      setBulkSelectedIds(new Set());
    } else {
      setBulkSelectedIds(new Set(list.map((i) => i.id)));
    }
  };

  const toggleBulkItem = (itemId) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const applyBulkUpdate = async () => {
    const ids = Array.from(bulkSelectedIds);
    if (ids.length === 0) {
      alert('Vui lòng chọn ít nhất một công việc.');
      return;
    }
    const payload = {
      item_ids: ids,
      status: bulkForm.status,
      completed_at: bulkForm.completed_at || null,
      evidence_note: bulkForm.evidence_note || null,
    };
    setBulkSaving(true);
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/checklist/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Cập nhật hàng loạt thất bại');
      await fetchTicket();
      setBulkModalOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Đang tải...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!ticket) return null;

  const groupedChecklist = (ticket.checklist || []).reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className={styles.wrapper}>
      <div className={styles.breadcrumb}>
        <Link to="/">Danh sách</Link>
        <span>/</span>
        <span>Offboard checklist - {ticket.employee_name} {ticket.employee_id}</span>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Thông tin nhân viên</h2>
          <div className={styles.headerActions}>
            {editingTicketInfo ? (
              <>
                <button type="button" className={styles.btnSaveInfo} onClick={saveTicketInfo}>
                  Lưu
                </button>
                <button type="button" className={styles.btnCancelInfo} onClick={cancelEditTicketInfo}>
                  Hủy
                </button>
                <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
                  Tải file Excel .xlsx
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.btnEditInfo} onClick={startEditTicketInfo}>
                  Sửa
                </button>
                <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
                  Tải file Excel .xlsx
                </button>
              </>
            )}
          </div>
        </div>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Họ và tên</span>
            {editingTicketInfo ? (
              <input
                type="text"
                value={ticketForm.employee_name}
                onChange={(e) => setTicketForm((f) => ({ ...f, employee_name: e.target.value }))}
                className={styles.infoInput}
              />
            ) : (
              <span>{ticket.employee_name}</span>
            )}
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>ID</span>
            {editingTicketInfo ? (
              <input
                type="text"
                value={ticketForm.employee_id}
                onChange={(e) => setTicketForm((f) => ({ ...f, employee_id: e.target.value }))}
                className={styles.infoInput}
              />
            ) : (
              <span>{ticket.employee_id}</span>
            )}
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Email</span>
            {editingTicketInfo ? (
              <input
                type="email"
                value={ticketForm.email}
                onChange={(e) => setTicketForm((f) => ({ ...f, email: e.target.value }))}
                className={styles.infoInput}
              />
            ) : (
              <span>{ticket.email}</span>
            )}
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Vị trí</span>
            {editingTicketInfo ? (
              <input
                type="text"
                value={ticketForm.position}
                onChange={(e) => setTicketForm((f) => ({ ...f, position: e.target.value }))}
                className={styles.infoInput}
              />
            ) : (
              <span>{ticket.position || '—'}</span>
            )}
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Manager</span>
            {editingTicketInfo ? (
              <input
                type="text"
                value={ticketForm.manager}
                onChange={(e) => setTicketForm((f) => ({ ...f, manager: e.target.value }))}
                className={styles.infoInput}
              />
            ) : (
              <span>{ticket.manager || '—'}</span>
            )}
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Ngày làm việc cuối cùng</span>
            {editingTicketInfo ? (
              <input
                type="date"
                value={ticketForm.last_working_day}
                onChange={(e) => setTicketForm((f) => ({ ...f, last_working_day: e.target.value }))}
                className={styles.infoInput}
              />
            ) : (
              <span>{ticket.last_working_day ? new Date(ticket.last_working_day).toLocaleDateString('vi-VN') : '—'}</span>
            )}
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Trạng thái ticket</span>
            {editingTicketInfo ? (
              <select
                value={ticketForm.status}
                onChange={(e) => setTicketForm((f) => ({ ...f, status: e.target.value }))}
                className={styles.infoInput}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <span className={STATUS_CLASS[ticket.status] || styles.statusPending}>{ticket.status}</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Checklist offboard</h2>
            <p className={styles.sectionDesc}>
              Cập nhật trạng thái, ngày hoàn tất và ghi chú cho từng hạng mục. Trạng thái có thể tự cập nhật khi điền Ngày hoàn tất và Evidence / Ghi chú.
            </p>
          </div>
          <button type="button" className={styles.btnBulkSelect} onClick={openBulkModal}>
            Chọn nhiều mục
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hạng mục</th>
                <th>Công việc</th>
                <th className={styles.statusCol}>Trạng thái</th>
                <th>Ngày hoàn tất</th>
                <th>Evidence / Ghi chú</th>
                <th className={styles.colAction}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedChecklist).map(([category, items]) =>
                items.map((item, idx) => (
                  <tr key={item.id}>
                    {idx === 0 && (
                      <td rowSpan={items.length} className={styles.categoryCell}>
                        {category}
                      </td>
                    )}
                    <td className={styles.taskCell}>{item.task}</td>
                    {editingItem === item.id ? (
                      <>
                        <td className={styles.statusCell}>
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                            className={styles.input}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="date"
                            value={editForm.completed_at}
                            onChange={(e) => setEditForm((f) => ({ ...f, completed_at: e.target.value }))}
                            className={styles.input}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editForm.evidence_note}
                            onChange={(e) => setEditForm((f) => ({ ...f, evidence_note: e.target.value }))}
                            placeholder="Ghi chú / Evidence"
                            className={styles.input}
                          />
                        </td>
                        <td className={styles.colAction}>
                          <div className={styles.actionGroup}>
                            <button type="button" className={styles.btnSave} onClick={saveItem}>Lưu</button>
                            <button type="button" className={styles.btnCancel} onClick={cancelEdit}>Hủy</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={styles.statusCell}>
                          <span className={STATUS_CLASS[item.status] || styles.statusPending}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.completed_at ? new Date(item.completed_at).toLocaleDateString('vi-VN') : '—'}</td>
                        <td className={styles.noteCell}>{item.evidence_note || '—'}</td>
                        <td className={styles.colAction}>
                          <button type="button" className={styles.btnEdit} onClick={() => startEdit(item)}>
                            Sửa
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {bulkModalOpen && (
        <div className={styles.bulkOverlay} onClick={() => setBulkModalOpen(false)}>
          <div className={styles.bulkModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.bulkModalHeader}>
              <div className={styles.bulkModalTitleWrap}>
                <span className={styles.bulkModalIcon} aria-hidden>✓</span>
                <h3 className={styles.bulkModalTitle}>Cập nhật nhiều công việc</h3>
              </div>
              <button type="button" className={styles.bulkCloseBtn} onClick={() => setBulkModalOpen(false)} aria-label="Đóng">
                ×
              </button>
            </div>
            <div className={styles.bulkModalBody}>
              <div className={styles.bulkHintBox}>
                <span className={styles.bulkHintIcon} aria-hidden>ℹ</span>
                <p className={styles.bulkHint}>Chọn các công việc bên dưới, điền trạng thái / ngày / ghi chú rồi bấm <strong>Áp dụng</strong> để cập nhật cùng lúc.</p>
              </div>

              <div className={styles.bulkSection}>
                <div className={styles.bulkSectionHead}>
                  <span className={styles.bulkSectionTitle}>Công việc cần cập nhật</span>
                  <div className={styles.bulkSelectAll}>
                    <button type="button" className={styles.bulkSelectAllBtn} onClick={toggleBulkSelectAll}>
                      {ticket?.checklist?.length && bulkSelectedIds.size >= ticket.checklist.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                    <span className={styles.bulkSelectedBadge}>{bulkSelectedIds.size} đã chọn</span>
                  </div>
                </div>
                <div className={styles.bulkList}>
                  {(ticket?.checklist || []).map((item) => (
                    <label key={item.id} className={styles.bulkListItem}>
                      <input
                        type="checkbox"
                        checked={bulkSelectedIds.has(item.id)}
                        onChange={() => toggleBulkItem(item.id)}
                        className={styles.bulkCheckbox}
                      />
                      <span className={styles.bulkItemCategory}>{item.category}</span>
                      <span className={styles.bulkItemTask}>{item.task}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.bulkSection}>
                <span className={styles.bulkSectionTitle}>Thông tin áp dụng chung</span>
                <div className={styles.bulkForm}>
                  <div className={styles.bulkFormRow}>
                    <label className={styles.bulkFormField}>
                      <span className={styles.bulkFormLabel}>Trạng thái</span>
                      <select
                        value={bulkForm.status}
                        onChange={(e) => setBulkForm((f) => ({ ...f, status: e.target.value }))}
                        className={styles.bulkInput}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.bulkFormField}>
                      <span className={styles.bulkFormLabel}>Ngày hoàn tất</span>
                      <input
                        type="date"
                        value={bulkForm.completed_at}
                        onChange={(e) => setBulkForm((f) => ({ ...f, completed_at: e.target.value }))}
                        className={styles.bulkInput}
                      />
                    </label>
                  </div>
                  <label className={styles.bulkFormField}>
                    <span className={styles.bulkFormLabel}>Evidence / Ghi chú</span>
                    <textarea
                      value={bulkForm.evidence_note}
                      onChange={(e) => setBulkForm((f) => ({ ...f, evidence_note: e.target.value }))}
                      placeholder="Nhập ghi chú hoặc evidence áp dụng cho các mục đã chọn..."
                      className={styles.bulkTextarea}
                      rows={3}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className={styles.bulkModalFooter}>
              <button type="button" className={styles.bulkBtnCancel} onClick={() => setBulkModalOpen(false)}>
                Hủy
              </button>
              <button type="button" className={styles.bulkBtnApply} onClick={applyBulkUpdate} disabled={bulkSaving}>
                {bulkSaving ? 'Đang áp dụng...' : 'Áp dụng cho ' + bulkSelectedIds.size + ' mục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
