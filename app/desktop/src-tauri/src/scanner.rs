//! الماسح الضوئي — سحبُ صفحةٍ من ماسح الطابعة إلى البرنامج مباشرةً.
//!
//! المكتب يملك طابعةً متعدّدة الوظائف، وشهادةُ الميلاد تُمسح بها ثمّ
//! يبحث الموظّف عن الملفّ في «صور ممسوحة» ويرفعه. خطوتان زائدتان وملفٌّ
//! يبقى على سطح المكتب. فالمسح يجري من داخل النافذة، وما يخرج منه يذهب
//! إلى المحرّر ثمّ إلى الخادم بلا أن يلمس المستخدم مجلّداً.
//!
//! **WIA لا TWAIN**: كلُّ ماسحٍ على ويندوز يأتي بمشغّل WIA، بينما TWAIN
//! يحتاج طبقةَ توافقٍ ومصدراً مثبَّتاً قد لا يوجد. و WIA جزءٌ من النظام
//! منذ ويندوز مي، فلا شيء يُثبَّت على جهاز المؤسسة.
//!
//! **وعبر PowerShell لا COM مباشرةً**: كائنات WIA للأتمتة
//! (`WIA.DeviceManager` و`WIA.ImageFile`) كلُّها `IDispatch`، ونداؤها من
//! Rust يعني `Invoke` بأسماءٍ تُترجم في زمن التشغيل ومصفوفاتِ `VARIANT`
//! تُبنى يدوياً لكل خاصية — مئاتُ الأسطر من التمرير غير الآمن مقابل ما
//! يكتبه PowerShell في عشرين سطراً بالكائنات نفسها. والفشل هناك نصٌّ
//! مقروء على `stderr` بدل `HRESULT` مجرَّد.
//!
//! والسكربت يُمرَّر بـ`-EncodedCommand` (‏UTF‑16LE ثمّ base64): النصّ
//! العربي في رسائل الخطأ وأسماءُ الملفّات بمسافاتها لا تنجو من الاقتباس
//! في سطر أوامر ويندوز، والترميز يُلغي المسألة كلَّها.

use base64::Engine;
use serde::Serialize;

/// جهاز مسحٍ كما يراه النظام.
#[derive(Serialize)]
pub struct Scanner {
  /// معرّف WIA — يُمرَّر إلى `scan_page` لاختيار الجهاز بعينه
  pub id: String,
  pub name: String,
}

/// صفحةٌ ممسوحة عائدةٌ إلى الواجهة.
#[derive(Serialize)]
pub struct ScannedPage {
  /// الصورة مرمَّزةً base64 — بلا سابقة `data:`، تضيفها الواجهة
  pub base64: String,
  /// نوع المحتوى الفعلي: `image/jpeg` غالباً، و`image/bmp` حين يرفض
  /// المشغّل التحويل. الواجهة تبني `File` به لا بافتراضٍ ثابت.
  pub mime: String,
  pub width: u32,
  pub height: u32,
}

/// امتداد الملفّ الذي أخرجه WIA ← نوع المحتوى.
fn mime_of(ext: &str) -> &'static str {
  match ext.trim().trim_start_matches('.').to_ascii_lowercase().as_str() {
    "jpg" | "jpeg" => "image/jpeg",
    "png" => "image/png",
    "tif" | "tiff" => "image/tiff",
    "gif" => "image/gif",
    _ => "image/bmp",
  }
}

#[cfg(windows)]
mod imp {
  use std::os::windows::process::CommandExt;
  use std::process::Command;

  use base64::Engine;

  /// يمنع ومضةَ نافذة سوداء عند كل نداء — `CREATE_NO_WINDOW`.
  const NO_WINDOW: u32 = 0x0800_0000;

  /// PowerShell يقرأ `-EncodedCommand` بـUTF‑16LE ثمّ base64.
  fn encode(script: &str) -> String {
    let utf16: Vec<u8> = script
      .encode_utf16()
      .flat_map(|unit| unit.to_le_bytes())
      .collect();

    base64::engine::general_purpose::STANDARD.encode(utf16)
  }

