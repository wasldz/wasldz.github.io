// ============================================
// 🏢 بيانات المؤسسات الثابتة
// INSTITUTIONS_DATA + getCenterName + Departments passwords
// ============================================

// 💾 بيانات اعتماد المصالح الثابتة (كلمات السر ثابتة)
const DEPARTMENT_CREDENTIALS = {
  "suivi_formation": { password: "878789", departmentId: "dept1", name: "مصلحة متابعة التكوين والتعليم المهنيين" },
  "suivi_investissement": { password: "5678", departmentId: "dept2", name: "مكتب متابعة مشاريع الإستثمار" },
  "suivi_presentiel": { password: "9012", departmentId: "dept3", name: "مصلحة متابعة التكوين الحضوري" },
  "suivi_themeen": { password: "3456", departmentId: "dept4", name: "مصلحة متابعة التمهين" },
  "suivi_certificats": { password: "7890", departmentId: "dept5", name: "مصلحة متابعة الشهادات" },
  "admin_finance": { password: "1111", departmentId: "dept6", name: "مصلحة الإدارة والمالية والوسائل" },
  "secretariat_directeur": { password: "20262026", departmentId: "dept7", name: "مكتب أمانة المدير" }
};



// 💾 المصالح الأساسية (القائمة الثابتة)
const DEPARTMENTS_BASE = [
  { id: "dept1", name: "مصلحة متابعة التكوين والتعليم المهنيين", type: "متابعة التكوين", manager: "مسؤول التكوين" },
  { id: "dept2", name: "مكتب متابعة مشاريع الإستثمار", type: "مشاريع الإستثمار", manager: "مسؤول الإستثمار" },
  { id: "dept3", name: "مصلحة متابعة التكوين الحضوري", type: "التكوين الحضوري", manager: "مسؤول التكوين الحضوري" },
  { id: "dept4", name: "مصلحة متابعة التمهين", type: "التمهين", manager: "مسؤول التمهين" },
  { id: "dept5", name: "مصلحة متابعة الشهادات", type: "الشهادات", manager: "مسؤول الشهادات" },
  { id: "dept6", name: "مصلحة الإدارة والمالية والوسائل", type: "الإدارة والمالية", manager: "مسؤول الإدارة" },
  { id: "dept7", name: "مكتب أمانة المدير", type: "الأمانة", manager: "أمين المدير" }
];



// 💾 البيانات الأساسية
let MASTER_PASSWORD = "1996";
let currentRole = null;
let currentDepartment = null;
let activeIssues = [];
let archivedIssues = [];
let fileTypes = [];
let centerIssues = [];
let centerArchived = [];
let departments = [];
let analyticsChartInstance = null;
let deptChartInstance = null;
let currentChatCode = null;
let pendingAttachment = null;
let pendingCenterFile = null;
let interChatMessages = [];
let interChatPendingAttachment = null;
let notifiedMessages = new Set();
let broadcastTarget = 'all';
let isSyncing = false;
let lastSyncTimestamp = 0;
let auditLog = [];
let isMuted = false;
let trendChartInstance = null;

// دالة تأخير التنفيذ (لتحسين الأداء عند البحث)
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}



