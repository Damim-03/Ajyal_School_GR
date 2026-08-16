import { createRoot } from "react-dom/client";
import "./index.css";
import { StudentCardBack, StudentCardFront } from "./modules/students/StudentCard";
import { useSchoolStore } from "./core/stores/school.store";
import type { Enrollment, Student } from "./modules/students/student.api";

useSchoolStore.setState({
  settings: {
    "school.name_ar": "مركز أجيال التعليمي",
    "school.name_en": "Ajyal Learning Center",
    "school.brand_color": "#0f5f8a",
    "school.address": "حي النصر، قسنطينة",
    "school.phone": "0555 12 34 56",
    "school.logo_path": "",
  },
  configured: [],
  loaded: true,
});

const student = {
  id: "x",
  studentNumber: "2026000147",
  firstName: "محمد الأمين",
  lastName: "بن عبد الرحمان",
  gender: "MALE",
  birthDate: "2011-07-31T00:00:00.000Z",
  avatar: null,
  phone: null,
  parentPhone: "0555112233",
  address: null,
  schoolName: null,
  emergencyPhone: null,
  registrationDate: "2026-08-15T00:00:00.000Z",
  note: null,
  isActive: true,
} as Student;

const enrollments = [
  {
    id: "e1",
    enrolledAt: "2026-08-15T00:00:00.000Z",
    isActive: true,
    teachingAssignment: {
      id: "t1",
      isActive: true,
      subject: { id: "s", name: "الإنجليزية", code: null },
      teacher: { id: "te", firstName: "نزيهة", lastName: "كير" },
      studyGroup: {
        id: "g",
        name: "الفوج 1",
        type: "NORMAL",
        level: {
          id: "l",
          name: "أولى متوسط",
          educationStage: { id: "st", name: "التعليم المتوسط", type: "MIDDLE" },
        },
      },
      academicYear: { id: "y", name: "2026-2027", isCurrent: true },
    },
    _count: { invoices: 0, attendances: 0 },
  },
] as Enrollment[];

const female = { ...student, gender: "FEMALE", firstName: "نور الهدى", lastName: "مسعودي" } as Student;

const long = {
  ...student,
  firstName: "عبد الرحمان الطيّب",
  lastName: "بن عبد القادر الزهراني",
} as Student;

createRoot(document.getElementById("root")!).render(
  <div style={{ background: "#111827", padding: 24, display: "grid", gap: 24, justifyItems: "start" }}>
    <div id="front"><StudentCardFront student={student} enrollments={enrollments} /></div>
    <div id="back"><StudentCardBack /></div>
    <div id="front-f"><StudentCardFront student={female} enrollments={null} /></div>
    <div id="front-long"><StudentCardFront student={long} enrollments={enrollments} /></div>
    <div id="sheet" className="sheet-preview" style={{ background: "#fff" }}>
      <CardSheetProbe />
    </div>
  </div>,
);

/* الورقة كما تخرج — نفس ترميز StudentCardPanel، لفحص الاتّساع في A4 */
function CardSheetProbe() {
  return (
    <div className="sheet-print">
      <div className="sheet-page">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10mm", alignItems: "flex-start", paddingTop: "6mm" }}>
          <div style={{ padding: "1mm", border: "0.2mm dashed #9ca3af", width: "calc(85.6mm + 2.4mm)", height: "calc(54mm + 2.4mm)", boxSizing: "border-box" }}>
            <StudentCardFront student={student} enrollments={enrollments} />
          </div>
          <div style={{ padding: "1mm", border: "0.2mm dashed #9ca3af", width: "calc(85.6mm + 2.4mm)", height: "calc(54mm + 2.4mm)", boxSizing: "border-box" }}>
            <StudentCardBack />
          </div>
        </div>
      </div>
    </div>
  );
}
