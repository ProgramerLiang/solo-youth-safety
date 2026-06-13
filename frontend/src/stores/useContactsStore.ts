import { create } from 'zustand'
import { loadContacts, saveContacts } from '../data/contactsRepo'
import type { Contact } from '../types'

interface ContactsState {
  list: Contact[]
  editingId: string | null
  draft: { name: string; phone: string }
  loaded: boolean

  initialize: () => Promise<void>
  startEdit: (id: string) => void
  cancelEdit: () => void
  setDraftField: <K extends keyof Contact>(key: K, value: string) => void
  clearDraft: () => void
  add: (name: string, phone: string) => Promise<void>
  update: (id: string, name: string, phone: string) => Promise<void>
  deleteContact: (id: string) => Promise<void>
}

function makeId(): string {
  return `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  list: [],
  editingId: null,
  draft: { name: '', phone: '' },
  loaded: false,

  initialize: async () => {
    const list = await loadContacts()
    set({ list, loaded: true })
  },

  startEdit: (id) => {
    const contact = get().list.find((c) => c.id === id)
    if (contact) {
      set({ editingId: id, draft: { name: contact.name, phone: contact.phone } })
    }
  },

  cancelEdit: () => set({ editingId: null, draft: { name: '', phone: '' } }),

  setDraftField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),

  clearDraft: () => set({ draft: { name: '', phone: '' } }),

  add: async (name, phone) => {
    const newContact: Contact = { id: makeId(), name, phone }
    const list = [...get().list, newContact]
    await saveContacts(list)
    set({ list, draft: { name: '', phone: '' } })
  },

  update: async (id, name, phone) => {
    const list = get().list.map((c) => (c.id === id ? { ...c, name, phone } : c))
    await saveContacts(list)
    set({ list, editingId: null, draft: { name: '', phone: '' } })
  },

  deleteContact: async (id) => {
    const list = get().list.filter((c) => c.id !== id)
    await saveContacts(list)
    set({ list })
  },
}))