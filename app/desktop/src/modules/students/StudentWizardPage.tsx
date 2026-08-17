import { useNavigate } from "react-router-dom";

import { AppHeader } from "../../components/AppHeader";
import { PATHS } from "../../routes/paths";
import { StudentRegisterDialog } from "./StudentRegisterDialog";

/**
 * مسار تسجيل الطالب — غلافُ نافذةٍ لا شاشةُ نموذج.
 *
 * التسجيل نفسُه صار نافذةً مركزية (`StudentRegisterDialog`) كبقية
 * نماذج النظام، ويُفتح من زرّ «طالب جديد» في قائمة الطلبة. وهذا
 * المسار باقٍ لأنّ بطاقة «تسجيل طالب جديد» في محور الطلبة تشير إليه،
 * ولأنّ عنواناً محفوظاً لا يجوز أن ينكسر — فيعرض النافذةَ نفسَها فوق
 * خلفية التطبيق، والإغلاق يمضي إلى قائمة الطلبة.
 *
 * ونسختان من النموذج كانتا ستفترقان عند أوّل حقلٍ يُضاف إلى إحداهما:
 * الطور والمستوى أُضيفا في `StudentFields` وحدها فوصلا إلى الاثنتين.
 */
export default function StudentWizardPage() {
  const navigate = useNavigate();
  const toList = () => navigate(PATHS.students);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="تسجيل طالب جديد" subtitle="المعلومات ثمّ الوثائق" />
      <StudentRegisterDialog onClose={toList} />
    </div>
  );
}
