import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyPreferences } from './core/system/preferences'
import { startConnectionWatch } from './core/system/connection'
import { watchConnectionNotices } from './core/system/connection-notice'
import { installDiagnostics } from './features/first-boot/services/initialization.service'

/*
 * التفضيلاتُ تُطبَّق **قبل أوّل رسم**.
 *
 * فمقياسُ الواجهة يُكتب على جذر المستند (`font-size`)، وكثافةُ
 * المسافات على `--spacing`. ولو أُجّلا إلى تأثيرٍ في مكوّنٍ ما لرُسم
 * الإطارُ الأوّلُ بالمقياس الافتراضيّ ثمّ قفزت الشاشةُ كلُّها إلى
 * المقياس المختار — وهو أوّلُ ما يراه من ضبط «كبير» في كلّ تشغيل.
 *
 * والقراءةُ محلّيةٌ متزامنة، فلا انتظارَ لخادمٍ هنا. والخادمُ يبقى
 * المرجع: `reconcileFromState` تصالح الجهازَ مع ما في القاعدة بعد
 * قراءة الحالة.
 */
applyPreferences()

/*
 * ومستمعُ سِجلّ الأعطال يُركَّب مرّةً هنا لا في مكوّن.
 *
 * إذ العطبُ الذي يستحقّ التسجيل هو الذي يُسقط الشجرةَ — ومستمعٌ داخل
 * مكوّنٍ يذهب مع المكوّن الذي سقط. والإذنُ يُقرأ عند كلّ عطبٍ لا عند
 * التركيب، فإطفاءُ الخيار من شاشة الخصوصية يسري في الحال.
 */
installDiagnostics()

/*
 * مراقبةُ الاتصال — قبل أوّل طلبٍ يخرج من التطبيق.
 *
 * والترتيبُ لازم: `watchConnectionNotices` تشترك في المتجر، وتركيبُها
 * بعد بدء المراقبة كان سيُفوّت أوّلَ تبدّلٍ — وهو بعينه الحالةُ التي
 * يُقلع فيها الجهازُ وشبكتُه مقطوعة.
 *
 * وكلاهما خارج شجرة React: الانقطاعُ حالةُ تطبيقٍ لا حالةُ شاشة، ولو
 * رُبطا بمكوّنٍ لماتا مع تفكيكه.
 */
watchConnectionNotices()
startConnectionWatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
