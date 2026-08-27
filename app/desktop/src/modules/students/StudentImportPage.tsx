import { ImportScreen } from "../../features/import/ImportScreen";

/**
 * استيرادُ الطلبة — في محورهم.
 *
 * غلافٌ رقيق: الشاشةُ واحدةٌ للنوعين لأنّ العملَ واحد، والموضعُ
 * يفترق لأنّ الموظّف يبحث عن استيراد الطلبة حيث يجد الطلبة.
 */
export default function StudentImportPage() {
  return <ImportScreen kind="students" />;
}
