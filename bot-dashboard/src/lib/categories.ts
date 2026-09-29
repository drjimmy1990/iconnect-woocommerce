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

export const CONVERSATION_STAGE_CONFIG: Record<
  string,
  { label: string; labelAr: string; color: string; emoji: string; step: number; description: string }
> = {
  first_contact: {
    label: 'First Contact',
    labelAr: 'تواصل أول',
    color: '#3b82f6',
    emoji: '👋',
    step: 1,
    description: 'Initial greeting & inquiry',
  },
  browsing: {
    label: 'Browsing',
    labelAr: 'تصفح المنتجات',
    color: '#8b5cf6',
    emoji: '🔍',
    step: 2,
    description: 'Exploring catalog & options',
  },
  product_viewed: {
    label: 'Product Viewed',
    labelAr: 'معاينة منتج',
    color: '#f59e0b',
    emoji: '📦',
    step: 3,
    description: 'Looking at specific products',
  },
  order_placed: {
    label: 'Order Placed',
    labelAr: 'طلب قيد التنفيذ',
    color: '#06b6d4',
    emoji: '🛒',
    step: 4,
    description: 'Checkout started / draft order',
  },
  purchased: {
    label: 'Purchased',
    labelAr: 'تم الشراء',
    color: '#10b981',
    emoji: '✅',
    step: 5,
    description: 'Completed WooCommerce order',
  },
  support: {
    label: 'Support',
    labelAr: 'دعم فني',
    color: '#6366f1',
    emoji: '🎧',
    step: 6,
    description: 'After-sale care & assistance',
  },
};

export function getCategoryMeta(tagOrCategory: string): ProductCategory | null {
  const normalized = tagOrCategory.trim().toLowerCase();
  return (
    PRODUCT_CATEGORIES.find(
      (c) => c.id.toLowerCase() === normalized || c.name.toLowerCase() === normalized || c.nameAr === tagOrCategory
    ) || null
  );
}

