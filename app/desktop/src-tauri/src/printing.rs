//! الطباعة المباشرة — بلا نافذة ويندوز.
//!
//! `window.print()` في WebView2 يفتح حوار النظام دائماً، ويطبع بمقاسه هو
//! لا بمقاس المعاينة: يُصغّر الصفحة ليُدخلها في هوامشه، ويكتب في الهامش
//! عنوانَ النافذة والرابط والتاريخ. فتخرج الورقة غير التي رآها المستخدم.
//!
//! و WebView2 يملك طباعةً صامتة منذ SDK 1.0.1518: `ICoreWebView2_16::Print`
//! تأخذ `ICoreWebView2PrintSettings` فتطبع مباشرةً بالإعدادات المعطاة —
//! وهي ما يجعل «ما تراه هو ما يخرج» صحيحاً حرفياً: مقاس A4 أفقي، وتصغير
//! 1.0، وهوامش صفر، وبلا ترويسة ولا تذييل.
//!
//! والملفّ كلّه محصورٌ بـ`cfg(windows)`: البرنامج يعمل على ويندوز، وواجهة
//! `print_sheet` تبقى موجودة على غيره لترجع خطأً مفهوماً بدل ألّا تُترجم.

#[cfg(windows)]
mod imp {
  use std::sync::mpsc::channel;

