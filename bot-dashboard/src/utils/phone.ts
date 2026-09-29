// src/utils/phone.ts
import { CrmClient, Contact } from '@/lib/api';

/**
 * Resolves a client's usable phone number with intelligent fallbacks:
 * 1. client.phone
 * 2. client.secondary_phone
 * 3. contact.platform_user_id (if contact.platform === 'whatsapp' or numeric)
 * 4. client.platform_user_id (if source === 'whatsapp' or numeric)
 */
export function resolveClientPhone(
  client?: Partial<CrmClient> | null,
  contact?: Partial<Contact> | null
): string | null {
  if (client?.phone && client.phone.trim().length > 0) {
    return client.phone.trim();
  }
  if (client?.secondary_phone && client.secondary_phone.trim().length > 0) {
    return client.secondary_phone.trim();
  }

  // If contact is from WhatsApp, platform_user_id is the phone number
  if (contact?.platform?.toLowerCase() === 'whatsapp' && contact.platform_user_id) {
    const cleaned = contact.platform_user_id.replace(/@.*$/, '').trim();
    if (/^\+?\d{7,15}$/.test(cleaned.replace(/[\s-]/g, ''))) {
      return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }
    return contact.platform_user_id;
  }

  // If client source is WhatsApp, platform_user_id is the phone number
  if (client?.source?.toLowerCase() === 'whatsapp' && client.platform_user_id) {
    const cleaned = client.platform_user_id.replace(/@.*$/, '').trim();
    if (/^\+?\d{7,15}$/.test(cleaned.replace(/[\s-]/g, ''))) {
      return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }
    return client.platform_user_id;
  }

  // Check if contact platform_user_id is an international phone number (7-15 digits)
  if (contact?.platform_user_id) {
    const cleaned = contact.platform_user_id.replace(/@.*$/, '').trim();
    if (/^\+?\d{7,15}$/.test(cleaned.replace(/[\s-]/g, ''))) {
      return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }
  }

  // Check if client platform_user_id is an international phone number (7-15 digits)
  if (client?.platform_user_id) {
    const cleaned = client.platform_user_id.replace(/@.*$/, '').trim();
    if (/^\+?\d{7,15}$/.test(cleaned.replace(/[\s-]/g, ''))) {
      return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }
  }

  return null;
}

/**
 * Clean phone number for WhatsApp wa.me links
 */
export function getWhatsAppNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Format phone number with clean spacing for readability
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s-]/g, '');

  // UAE: +971 5X XXX XXXX (or 05X XXX XXXX)
  if (/^\+?971(5\d)(\d{3})(\d{4})$/.test(cleaned)) {
    return cleaned.replace(/^\+?971(5\d)(\d{3})(\d{4})$/, '+971 $1 $2 $3');
  }
  if (/^0?(5\d)(\d{3})(\d{4})$/.test(cleaned)) {
    return cleaned.replace(/^0?(5\d)(\d{3})(\d{4})$/, '+971 $1 $2 $3');
  }
  // Egypt: +20 1X XXXX XXXX
  if (/^\+?20(1\d)(\d{4})(\d{4})$/.test(cleaned)) {
    return cleaned.replace(/^\+?20(1\d)(\d{4})(\d{4})$/, '+20 $1 $2 $3');
  }
  // Saudi: +966 5X XXX XXXX
  if (/^\+?966(5\d)(\d{3})(\d{4})$/.test(cleaned)) {
    return cleaned.replace(/^\+?966(5\d)(\d{3})(\d{4})$/, '+966 $1 $2 $3');
  }

  // Generic 10-13 digit international formatting
  if (/^\+(\d{1,3})(\d{3})(\d{3})(\d{3,4})$/.test(cleaned)) {
    return cleaned.replace(/^\+(\d{1,3})(\d{3})(\d{3})(\d{3,4})$/, '+$1 $2 $3 $4');
  }

  return phone;
}