  /// يُخرج رسالة الخطأ من غلاف CLIXML الذي يكتبه PowerShell على `stderr`.
  ///
  /// حين يُستدعى PowerShell كعمليةٍ فرعية غيرِ تفاعلية فإنّه لا يكتب
  /// الأخطاء نصّاً، بل يسلسلها XML: ‏`#< CLIXML` ثمّ `<Objs>` تحوي
  /// ‏`<S S="Error">` لكلّ سطر، والأسطر الجديدة فيها `_x000D__x000A_`.
  /// وتمريرُ ذلك كما هو إلى الشاشة يضع أمام الموظّف عشرين سطراً من XML
  /// بدل جملةٍ تقول ما حدث — وهو ما ظهر فعلاً عند أوّل فشل.
  fn readable(stderr: &str) -> String {
    if !stderr.contains("<Objs") {
      return stderr.trim().to_string();
    }

    let mut lines: Vec<String> = Vec::new();
    let mut rest = stderr;

    while let Some(start) = rest.find("<S S=\"Error\">") {
      rest = &rest[start + 13..];

      let Some(end) = rest.find("</S>") else { break };
      let text = &rest[..end];
      rest = &rest[end + 4..];

      let text = text
        .replace("_x000D_", "")
        .replace("_x000A_", "\n")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        /* الأخير: فكُّه قبل غيره يُعيد تفسير ما فُكّ */
        .replace("&amp;", "&");

      let text = text.trim();
      if !text.is_empty() {
        lines.push(text.to_string());
      }
    }

    /*
     * السطر الأوّل وحده هو الرسالة، وما بعده أثرُ PowerShell: موضعُ
     * السطر في السكربت وتسطيرُه بعلامات `~` واسمُ صنف الاستثناء. لا
     * يقرؤها الموظّف ولا تعنيه، والرسالة نفسها تكفي.
     */
    lines
      .first()
      .cloned()
      .unwrap_or_else(|| stderr.trim().to_string())
  }

  pub fn run(script: &str) -> Result<String, String> {
    /* شريط التقدّم يُكتب على stderr كـCLIXML حتى عند النجاح — ضجيجٌ
       يُلبِّس على قارئ الأخطاء، وإسكاتُه أنظف من ترشيحه بعد وقوعه */
    let script = format!("$ProgressPreference = 'SilentlyContinue'\n{script}");

    let output = Command::new("powershell.exe")
      .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encode(&script)])
      .creation_flags(NO_WINDOW)
      .output()
      .map_err(|e| format!("تعذّر تشغيل PowerShell: {e}"))?;

    if !output.status.success() {
      let err = readable(&String::from_utf8_lossy(&output.stderr));

      return Err(if err.is_empty() {
        "فشل المسح بلا رسالة من النظام".to_string()
      } else {
        err
      });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
  }

  #[cfg(test)]
  mod tests {
    use super::readable;

    /// مأخوذٌ حرفياً من فشلٍ حقيقي وقع على جهاز المؤسسة.
    const CLIXML: &str = concat!(
      r#"#< CLIXML"#,
      r#"<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04">"#,
      r#"<Obj S="progress" RefId="0"><TN RefId="0"><T>System.Management.Automation.PSCustomObject</T>"#,
      r#"</TN><MS><I64 N="SourceId">1</I64><PR N="Record"><AV>Preparing modules for first use.</AV>"#,
      r#"</PR></MS></Obj>"#,
      r#"<S S="Error">Specified cast is not valid._x000D__x000A_</S>"#,
      r#"<S S="Error">At line:37 char:3_x000D__x000A_</S>"#,
      r#"<S S="Error">+ $process.Filters.Item(1).Properties.Item('FormatID').Value = $jpeg_x000D__x000A_</S>"#,
      r#"<S S="Error"> + FullyQualifiedErrorId : System.InvalidCastException_x000D__x000A_</S>"#,
      r#"</Objs>"#,
    );

    #[test]
    fn extracts_the_message_and_drops_the_trace() {
      assert_eq!(readable(CLIXML), "Specified cast is not valid.");
    }

    #[test]
    fn plain_text_passes_through() {
      assert_eq!(readable("  لا ماسح ضوئي متّصل \n"), "لا ماسح ضوئي متّصل");
    }

    #[test]
    fn unescapes_xml_entities() {
      let raw = r#"<Objs><S S="Error">&lt;a&gt; &amp;amp; &quot;b&quot;_x000D__x000A_</S></Objs>"#;
      assert_eq!(readable(raw), r#"<a> &amp; "b""#);
    }
  }
}

