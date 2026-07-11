// ============================================
// 🔧 ثوابت التطبيق
// منصة التنسيق الرقمي - الجزائر
// ============================================

const LS_KEYS = {
  theme: 'fares_theme',
  remember: 'fares_remember',
  session: 'fares_session',
  mute: 'fares_mute',
  password: 'fares_pwd'
};

const ROLES = {
  DIRECTORATE: 'directorate',
  CENTER: 'center',
  DEPARTMENT: 'department'
};

const ISSUE_PRIORITIES = {
  URGENT: { value: 'urgent', label: 'عاجل', class: 'pill-urgent' },
  MEDIUM: { value: 'medium', label: 'متوسط', class: 'pill-medium' },
  NORMAL: { value: 'normal', label: 'عادي', class: 'pill-normal' }
};

const ISSUE_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  ARCHIVED: 'archived'
};

const STATUS_LABELS = {
  pending: 'قيد المعالجة',
  resolved: 'تم الحل',
  archived: 'مؤرشف'
};

const MEET_STATUS = {
  LIVE: 'live',
  WAITING: 'waiting',
  ENDED: 'ended'
};

const CHAT_TYPES = {
  DIRECTORATE: 'directorate',
  CENTER: 'center',
  INTER: 'inter'
};
