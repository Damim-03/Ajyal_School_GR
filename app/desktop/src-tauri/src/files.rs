use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;

/// كتابةُ ملفٍّ اختار المستخدمُ موضعَه بنفسه.
///
/// المسارُ يجيء من حوار الحفظ (`tauri-plugin-dialog`) لا من الواجهة،
/// فالمستخدم هو من عيّنه. ولذلك لا حاجة إلى إذن `fs` واسعٍ يفتح القرص
/// كلَّه للواجهة: أمرٌ واحدٌ يكتب حيث أشار المستخدم، ولا شيء غيره.
///
/// والبايتات تعبر الجسر **مُرمَّزةً base64** كما في `printing.rs`:
/// مصفوفةُ أرقامٍ في JSON تضاعف الحجمَ أضعافاً وتُثقل التسلسل.
#[tauri::command]
pub fn save_file(path: String, data: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(data)
        .map_err(|e| format!("تعذّر فكّ ترميز البيانات: {e}"))?;

    fs::write(&path, bytes).map_err(|e| format!("تعذّرت الكتابة في {path}: {e}"))
}
