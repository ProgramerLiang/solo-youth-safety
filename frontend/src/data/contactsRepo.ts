import { storage } from './storage'
import type { Contact } from '../types'

export const CONTACTS_KEY = 'safety_v2_contacts'

export async function loadContacts(): Promise<Contact[]> {
  return (await storage.getJson<Contact[]>(CONTACTS_KEY)) ?? []
}

export async function saveContacts(contacts: Contact[]): Promise<void> {
  await storage.setJson(CONTACTS_KEY, contacts)
}