/// أسماء أجهزة المسح المتّصلة.
///
/// `$_.Type -eq 1` هو `ScannerDeviceType` — يستبعد الكاميرات وقارئات
/// الفيديو التي يسردها WIA في القائمة نفسها.
#[tauri::command]
pub fn list_scanners() -> Result<Vec<Scanner>, String> {
  #[cfg(windows)]
  {
    const SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
try {
  $manager = New-Object -ComObject WIA.DeviceManager
} catch {
  Write-Error 'خدمة WIA غير متاحة على هذا الجهاز'
  exit 1
}
foreach ($info in $manager.DeviceInfos) {
  if ($info.Type -eq 1) {
    $name = $info.Properties.Item('Name').Value
    Write-Output ("{0}`t{1}" -f $info.DeviceID, $name)
  }
}
"#;

    let out = imp::run(SCRIPT)?;

    Ok(
      out
        .lines()
        .filter_map(|line| {
          let (id, name) = line.split_once('\t')?;
          let id = id.trim();

          (!id.is_empty()).then(|| Scanner {
            id: id.to_string(),
            name: name.trim().to_string(),
          })
        })
        .collect(),
    )
  }

  #[cfg(not(windows))]
  {
    Err("المسح الضوئي متاح على ويندوز وحده".to_string())
  }
}

