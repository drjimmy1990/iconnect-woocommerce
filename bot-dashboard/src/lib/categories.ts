// src/lib/categories.ts

export interface ProductCategory {
  id: string;
  name: string;
  nameAr: string;
  emoji: string;
  color: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 'Computers & Computing', name: 'Computers & Computing', nameAr: 'أجهزة الحاسب واللابتوبات', emoji: '💻', color: '#2563eb' },
  { id: 'Printers & Scanners', name: 'Printers & Scanners', nameAr: 'الطابعات والماسحات الضوئية', emoji: '🖨️', color: '#0284c7' },
  { id: 'Ink, Toner & Printing Supplies', name: 'Ink & Printing Supplies', nameAr: 'الأحبار ومستلزمات الطباعة', emoji: '🖋️', color: '#0d9488' },
  { id: 'Networking & Connectivity', name: 'Networking & Connectivity', nameAr: 'الشبكات والاتصالات', emoji: '🌐', color: '#059669' },
  { id: 'CCTV & Surveillance', name: 'CCTV & Surveillance', nameAr: 'كاميرات المراقبة والأمن', emoji: '📹', color: '#dc2626' },
  { id: 'Access Control Systems', name: 'Access Control Systems', nameAr: 'أنظمة التحكم بالدخول', emoji: '🚪', color: '#ea580c' },
  { id: 'Security & Alarm Systems', name: 'Security & Alarm Systems', nameAr: 'أنظمة الإنذار والحماية', emoji: '🚨', color: '#d97706' },
  { id: 'IP Telephony & Communication', name: 'IP Telephony & VoIP', nameAr: 'السنترالات والهواتف الشبكية', emoji: '☎️', color: '#7c3aed' },
  { id: 'Time Attendance & Biometric Systems', name: 'Time & Attendance', nameAr: 'أجهزة البصمة والحضور', emoji: '👆', color: '#4f46e5' },
  { id: 'Power & Electrical Protection', name: 'Power & Electrical (UPS)', nameAr: 'الحماية الكهربائية والـ UPS', emoji: '⚡', color: '#ca8a04' },
  { id: 'Storage & Backup', name: 'Storage & Backup', nameAr: 'وحدات التخزين والنسخ الاحتياطي', emoji: '💾', color: '#475569' },
];

export const CLIENT_STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; emoji: string }> = {
  new: { label: 'New', labelAr: 'جديد', color: '#64748b', emoji: '🆕' },
  interested: { label: 'Interested', labelAr: 'مهتم', color: '#2563eb', emoji: '👀' },
  customer: { label: 'Customer', labelAr: 'عميل', color: '#16a34a', emoji: '🛒' },
  repeat_customer: { label: 'Repeat', labelAr: 'متكرر', color: '#7c3aed', emoji: '🔄' },
  support: { label: 'Support', labelAr: 'دعم', color: '#d97706', emoji: '🎧' },
  inactive: { label: 'Inactive', labelAr: 'غير نشط', color: '#dc2626', emoji: '💤' },
};

export function getCategoryMeta(tagOrCategory: string): ProductCategory | null {
  const normalized = tagOrCategory.trim().toLowerCase();
  return (
    PRODUCT_CATEGORIES.find(
      (c) => c.id.toLowerCase() === normalized || c.name.toLowerCase() === normalized || c.nameAr === tagOrCategory
    ) || null
  );
}
