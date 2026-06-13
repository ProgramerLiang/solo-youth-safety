import {
  Stack, Typography, Card, CardContent, Button, Chip, TextField, IconButton,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PhoneIcon from '@mui/icons-material/Phone'
import SmsIcon from '@mui/icons-material/Sms'
import { useContactsStore } from '../stores/useContactsStore'
import { useConfigStore } from '../stores/useConfigStore'
import { EmptyState } from '../components/EmptyState'
import { zhCN } from '../i18n/zh-CN'

export function ContactsPage() {
  const list = useContactsStore((s) => s.list)
  const editingId = useContactsStore((s) => s.editingId)
  const draft = useContactsStore((s) => s.draft)
  const startEdit = useContactsStore((s) => s.startEdit)
  const cancelEdit = useContactsStore((s) => s.cancelEdit)
  const setDraftField = useContactsStore((s) => s.setDraftField)
  const clearDraft = useContactsStore((s) => s.clearDraft)
  const add = useContactsStore((s) => s.add)
  const update = useContactsStore((s) => s.update)
  const deleteContact = useContactsStore((s) => s.deleteContact)

  const setField = useConfigStore((s) => s.setField)

  const handleSubmit = () => {
    if (!draft.name.trim() || !draft.phone.trim()) return
    if (editingId) {
      update(editingId, draft.name.trim(), draft.phone.trim())
    } else {
      add(draft.name.trim(), draft.phone.trim())
    }
  }

  const fillBoth = (phone: string) => {
    setField('callNumber', phone)
    setField('smsNumber', phone)
  }
  const fillCall = (phone: string) => setField('callNumber', phone)
  const fillSms = (phone: string) => setField('smsNumber', phone)

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{zhCN.pages.contacts.label}</Typography>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {zhCN.contacts.helpDescription}
          </Typography>
          <Chip label={`${list.length} 人`} size="small" sx={{ mt: 1 }} />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="overline">
            {editingId ? zhCN.contacts.editTitle : zhCN.contacts.addTitle}
          </Typography>
          <Stack spacing={2} mt={2}>
            <TextField label={zhCN.contacts.nameLabel} value={draft.name}
              onChange={(e) => setDraftField('name', e.target.value)}
              fullWidth size="small" autoComplete="name" />
            <TextField label={zhCN.contacts.phoneLabel} value={draft.phone}
              onChange={(e) => setDraftField('phone', e.target.value)}
              fullWidth size="small" type="tel" />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSubmit}
                disabled={!draft.name.trim() || !draft.phone.trim()}>
                {editingId ? zhCN.contacts.saveContact : zhCN.contacts.addContact}
              </Button>
              {editingId && (
                <Button variant="text" onClick={cancelEdit}>{zhCN.contacts.cancelEdit}</Button>
              )}
              {!editingId && draft.name && (
                <Button variant="text" onClick={clearDraft}>{zhCN.contacts.clearForm}</Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <EmptyState message={zhCN.contacts.empty} />
      ) : (
        <Stack spacing={1}>
          {list.map((contact) => (
            <Card key={contact.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle2">{contact.name}</Typography>
                <Typography variant="body2" color="text.secondary">{contact.phone}</Typography>
                <Stack direction="row" spacing={0.5} mt={1}>
                  <Button size="small" variant="contained" onClick={() => fillBoth(contact.phone)}>
                    <PhoneIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <SmsIcon fontSize="small" />
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => fillCall(contact.phone)}>
                    {zhCN.contacts.fillCallOnly}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => fillSms(contact.phone)}>
                    {zhCN.contacts.fillSmsOnly}
                  </Button>
                  <IconButton size="small" onClick={() => startEdit(contact.id)} color="default">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => deleteContact(contact.id)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}