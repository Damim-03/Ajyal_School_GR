/* فحصُ مقاسات شهادة العمل — يُفتح على /__certcheck.html بلا خادم ولا دخول */
import { createRoot } from "react-dom/client";
import "./index.css";
import { EmploymentCertificate } from "./modules/teachers/EmploymentCertificate";
import { useSchoolStore } from "./core/stores/school.store";
import type { TeacherDetail } from "./modules/teachers/teachers.api";

useSchoolStore.setState({
  settings: {
    "school.name_ar": "مركز أجيال التعليمي",
    "school.name_en": "Ajyal Learning Center",
    "school.brand_color": "#0f5f8a",
    "school.logo_path": "",
  },
  configured: [],
  loaded: true,
});

const assignment = (id: string, subject: string, level: string, group: string) => ({
  id,
  isActive: true,
  subject: { id: `s${id}`, name: subject },
  studyGroup: { id: `g${id}`, name: group, level: { id: "l1", name: level } },
  academicYear: { id: "y1", name: "2026-2027", isCurrent: true },
});

const teacher: TeacherDetail = {
  id: "t1",
  firstName: "محمد الأمين",
  lastName: "بن عبد الرحمان",
  email: "amine@ajyal.dz",
  phone: "0555112233",
  gender: "MALE",
  avatar: null,
  birthDate: "1988-03-12T00:00:00.000Z",
  hireDate: "2019-09-01T00:00:00.000Z",
  specialization: "الرياضيات",
  qualification: "ماستر في الرياضيات",
  isActive: true,
  createdAt: "2019-09-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  address: "حي النصر، قسنطينة",
  salary: 45000,
  teachingAssignments: [
    assignment("1", "الرياضيات", "أولى متوسط", "فوج أ"),
    assignment("2", "الرياضيات", "ثانية متوسط", "فوج ب"),
    assignment("3", "الفيزياء", "ثالثة متوسط", "فوج ج"),
    assignment("4", "الرياضيات", "رابعة متوسط", "فوج د"),
  ],
  _count: { teachingAssignments: 4 },
};

const documents = [
  { label: "صورة شمسية", at: "01/09/2019" },
  { label: "بطاقة التعريف الوطنية", at: "01/09/2019" },
  { label: "الشهادة العلمية", at: "03/09/2019" },
  { label: "شهادة الميلاد", at: "03/09/2019" },
  { label: "صحيفة السوابق العدلية", at: "10/09/2019" },
  { label: "شهادة الخبرة", at: "12/10/2021" },
];

/* صورةٌ صغيرة مضمَّنة — لفحص الإطار مملوءاً */
const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#c9d3dd"/><circle cx="150" cy="150" r="70" fill="#8fa3b5"/><rect x="60" y="250" width="180" height="150" rx="70" fill="#8fa3b5"/></svg>`,
  );

createRoot(document.getElementById("root")!).render(
  <div style={{ padding: 24, background: "#0d1420" }}>
    <div className="sheet-preview" style={{ "--sheet-zoom": 1 } as React.CSSProperties}>
      <EmploymentCertificate
        teacher={teacher}
        assignments={teacher.teachingAssignments}
        documents={documents}
        academicYear="2026-2027"
        photo={PHOTO}
      />
    </div>

    {/* أثقلُ حالٍ محتمل — اثنا عشرَ إسناداً واثنتا عشرةَ وثيقة */}
    <div className="sheet-preview" style={{ "--sheet-zoom": 1 } as React.CSSProperties}>
      <EmploymentCertificate
        teacher={{
          ...teacher,
          teachingAssignments: Array.from({ length: 12 }, (_, i) =>
            assignment(String(i + 10), "الرياضيات", "رابعة متوسط", `فوج ${i + 1}`),
          ),
        }}
        assignments={Array.from({ length: 12 }, (_, i) =>
          assignment(String(i + 10), "الرياضيات", "رابعة متوسط", `فوج ${i + 1}`),
        )}
        documents={Array.from({ length: 12 }, (_, i) => ({
          label: `وثيقة رقم ${i + 1}`,
          at: "01/09/2019",
        }))}
        academicYear="2026-2027"
        photo={PHOTO}
      />
    </div>

    <div
      id="empty-photo"
      className="sheet-preview"
      style={{ "--sheet-zoom": 1 } as React.CSSProperties}
    >
      <EmploymentCertificate
        teacher={{ ...teacher, gender: "FEMALE", qualification: null, specialization: null }}
        assignments={[]}
        documents={[]}
        academicYear="2026-2027"
      />
    </div>
  </div>,
);
