import { SummaryCard } from '../components/SummaryCard'

export function ContactsPage({
  contactForm,
  contactsList,
  editingContactId,
  onApplyContactNumber,
  onCancelEditContact,
  onContactFormChange,
  onDeleteContact,
  onStartEditContact,
  onSubmitContact,
}) {
  return (
    <div className="md-page-stack">
      <section className="md-summary-grid">
        <SummaryCard label="联系人总数" value={`${contactsList.length} 人`} hint={contactsList.length > 0 ? '可快速填入通知配置' : '建议至少维护 1 人'} />
        <SummaryCard label="编辑状态" value={editingContactId ? '编辑中' : '新增模式'} hint={editingContactId ? '保存后将更新联系人信息' : '可直接新增可信联系人'} />
        <SummaryCard label="电话快捷填入" value="支持" hint="可直接设为电话通道" />
        <SummaryCard label="短信快捷填入" value="支持" hint="可直接设为短信通道" />
      </section>

      <section className="md-section-card md-dashboard-intro-card">
        <div className="md-section-head">
          <div>
            <h3>联系人管理</h3>
            <p className="md-section-hint">此页专注联系人维护，结构统一为表单主卡 + 列表侧卡。</p>
          </div>
          <span className="md-chip">{contactsList.length} 人</span>
        </div>
        <p className="md-section-hint">将号码填入通知配置后，记得回到“通知配置”页面保存。</p>
      </section>

      <div className="md-dashboard-grid">
        <form className="md-section-card md-contact-form md-dashboard-primary-card" onSubmit={onSubmitContact}>
          <div className="md-section-head">
            <h2>{editingContactId ? '编辑联系人' : '新增联系人'}</h2>
            <span className="md-chip subtle">表单</span>
          </div>
          <div className="md-contact-form-grid">
            <div>
              <label htmlFor="contactName">联系人姓名</label>
              <input
                id="contactName"
                name="name"
                value={contactForm.name}
                onChange={onContactFormChange}
                placeholder="例如 家人 / 室友 / 朋友"
              />
            </div>
            <div>
              <label htmlFor="contactPhone">联系电话</label>
              <input
                id="contactPhone"
                name="phone"
                value={contactForm.phone}
                onChange={onContactFormChange}
                placeholder="例如 13800000000"
              />
            </div>
          </div>
          <div className="md-row-actions">
            <button type="submit" className="md-btn">
              {editingContactId ? '保存联系人' : '新增联系人'}
            </button>
            {editingContactId && (
              <button type="button" className="md-btn tonal" onClick={onCancelEditContact}>
                取消编辑
              </button>
            )}
          </div>
        </form>

        <section className="md-section-card md-contact-section md-dashboard-side-card">
          <div className="md-section-head">
            <h2>联系人列表</h2>
            <span className="md-chip subtle">可直接填入号码</span>
          </div>

          {contactsList.length > 0 ? (
            <ul className="md-contact-list">
              {contactsList.map((contact) => (
                <li key={contact.id} className="md-contact-item">
                  <div className="md-contact-main">
                    <strong>{contact.name}</strong>
                    <span>{contact.phone}</span>
                  </div>
                  <div className="md-row-actions">
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onApplyContactNumber('callNumber', contact.phone)}
                    >
                      设为电话
                    </button>
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onApplyContactNumber('smsNumber', contact.phone)}
                    >
                      设为短信
                    </button>
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onStartEditContact(contact)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="md-btn tonal"
                      onClick={() => onDeleteContact(contact)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="md-data-empty">当前用户还没有联系人，请先新增至少 1 位可信联系人。</p>
          )}
        </section>
      </div>
    </div>
  )
}