  use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment6, ICoreWebView2PrintSettings2, ICoreWebView2_16,
    COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE, COREWEBVIEW2_PRINT_STATUS_SUCCEEDED,
  };
  use webview2_com::PrintCompletedHandler;
  use windows::core::{Interface, HSTRING, PCWSTR, PWSTR};
  use windows::Win32::Graphics::Printing::{
    EnumPrintersW, GetDefaultPrinterW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
    PRINTER_INFO_4W,
  };

  /// مقاس A4 بالبوصة — وحدة `ICoreWebView2PrintSettings`.
  const A4_LONG_IN: f64 = 11.693;
  const A4_SHORT_IN: f64 = 8.268;

  /// حدٌّ أدنى يمنع مقاساً صفرياً أو سالباً من المستدعي.
  const MIN_PAGE_IN: f64 = 0.5;

  pub fn printers() -> Result<Vec<String>, String> {
    unsafe {
      let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
      let mut needed = 0u32;
      let mut returned = 0u32;

      // النداء الأول يقيس، والثاني يملأ — عادةُ Win32 في القوائم.
      let _ = EnumPrintersW(flags, None, 4, None, &mut needed, &mut returned);

      if needed == 0 {
        return Ok(Vec::new());
      }

      // المخزن `u64` لا `u8`: ويندوز يكتب فيه `PRINTER_INFO_4W` وهي
      // بنيةٌ تحتاج محاذاة ثماني بايتات، و`Vec<u8>` لا يضمنها. القراءة
      // من عنوانٍ غير محاذٍ سلوكٌ غير معرَّف وإن عملت أحياناً.
      let mut aligned = vec![0u64; (needed as usize).div_ceil(8)];

      let bytes = std::slice::from_raw_parts_mut(
        aligned.as_mut_ptr() as *mut u8,
        aligned.len() * 8,
      );

      EnumPrintersW(flags, None, 4, Some(bytes), &mut needed, &mut returned)
        .map_err(|e| format!("تعذّر سرد الطابعات: {e}"))?;

      let entries = std::slice::from_raw_parts(
        aligned.as_ptr() as *const PRINTER_INFO_4W,
        returned as usize,
      );

      Ok(
        entries
          .iter()
          .filter_map(|entry| entry.pPrinterName.to_string().ok())
          .collect(),
      )
    }
  }

  pub fn default_printer() -> Option<String> {
    unsafe {
      // النداء الأول يقيس الطول، والثاني يكتب — و`BOOL` هنا لا `Result`.
      let mut len = 0u32;
      let _ = GetDefaultPrinterW(None, &mut len);

      if len == 0 {
        return None;
      }

      let mut buffer = vec![0u16; len as usize];

      if GetDefaultPrinterW(Some(PWSTR(buffer.as_mut_ptr())), &mut len)
        .ok()
        .is_err()
      {
        return None;
      }

      // الطول يشمل الصفر الختامي
      Some(String::from_utf16_lossy(
        &buffer[..(len as usize).saturating_sub(1)],
      ))
    }
  }

  /// يطبع محتوى الـwebview الحالي مباشرةً إلى الطابعة.
  ///
  /// الإعدادات صريحةٌ كلُّها لأنّ الصمت هنا يعني ألّا يسأل أحدٌ المستخدم:
  /// ما لا يُضبط يأخذ افتراضَ النظام، وافتراضُه «تصغيرٌ ليناسب» وترويسةٌ
  /// في الهامش — وهما بالضبط ما جاءت هذه الوحدة لإلغائه.
  pub fn print(
    webview: &tauri::webview::PlatformWebview,
    printer: Option<String>,
    landscape: bool,
    page: Option<(f64, f64)>,
  ) -> Result<(), String> {
    unsafe {
      let core = webview
        .controller()
        .CoreWebView2()
        .map_err(|e| format!("تعذّر بلوغ WebView2: {e}"))?;

      let core16: ICoreWebView2_16 = core
        .cast()
        .map_err(|_| "نسخة WebView2 على هذا الجهاز أقدم من أن تدعم الطباعة الصامتة".to_string())?;

      let environment: ICoreWebView2Environment6 = webview
        .environment()
        .cast()
        .map_err(|_| "بيئة WebView2 لا تدعم إعدادات الطباعة".to_string())?;

      let settings = environment
        .CreatePrintSettings()
        .map_err(|e| format!("تعذّر إنشاء إعدادات الطباعة: {e}"))?;

      let orientation = if landscape {
        COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
      } else {
        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
      };

      // مقاس الصفحة من المستدعي إن أعطاه، وإلّا A4.
      //
      // الإيصال الحراري ليس A4: عرضه 72 أو 80 مم وطولُه بطول ما طُبع.
      // وفرضُ A4 عليه يُخرج شريطاً طوله ثلاثون سنتيمتراً أكثرُه أبيض،
      // أو يُقصّ المحتوى إن كان العرض أضيق. فالواجهة تقيس الورقة
      // المعروضة وتُرسل مقاسها، والافتراض يبقى A4 لأوراق الكشوف.
      let (width, height) = match page {
        Some((w, h)) if w >= MIN_PAGE_IN && h >= MIN_PAGE_IN => (w, h),
        _ if landscape => (A4_LONG_IN, A4_SHORT_IN),
        _ => (A4_SHORT_IN, A4_LONG_IN),
      };

      let apply = || -> windows::core::Result<()> {
        settings.SetOrientation(orientation)?;
        settings.SetPageWidth(width)?;
        settings.SetPageHeight(height)?;
        // التصغير 1.0: الورقة تخرج بمقاسها في المعاينة لا «مناسبةً للصفحة»
        settings.SetScaleFactor(1.0)?;
        settings.SetMarginTop(0.0)?;
        settings.SetMarginBottom(0.0)?;
        settings.SetMarginLeft(0.0)?;
        settings.SetMarginRight(0.0)?;
        settings.SetShouldPrintBackgrounds(true)?;
        // بلا عنوان نافذةٍ ولا رابطٍ ولا تاريخٍ في الهامش
        settings.SetShouldPrintHeaderAndFooter(false)?;
        Ok(())
      };

      apply().map_err(|e| format!("تعذّر ضبط إعدادات الطباعة: {e}"))?;

      if let Some(name) = printer.filter(|n| !n.trim().is_empty()) {
        let settings2: ICoreWebView2PrintSettings2 = settings
          .cast()
          .map_err(|_| "نسخة WebView2 لا تدعم اختيار الطابعة".to_string())?;

        let wide = HSTRING::from(name.as_str());

        settings2
          .SetPrinterName(PCWSTR(wide.as_ptr()))
          .map_err(|e| format!("تعذّر اختيار الطابعة «{name}»: {e}"))?;
      }

      let (tx, rx) = channel();

      PrintCompletedHandler::wait_for_async_operation(
        Box::new(move |handler| core16.Print(&settings, &handler).map_err(Into::into)),
        Box::new(move |_hresult, status| {
          let _ = tx.send(status);
          Ok(())
        }),
      )
      .map_err(|e| format!("فشلت الطباعة: {e}"))?;

      match rx.recv() {
        Ok(status) if status == COREWEBVIEW2_PRINT_STATUS_SUCCEEDED => Ok(()),
        Ok(status) if status == COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE => {
          Err("الطابعة غير متاحة — تحقّق من تشغيلها واتصالها".to_string())
        }
        Ok(_) => Err("لم تكتمل الطباعة — راجع حالة الطابعة والورق".to_string()),
        Err(_) => Err("انقطع ردّ الطابعة".to_string()),
      }
    }
  }
}

// ======================================================================
// الطباعة الحرارية — ESC/POS إلى المنفذ مباشرةً
//
// هذا مسارٌ آخر غير الذي فوقه، ولا يشتركان في شيء:
//
//   فوق  — WebView2 يرسم الصفحة ويسلّمها لمخزن ويندوز فالسائق. صحيحُ
//          المخرَج، وزمنُه ثانيةٌ أو ثانيتان: رسمُ صفحةِ ويبٍ كاملة ثمّ
//          ترسيمُها في السائق.
//   هنا  — الإيصال يُنقَّط في الواجهة ويُرسل بايتاتٍ إلى الطابعة رأساً.
//          لا مخزنَ ولا سائق: الورقة تتحرّك أثناء وصول البايتات.
//
// والثاني للحراري وحده. أمّا A4 فيبقى على الأوّل — لا معنى لتنقيط
// ورقةٍ كاملة وإرسالها نقطةً نقطة إلى طابعة ليزر.
// ======================================================================