/// يمسح صفحةً واحدة ويُعيدها JPEG مرمَّزاً.
///
/// - `device`: معرّف الجهاز، وفارغُه يأخذ أوّل ماسحٍ متّصل.
/// - `dpi`: دقّة المسح. 200 تكفي لوثيقةٍ تُقرأ، و300 لصورةٍ تُطبع.
/// - `color`: `color` أو `gray` أو `text` — نوايا WIA الثلاث.
///
/// والتحويل إلى JPEG يجري في `WIA.ImageProcess` لا بالطلب من الماسح:
/// كثيرٌ من المشغّلات لا تُعلن دعم JPEG في النقل وتُخرج BMP فقط، فالنقل
/// يجري بالصيغة التي يملكها الجهاز ثمّ يُحوَّل الناتج. وBMP بدقّة 300
/// لصفحة A4 يبلغ خمسةً وعشرين ميغابايت، فتحويلُه قبل عبور الجسر ليس
/// تحسيناً بل شرطُ ألّا تختنق الواجهة.
///
/// **والتحويل لا يُفشل المسح إن تعثّر**: الورقة مرّت في الماسح فعلاً،
/// وإسقاطُ نتيجتها لأنّ مُرشِّحاً رفض ضبطَ صيغته يعني إعادةَ مسحٍ لا
/// تُصلح شيئاً. فيُحفظ الناتج بصيغته الأصلية ويُعلَن نوعُها، والمحرّر
/// يُعيد ترميز كل شيء JPEG عند الحفظ على أيّ حال.
#[tauri::command]
pub async fn scan_page(
  device: Option<String>,
  dpi: Option<u32>,
  color: Option<String>,
) -> Result<ScannedPage, String> {
  #[cfg(windows)]
  {
    tauri::async_runtime::spawn_blocking(move || {
      /* حدودٌ على ما يصل من الواجهة — دقّةٌ صفرية أو خيالية تُعلّق المشغّل */
      let dpi = dpi.unwrap_or(300).clamp(75, 1200);

      let intent = match color.as_deref().unwrap_or("color") {
        "gray" => 2,  // WIA_INTENT_IMAGE_TYPE_GRAYSCALE
        "text" => 4,  // WIA_INTENT_IMAGE_TYPE_TEXT
        _ => 1,       // WIA_INTENT_IMAGE_TYPE_COLOR
      };

      let device = device.unwrap_or_default();
      let device = device.trim().replace('\'', "''");

      let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
$manager = New-Object -ComObject WIA.DeviceManager

$wanted = '{device}'
$info = $null
foreach ($candidate in $manager.DeviceInfos) {{
  if ($candidate.Type -ne 1) {{ continue }}
  if ($wanted -eq '' -or $candidate.DeviceID -eq $wanted) {{ $info = $candidate; break }}
}}

if ($null -eq $info) {{ Write-Error 'لا ماسح ضوئي متّصل'; exit 1 }}

$device = $info.Connect()
$item = $device.Items.Item(1)

# ‏`Value` في مكتبة أنواع WIA خاصيةٌ بمعاملات، وPowerShell يعجز عن
# إسنادها مباشرةً في بعض الكائنات فيرمي «Specified cast is not valid».
# فالإسناد المباشر أوّلاً — وهو ما يعمل على خصائص الماسح — وعند فشله
# يُنادى الواضع عبر IDispatch، وهو الطريق الذي يقبله مُرشِّح التحويل.
function Set-WiaValue($property, $value) {{
  try {{
    $property.Value = $value
  }} catch {{
    [void]$property.GetType().InvokeMember(
      'Value', 'SetProperty', $null, $property, @($value))
  }}
}}

function Get-Prop($target, $id) {{
  foreach ($property in $target.Properties) {{
    if ($property.PropertyID -eq $id) {{ return $property }}
  }}
  return $null
}}

function Set-Prop($target, $id, $value) {{
  $property = Get-Prop $target $id
  if ($property) {{ Set-WiaValue $property $value }}
}}

# ‏الترتيب مقصود ولا يجوز خلطه:
#   النيّة أوّلاً — الماسح يشتقّ منها العمق والسطوع ويُعيد حساب ما بعدها.
#   ثمّ الدقّة — وعندها وحدها يصير الحدّ الأقصى للمساحة معلوماً.
#   ثمّ الموضع والمساحة.
Set-Prop $item 6146 {intent}   # WIA_IPS_CUR_INTENT
Set-Prop $item 6147 {dpi}      # WIA_IPS_XRES
Set-Prop $item 6148 {dpi}      # WIA_IPS_YRES

# --------------------------------------------------
# مساحة المسح = سطح الماسح كلُّه
#
# مشغّل Canon MF3010 يبدأ بمساحةٍ قدرها 850×1169 بكسلاً بينما الدقّة
# 300 — أي 2.8×3.9 بوصة من الزاوية، لا الورقة كلَّها. والرقمان هما
# مقاس السطح عند 100 نقطة: المشغّل يحسبهما مرّةً ولا يُحدّثهما مع
# الدقّة. فوثيقةٌ توضع في وسط الزجاج أو طرفه تخرج صفحةً بيضاء — لا
# خطأَ ولا رسالة، لأنّ المسح نجح فعلاً على مساحةٍ ليس فيها شيء.
#
# و`SubTypeMax` يتتبّع الدقّة تتبّعاً صحيحاً (قِسناه: 200 ← 1700×2338،
# و300 ← 2550×3508، و600 ← 5100×7016)، فهو مصدر الحدّ لا حسابٌ منّا.
# والحسابُ من مقاس السطح يبقى ارتداداً لمشغّلٍ لا يُعلن حدّاً.
# --------------------------------------------------

Set-Prop $item 6149 0          # WIA_IPS_XPOS — الموضع قبل المساحة، وإلّا قُصّت
Set-Prop $item 6150 0          # WIA_IPS_YPOS

function Set-Extent($id, $bedId) {{
  $property = Get-Prop $item $id
  if (-not $property) {{ return }}

  $max = 0
  try {{ $max = [int]$property.SubTypeMax }} catch {{ $max = 0 }}

  if ($max -le 0) {{
    # مقاس السطح بأجزاء الألف من البوصة ← بكسلات عند هذه الدقّة
    $bed = Get-Prop $device $bedId
    if ($bed) {{ $max = [int](([double]$bed.Value * {dpi}) / 1000.0) }}
  }}

  if ($max -gt 0) {{ Set-WiaValue $property $max }}
}}

Set-Extent 6151 3074           # WIA_IPS_XEXTENT / أفقي السطح
Set-Extent 6152 3075           # WIA_IPS_YEXTENT / رأسي السطح

$image = $item.Transfer()

# التحويل إلى JPEG — يُتخطّى إن كان الناتج JPEG أصلاً، ولا يُفشل
# المسح إن رفضه المشغّل: الورقة مرّت فعلاً، والصيغة الأصلية تُقرأ.
$jpeg = '{{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}}'
if ($image.FormatID -ne $jpeg) {{
  try {{
    $process = New-Object -ComObject WIA.ImageProcess
    $process.Filters.Add($process.FilterInfos.Item('Convert').FilterID)
    $filter = $process.Filters.Item(1)
    Set-WiaValue $filter.Properties.Item('FormatID') $jpeg
    try {{ Set-WiaValue $filter.Properties.Item('Quality') 88 }} catch {{ }}
    $image = $process.Apply($image)
  }} catch {{
    # يبقى `$image` على حاله — الصيغة تُعلَن أدناه من الصورة نفسها
  }}
}}

# الامتداد من الصورة لا من افتراضٍ: `SaveFile` يكتب بصيغة الصورة مهما
# سُمّي الملفّ، فامتدادٌ مخالف يُنتج ملفّاً يكذب على قارئه.
$ext = $image.FileExtension
if ([string]::IsNullOrWhiteSpace($ext)) {{ $ext = 'bmp' }}

$path = [System.IO.Path]::Combine(
  [System.IO.Path]::GetTempPath(),
  'ajyal-scan-' + [System.Guid]::NewGuid().ToString('N') + '.' + $ext)

$image.SaveFile($path)
Write-Output ("{{0}}`t{{1}}`t{{2}}`t{{3}}" -f $image.Width, $image.Height, $ext, $path)
"#
      );

      let out = imp::run(&script)?;

      /* السطر الأخير وحده: بعض المشغّلات تكتب تحذيراتٍ على المخرَج قبله */
      let line = out.lines().last().unwrap_or_default();
      let mut parts = line.rsplitn(4, '\t');

      /* من اليمين: المسار قد يحوي أيّ شيء إلّا جدولةً، وما قبله معروف */
      let path = parts.next().unwrap_or_default().trim().to_string();
      let ext = parts.next().unwrap_or("bmp").trim().to_string();
      let height: u32 = parts.next().unwrap_or("0").trim().parse().unwrap_or(0);
      let width: u32 = parts.next().unwrap_or("0").trim().parse().unwrap_or(0);

      if path.is_empty() {
        return Err("لم يُخرج الماسح ملفّاً".to_string());
      }

      let bytes = std::fs::read(&path)
        .map_err(|e| format!("تعذّرت قراءة الصفحة الممسوحة: {e}"))?;

      /* الملفّ المؤقّت لا يُترك: مسحٌ يومي يملأ TEMP بصفحاتٍ لا تُقرأ ثانيةً */
      let _ = std::fs::remove_file(&path);

      Ok(ScannedPage {
        base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
        mime: mime_of(&ext).to_string(),
        width,
        height,
      })
    })
    .await
    .map_err(|e| format!("انقطع المسح: {e}"))?
  }

  #[cfg(not(windows))]
  {
    let _ = (device, dpi, color);
    Err("المسح الضوئي متاح على ويندوز وحده".to_string())
  }
}
