import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { moduleOf } from "../features/home/modules";

/**
 * ترويسة شاشة العمل — الطرف الأخير من سلسلة الهويّة.
 *
 * البلاطة ← البطل ← مساحة العمل يجب أن تُقرأ كحالاتٍ لشيء واحد. وكانت
 * السلسلة تنقطع هنا: البطل يعرض أيقونة القسم ولونه وسطره التعريفي، ثم
 * تفتح الشاشة فتجد ترويسة بيضاء مكتوباً فيها «SKK» ونصٌّ أسود — لا أيقونة
 * ولا لون ولا أثر لما جئتَ منه.
 *
 * الهويّة هنا **مشتقّة من المسار** لا ممرَّرة كخاصّية. الفارق عملي لا
 * جمالي: لو مُرِّرت لوجب تعديل ستّ شاشات، ولنُسيت في السابعة، ولاحتُمل أن
 * تُمرَّر خطأً — وهو ما وقع فعلاً في موضع آخر حيث كُتب لون القسم بيده
 * (`exitToHome(PATHS.home, "#7dd3fc")`). ما يُشتقّ لا يُنسى ولا يتناقض.
 */
export function AppHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const { pathname } = useLocation();
  const mod = moduleOf(pathname);

  return (
    <header
      className="home-header"
      /*
       * الترويسة تلبس لون القسم.
       *
       * كانت `--skk-gradient` القرمزية ثابتةً في كل الشاشات — أي أنّ شاشة
       * المخزون تحمل لون المبيعات. وهذا أقوى تناقض في الرحلة كلّها: تعاين
       * المخزون بالأزرق، وتضغط «ابدأ الآن»، فيستقبلك قرمزيّ. كشفته لقطة
       * الشاشة بعد أن مرّ الفحص البرمجي عليه (الحدّ كان بلون القسم فعلاً،
       * لكنّ الجسم الذي فوقه لم يكن).
       *
       * التدرّج نفسه الذي تحمله البلاطة والبطل حرفياً — لا لون «قريب منه».
       */
      style={
        mod
          ? {
              background: `linear-gradient(120deg, ${mod.from} 0%, ${mod.via} 74%, ${mod.end} 100%)`,
              borderBottom: `2px solid ${mod.accent}`,
              boxShadow: `0 10px 30px -18px ${mod.from}`,
            }
          : undefined
      }
    >
      {mod ? (
        /* رمز القسم — حاضرٌ مستقرّ، لا هدفَ رحلةٍ ولا مصدرها. */
        <mod.icon aria-hidden className="h-9 w-9 shrink-0" style={{ color: mod.accent }} />
      ) : (
        <div className="home-logo">أجيال</div>
      )}
      <div className="home-titles">
        <h1>{title}</h1>
        {/* السطر التعريفي نفسه الذي حمله البطل، لا نصّ آخر يصف الشيء نفسه */}
        {(subtitle ?? mod?.tagline) && <span>{subtitle ?? mod?.tagline}</span>}
      </div>
      <div className="home-spacer" />
      {children}
    </header>
  );
}