/// أجهزة الطابعات المفتوحة للكتابة المباشرة (مسارات `\\?\usb#…`).
#[tauri::command]
pub fn list_usb_printers() -> Result<Vec<String>, String> {
  #[cfg(windows)]
  {
    crate::usbprint::list_devices()
  }

  #[cfg(not(windows))]
  {
    Ok(Vec::new())
  }
}

/// يكتب بايتات ESC/POS إلى جهاز الطابعة **مباشرةً** — لا مخزن ولا سائق.
///
/// `device` اختياري: يُؤخذ أوّل جهازٍ متاح حين يُترك فارغاً.
///
/// **`async` وخيطٌ منفصل — وليس تجميلاً.** Tauri ينفّذ الأوامر المتزامنة
/// على الخيط الرئيسي، وكتابة الإيصال إلى المنفذ تستغرق ثواني — فتحجز
/// الخيط الذي تعمل عليه الواجهة كلّها ويتجمّد التطبيق حتى تخرج الورقة.
/// و`spawn_blocking` لا `async` وحدها: الجسم عمليّةُ إدخال/إخراج حاجبة،
/// ووضعها في `async` عادية يحجز أحد خيوط المنفّذ بدل الرئيسي — نقلٌ
/// للمشكلة لا حلٌّ لها.
#[tauri::command]
pub async fn print_usb(device: Option<String>, data: String) -> Result<String, String> {
  #[cfg(windows)]
  {
    tauri::async_runtime::spawn_blocking(move || {
      use base64::Engine;

      let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|e| format!("بيانات الطباعة غير صالحة: {e}"))?;

      let path = match device.filter(|d| !d.is_empty()) {
        Some(d) => d,
        None => crate::usbprint::list_devices()?
          .into_iter()
          .next()
          .ok_or("لا جهاز طابعة متاح للكتابة المباشرة")?,
      };

      crate::usbprint::write(&path, &bytes)
    })
    .await
    .map_err(|e| format!("تعذّر تنفيذ مهمّة الطباعة: {e}"))?
  }

  #[cfg(not(windows))]
  {
    let _ = (device, data);
    Err("الطباعة المباشرة متاحة على ويندوز وحده".to_string())
  }
}

/// فحصٌ خفيف: هل أوامر الطباعة الحرارية موجودة أصلاً في هذه الثنائيّة؟
///
/// موجودٌ لسببٍ عمليّ: حين تعمل الواجهة بثنائيّة قديمة بُنيت قبل إضافة
/// هذه الأوامر، يكون العرَض الوحيد هو **فشل الأمر** — وهو نفسه عرَض
/// عشرة أعطالٍ أخرى. هذا النداء يفصل «الثنائيّة قديمة» عمّا عداه بلا
/// أن يمسّ عتاداً.
#[tauri::command]
pub fn thermal_ready() -> bool {
  true
}

/// أسماء الطابعات المثبَّتة على هذا الجهاز.
#[tauri::command]
pub fn list_printers() -> Result<Vec<String>, String> {
  #[cfg(windows)]
  {
    imp::printers()
  }

  #[cfg(not(windows))]
  {
    Ok(Vec::new())
  }
}

/// الطابعة الافتراضية في النظام — تُختار ما لم يختر المستخدم غيرها.
#[tauri::command]
pub fn default_printer() -> Option<String> {
  #[cfg(windows)]
  {
    imp::default_printer()
  }

  #[cfg(not(windows))]
  {
    None
  }
}

/// طباعة الصفحة الحالية مباشرةً — بلا حوار النظام.
///
/// `async` عمداً: `with_webview` يُنفَّذ على خيط الواجهة، والانتظارُ هنا
/// يقع على خيط وقتِ التشغيل غير المتزامن. ولو كان الأمر متزامناً لعمل
/// على خيط الواجهة نفسه فانتظر نفسَه إلى الأبد.
#[tauri::command]
pub async fn print_sheet(
  window: tauri::WebviewWindow,
  printer: Option<String>,
  landscape: Option<bool>,
  // عرض الصفحة وطولها بالبوصة — للإيصال الحراري، وفارغُهما A4
  page_width: Option<f64>,
  page_height: Option<f64>,
) -> Result<(), String> {
  #[cfg(windows)]
  {
    let (tx, rx) = std::sync::mpsc::channel();
    let landscape = landscape.unwrap_or(true);
    let page = match (page_width, page_height) {
      (Some(w), Some(h)) => Some((w, h)),
      _ => None,
    };

    window
      .with_webview(move |webview| {
        let _ = tx.send(imp::print(&webview, printer, landscape, page));
      })
      .map_err(|e| format!("تعذّر بلوغ نافذة العرض: {e}"))?;

    rx.recv()
      .map_err(|_| "انقطع ردّ الطباعة قبل أن يصل".to_string())?
  }

  #[cfg(not(windows))]
  {
    let _ = (window, printer, landscape, page_width, page_height);
    Err("الطباعة المباشرة متاحة على ويندوز وحده".to_string())
  }
}
