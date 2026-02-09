import { useState } from 'react';
import styles from './CreateTicketModal.module.css';

const STATUS_OPTIONS = ['Chưa thực hiện', 'Đang thực hiện', 'Hoàn thành'];

export default function CreateTicketModal({ open, onClose, onCreated, apiBase }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    employee_name: '',
    employee_id: '',
    email: '',
    position: '',
    manager: '',
    last_working_day: '',
    status: 'Chưa thực hiện',
    created_by: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        last_working_day: form.last_working_day || null,
        created_by: form.created_by || null,
      };
      const res = await fetch(`${apiBase}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo ticket thất bại');
      onCreated();
      setForm({
        employee_name: '',
        employee_id: '',
        email: '',
        position: '',
        manager: '',
        last_working_day: '',
        status: 'Chưa thực hiện',
        created_by: '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Tạo ticket Offboard</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.grid}>
            <label>
              <span className={styles.labelText}>Họ và tên nhân viên <span className={styles.required}>*</span></span>
              <input
                type="text"
                name="employee_name"
                value={form.employee_name}
                onChange={handleChange}
                required
                placeholder="Họ và tên nhân viên"
              />
            </label>
            <label>
              <span className={styles.labelText}>ID <span className={styles.required}>*</span></span>
              <input
                type="text"
                name="employee_id"
                value={form.employee_id}
                onChange={handleChange}
                required
                placeholder="ID của nhân viên"
              />
            </label>
            <label>
              <span className={styles.labelText}>Email <span className={styles.required}>*</span></span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="email@company.vn"
              />
            </label>
            <label>
              <span className={styles.labelText}>Vị trí</span>
              <input
                type="text"
                name="position"
                value={form.position}
                onChange={handleChange}
                placeholder="Developer, QA, ..."
              />
            </label>
            <label>
              <span className={styles.labelText}>Manager</span>
              <input
                type="text"
                name="manager"
                value={form.manager}
                onChange={handleChange}
                placeholder="Họ và tên quản lý"
              />
            </label>
            <label>
              <span className={styles.labelText}>Ngày làm việc cuối cùng</span>
              <input
                type="date"
                name="last_working_day"
                value={form.last_working_day}
                onChange={handleChange}
              />
            </label>
            <label>
              <span className={styles.labelText}>Trạng thái</span>
              <select name="status" value={form.status} onChange={handleChange}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={styles.labelText}>Người tạo</span>
              <input
                type="text"
                name="created_by"
                value={form.created_by}
                onChange={handleChange}
                placeholder="Tên người tạo ticket"
              />
            </label>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Đang tạo...' : 'Tạo ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
