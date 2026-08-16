//! الكتابة إلى طابعة USB **مباشرةً** — بلا مخدّم طباعة ولا سائق.
//!
//! **لماذا وُجد هذا الملفّ.** جرّبنا ESC/POS عبر مخدّم الطباعة
//! (‏`OpenPrinter`/`WritePrinter` بنوع `RAW`) فلم تخرج ورقة، واستنتجتُ
//! أنّ البايتات الخام لا تصل الجهاز. والاستنتاج كان أوسع من الدليل:
//! ما ثبت هو أنّها لا تصل **عبر ذلك الطريق** — لأنّ منفذ الطابعة يمرّ
//! بمراقبٍ من المورّد (‏`Dynamic Print Monitor`) يبتلعها ويُبلغ نجاحاً.
//!
//! وأنظمة نقاط البيع لا تسلك ذلك الطريق أصلاً: تكتب إلى المنفذ مباشرةً.
//! وويندوز يتيح ذلك لأيّ طابعة يديرها السائق القياسي `usbprint`: تُسجَّل
//! واجهة جهاز تحت `GUID_DEVINTERFACE_USBPRINT`، تُفتح كملفّ ويُكتب فيها.
//!
//! وطابعة هذا المركز `Xprinter XP-P301G` طابعةُ إيصالاتٍ حرارية تتكلّم
//! ESC/POS أصلاً — فالطريق مفتوح واللغة موافقة.
//!
//! **منقولٌ عن SKK-GR** بعد أن أثبت نفسه هناك على عتادٍ أعند: طابعة
//! ملصقاتٍ لا تفهم ESC/POS أصلاً. وما استُخلص هناك يصحّ هنا كلُّه عدا
//! اللغة.

#![cfg(windows)]

use windows::core::{GUID, PCWSTR};
use windows::Win32::Devices::DeviceAndDriverInstallation::{
    SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInterfaces, SetupDiGetClassDevsW,
    SetupDiGetDeviceInterfaceDetailW, DIGCF_DEVICEINTERFACE, DIGCF_PRESENT,
    SP_DEVICE_INTERFACE_DATA, SP_DEVICE_INTERFACE_DETAIL_DATA_W,
};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::Storage::FileSystem::{
    CreateFileW, WriteFile, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ, FILE_SHARE_WRITE,
    OPEN_EXISTING,
};

/// ‏`GUID_DEVINTERFACE_USBPRINT` — واجهة الطابعات التي يديرها `usbprint`.
const USBPRINT: GUID = GUID::from_values(
    0x28d78fad,
    0x5a12,
    0x11d1,
    [0xae, 0x5b, 0x00, 0x00, 0xf8, 0x03, 0xa8, 0xc2],
);

/// مسارات أجهزة الطابعات المتاحة للكتابة المباشرة.
///
/// المسار من شكل `\\?\usb#vid_0483&pid_5743#...#{28d78fad-...}` — يُفتح
/// بـ`CreateFileW` كأيّ ملفّ.
pub fn list_devices() -> Result<Vec<String>, String> {
    unsafe {
        let set = SetupDiGetClassDevsW(
            Some(&USBPRINT),
            PCWSTR::null(),
            None,
            DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
        )
        .map_err(|e| format!("تعذّر سرد أجهزة الطابعات: {e}"))?;

        let mut out = Vec::new();
        let mut index = 0u32;
        loop {
            let mut iface = SP_DEVICE_INTERFACE_DATA {
                cbSize: std::mem::size_of::<SP_DEVICE_INTERFACE_DATA>() as u32,
                ..Default::default()
            };
            if SetupDiEnumDeviceInterfaces(set, None, &USBPRINT, index, &mut iface).is_err() {
                break; // لا مزيد من الواجهات
            }
            index += 1;

            // النداء الأول يطلب الحجم — يفشل بـ ERROR_INSUFFICIENT_BUFFER عقداً.
            let mut needed = 0u32;
            let _ = SetupDiGetDeviceInterfaceDetailW(set, &iface, None, 0, Some(&mut needed), None);
            if needed == 0 {
                continue;
            }

            /*
             * المخزن يُحاذى كبنية `..._DETAIL_DATA_W` لا كبايتات حرّة:
             * الحقل `DevicePath` مصفوفة مرنة تلي `cbSize`، وويندوز يقرأ
             * ‏`cbSize` ليعرف بداية المسار. محاذاةٌ خاطئة تُنتج مساراً
             * مقطوعاً — وهو عطلٌ يعمل بالصدفة على معماريةٍ ويفشل على أخرى.
             */
            let mut buf = vec![0u8; needed as usize];
            let detail = buf.as_mut_ptr() as *mut SP_DEVICE_INTERFACE_DETAIL_DATA_W;
            // ‏6 على 32-بت و8 على 64-بت — حجم `cbSize` مع الحشو.
            (*detail).cbSize = std::mem::size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32;

            if SetupDiGetDeviceInterfaceDetailW(
                set,
                &iface,
                Some(detail),
                needed,
                None,
                None,
            )
            .is_err()
            {
                continue;
            }

            let path_ptr = std::ptr::addr_of!((*detail).DevicePath) as *const u16;
            let mut len = 0usize;
            while *path_ptr.add(len) != 0 {
                len += 1;
            }
            let path = String::from_utf16_lossy(std::slice::from_raw_parts(path_ptr, len));
            if !path.is_empty() {
                out.push(path);
            }
        }

        let _ = SetupDiDestroyDeviceInfoList(set);
        Ok(out)
    }
}

/// يكتب البايتات إلى جهاز الطابعة مباشرةً.
///
/// يُعيد وصفاً يذكر ما كُتب فعلاً — لا مجرّد «نجح». الفرق بينهما هو ما
/// أضاعنا سابقاً: المخدّم كان يُبلغ نجاحاً وهو يبتلع البايتات.
pub fn write(device_path: &str, data: &[u8]) -> Result<String, String> {
    if data.is_empty() {
        return Err("لا بيانات للطباعة".into());
    }
    let wide: Vec<u16> = device_path
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let h: HANDLE = CreateFileW(
            PCWSTR(wide.as_ptr()),
            0x4000_0000, // GENERIC_WRITE
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            None,
        )
        .map_err(|e| format!("تعذّر فتح جهاز الطابعة: {e}"))?;

        let t0 = std::time::Instant::now();
        let mut sent = 0usize;
        let result = (|| -> Result<(), String> {
            while sent < data.len() {
                let mut wrote = 0u32;
                WriteFile(h, Some(&data[sent..]), Some(&mut wrote), None)
                    .map_err(|e| format!("فشلت الكتابة بعد {sent} بايت: {e}"))?;
                if wrote == 0 {
                    return Err(format!("الجهاز توقّف عن الاستقبال بعد {sent} بايت"));
                }
                sent += wrote as usize;
            }
            Ok(())
        })();

        let _ = CloseHandle(h);
        result?;
        Ok(format!(
            "كُتب {sent} بايت مباشرةً إلى الجهاز في {}ms (بلا مخدّم طباعة)",
            t0.elapsed().as_millis()
        ))
    }
}
