import type { ReactNode } from "react";
import { Route } from "react-router-dom";

import { DetailPage } from "./DetailPage";
import { ExportsPage } from "./ExportsPage";
import { OverviewPage } from "./OverviewPage";
import { ReportPage } from "./ReportPage";
import ReportsHubPage from "./ReportsHubPage";
import ReportsSectionPage from "./ReportsSectionPage";
import { SCREENS } from "./reports.catalog";

// ======================================================
// مسارات التقارير — §3
//
// «كل قسم يجب أن يكون Screen/Route مستقلاً» — لا تبويباتٍ داخل
// صفحةٍ واحدة. والفائدةُ ليست تنظيمية: المسارُ المستقلّ يُحفظ في
// المفضّلة ويُشارَك ويعمل معه زرُّ الرجوع.
//
// ------------------------------------------------------
// ثلاثُ طبقات
// ------------------------------------------------------
//
//   /reports                  المحور — ستّ بطاقات
//   /reports/section/:group   محورُ المجموعة — بطاقاتُ تقاريرها
//   /reports/:report          شاشةُ التقرير
//
// و`section` كلمةٌ محجوزة لا يحملها مفتاحُ تقرير، فلا تلتبس
// بمسارٍ حقيقي.
//
// والشاشاتُ تُولَّد من السجلّ لا تُكتب واحدةً واحدة: إضافةُ تقريرٍ
// في الخادم تصير سطراً في `reports.catalog.ts` وحده.
// ======================================================

export const reportsRoutes = (
  guarded: (element: ReactNode) => ReactNode,
) => (
  <>
    {/* المحور */}
    <Route path="/reports" element={guarded(<ReportsHubPage />)} />

    {/* محاور المجموعات */}
    <Route
      path="/reports/section/:group"
      element={guarded(<ReportsSectionPage />)}
    />

    <Route path="/reports/exports" element={guarded(<ExportsPage />)} />
    <Route path="/reports/overview" element={guarded(<OverviewPage />)} />

    {/*
      التفصيلُ قبل الجامع: `students/:studentId` قبل `students`،
      وإلّا التقط الجامعُ المعرّفَ جزءاً من مساره.
    */}
    <Route
      path="/reports/students/:studentId"
      element={guarded(
        <DetailPage
          reportKey="students"
          paramName="studentId"
          title="ملفّ الطالب"
        />,
      )}
    />
    <Route
      path="/reports/teachers/:teacherId"
      element={guarded(
        <DetailPage
          reportKey="teachers"
          paramName="teacherId"
          title="ملفّ الأستاذ"
        />,
      )}
    />
    <Route
      path="/reports/settlements/:settlementId"
      element={guarded(
        <DetailPage
          reportKey="settlements"
          paramName="settlementId"
          title="تفصيل التخليص"
        />,
      )}
    />

    {SCREENS.filter((screen) => screen.key !== "overview").map((screen) => (
      <Route
        key={screen.key}
        path={`/reports/${screen.key}`}
        element={guarded(
          <ReportPage
            reportKey={screen.key}
            title={screen.title}
            description={screen.description}
            metricOrder={screen.metricOrder}
            emphasis={screen.emphasis}
            chartHeight={screen.chartHeight}
          />,
        )}
      />
    ))}
  </>
);
