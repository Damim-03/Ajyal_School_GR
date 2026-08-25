/**
 * الأجهزة (§16/§37).
 *
 * **ولوحةُ المفاتيح والفأرة تُجرَّبان ولا تُسردان.** ولا واجهةَ في
 * ويندوز تقول «هل ثمّة لوحةُ مفاتيحَ تعمل» جواباً يُعتمد عليه؛ وكلُّ
 * حاسوبٍ يُبلغ عن واحدةٍ ولو كانت مقطوعة. والدليلُ الوحيدُ التامّ أن
 * تصل ضغطةٌ فعلاً — وهو دليلٌ لا يُشكّ فيه: ما وصلت إلّا وقد عمل
 * الجهاز.
 *
 * وهذه هي اللحظةُ التي تشبه فيها الشاشةُ تجربةَ تشغيلِ جهازٍ جديد:
 * «اضغط أيّ مفتاح» فتُضيء الحالةُ في يدك.
 *
 * **والاختياريُّ لا يوقف شيئاً.** طابعةٌ غيرُ موصولةٍ ليست خطأً ولا
 * تُلوَّن حمراء — تُقال كما هي، ويُقال إنّها تُضبط لاحقاً. والمطلوبُ
 * وحدَه يمنع المضيّ، ولا مطلوبَ اليومَ إلّا لوحةُ المفاتيح.
 */

import { useEffect, useState } from "react";

import { Stage } from "./Stage";
import {
  buildDeviceReport,
  canDetectHardware,
  detectListedDevices,
  testReceiptPrint,
} from "../services/device.service";
import {
  Barcode, Keyboard, Mouse, Printer, ReceiptText, ScanLine,
} from "lucide-react";

import { useFirstBoot } from "../hooks/useFirstBoot";
import { useT } from "../hooks/useFirstBootState";
import { submitDevices } from "../services/firstBoot.service";
import type { DeviceEntry, DeviceKind } from "../types/firstBoot.types";

export function DevicesScreen({ error }: { error: string | null }) {
  const t = useT();
  const { submit, back, canGoBack, submitting } = useFirstBoot("DEVICES");

  const [scanning, setScanning] = useState(true);
  const [listed, setListed] = useState<DeviceEntry[]>([]);
  const [verified, setVerified] = useState<Partial<Record<DeviceKind, boolean>>>(
    {},
  );
  const [printResult, setPrintResult] = useState<"ok" | "fail" | null>(null);
  const [scanned, setScanned] = useState("");

  const detect = async () => {
    setScanning(true);

    try {
      setListed(await detectListedDevices());
    } finally {
      setScanning(false);
    }
  };

  /*
   * أوّلُ فحصٍ عند العرض — **وبلا كتابةِ حالةٍ متزامنةٍ في التأثير**.
   *
   * فالحالةُ تبدأ «جارٍ البحث» أصلاً، ولا يُكتب شيءٌ إلّا بعد أن يردّ
   * النظام. و`alive` تقطع الكتابةَ إن غادر المستخدمُ الشاشةَ قبل أن
   * يردّ WIA — وهو يتأخّر ثانيةً أو أكثر على بعض المشغّلات.
   */
  useEffect(() => {
    let alive = true;

    detectListedDevices()
      .then((found) => {
        if (!alive) return;
        setListed(found);
        setScanning(false);
      })
      .catch(() => {
        if (alive) setScanning(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  /*
   * إثباتُ لوحة المفاتيح والفأرة — بمستمعَين على النافذة.
   *
   * و`once` في الخيارات: ما إن يصل الحدثُ حتى يُرفع المستمع. فلا
   * تبقى الشاشةُ تعالج كلَّ حركةِ فأرةٍ بعد أن ثبت المطلوب.
   */
  useEffect(() => {
    const onKey = () =>
      setVerified((current) => ({ ...current, KEYBOARD: true }));

    const onMove = () =>
      setVerified((current) => ({ ...current, POINTER: true }));

    window.addEventListener("keydown", onKey, { once: true });
    window.addEventListener("mousemove", onMove, { once: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  /*
   * قارئُ الباركود لوحةُ مفاتيحَ في نظر النظام: يكتب المحارفَ بسرعةٍ
   * ثمّ يُنهي بـEnter. فلا سبيلَ إلى سرده — والتجربةُ الوحيدة أن
   * يُقرأ به رمزٌ فعلاً. والعتبةُ زمنيّةٌ: خمسةُ محارفَ فأكثر في أقلَّ
   * من 120ms بين الحرف والحرف لا تكتبها يدٌ بشرية.
   */
  useEffect(() => {
    let buffer = "";
    let last = 0;

    const onKey = (event: KeyboardEvent) => {
      const now = performance.now();

      if (now - last > 120) buffer = "";
      last = now;

      if (event.key === "Enter") {
        if (buffer.length >= 5) {
          setScanned(buffer);
          setVerified((current) => ({ ...current, BARCODE_SCANNER: true }));
        }

        buffer = "";
        return;
      }

      if (event.key.length === 1) buffer += event.key;
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * رمزُ كلّ جهاز — **والقائمةُ كانت ستَّ صفوفٍ متطابقةِ الشكل**.
   *
   * ستّةُ أسطرٍ نصّيةٍ متساويةٍ في الوزن لا يميّز الطابعةَ من الماسح
   * فيها إلّا قراءةُ أوّل كلمة. والرمزُ يجعل الصفَّ يُعرَف بلمحة —
   * وهو ما تفعله شاشاتُ تركيب الأجهزة في الأنظمة المكتبية.
   */
  const ICONS: Record<DeviceKind, typeof Keyboard> = {
    KEYBOARD: Keyboard,
    POINTER: Mouse,
    DOCUMENT_PRINTER: Printer,
    RECEIPT_PRINTER: ReceiptText,
    SCANNER: ScanLine,
    BARCODE_SCANNER: Barcode,
  };

  const nameOf = (kind: DeviceKind) =>
    listed.find((device) => device.kind === kind)?.name ?? "";

  const found = (kind: DeviceKind) =>
    listed.some((device) => device.kind === kind);

  const report = buildDeviceReport(listed, verified, {
    BARCODE_SCANNER: scanned ? "HID" : "",
  });

  const keyboardOk = verified.KEYBOARD === true;

  const rows: {
    kind: DeviceKind;
    label: string;
    required: boolean;
    ok: boolean;
    meta: string;
    action?: { label: string; onClick: () => void };
  }[] = [
    {
      kind: "KEYBOARD",
      label: t.devices.keyboard,
      required: true,
      ok: keyboardOk,
      meta: keyboardOk ? t.devices.verified : t.devices.pressAnyKey,
    },
    {
      kind: "POINTER",
      label: t.devices.pointer,
      required: false,
      ok: verified.POINTER === true,
      meta: verified.POINTER ? t.devices.verified : t.devices.moveMouse,
    },
    {
      kind: "DOCUMENT_PRINTER",
      label: t.devices.documentPrinter,
      required: false,
      ok: found("DOCUMENT_PRINTER"),
      meta: nameOf("DOCUMENT_PRINTER"),
    },
    {
      kind: "RECEIPT_PRINTER",
      label: t.devices.receiptPrinter,
      required: false,
      ok: found("RECEIPT_PRINTER"),
      meta:
        printResult === "ok"
          ? t.devices.verified
          : printResult === "fail"
            ? t.errors.tryAgain
            : nameOf("RECEIPT_PRINTER"),
      ...(found("RECEIPT_PRINTER")
        ? {
            action: {
              label: t.devices.testPrint,
              onClick: () => {
                void testReceiptPrint(nameOf("RECEIPT_PRINTER")).then((ok) => {
                  setPrintResult(ok ? "ok" : "fail");

                  if (ok) {
                    setVerified((current) => ({
                      ...current,
                      RECEIPT_PRINTER: true,
                    }));
                  }
                });
              },
            },
          }
        : {}),
    },
    {
      kind: "SCANNER",
      label: t.devices.scanner,
      required: false,
      ok: found("SCANNER"),
      meta: nameOf("SCANNER"),
    },
    {
      kind: "BARCODE_SCANNER",
      label: t.devices.barcode,
      required: false,
      ok: scanned !== "",
      meta: scanned ? `${t.devices.scanned} ${scanned}` : t.devices.testScan,
    },
  ];

  const nothingFound = !scanning && listed.length === 0;

  return (
    <Stage
      stepKey="DEVICES"
      title={t.devices.title}
      description={t.devices.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={
        canDetectHardware() ? t.devices.optionalNote : t.devices.browserNote
      }
      secondary={
        scanning
          ? undefined
          : { label: t.devices.rescan, onClick: () => void detect() }
      }
      primary={{
        label: t.common.continue,
        busy: submitting,
        /*
         * المطلوبُ وحدَه يقفل الزرّ.
         *
         * ولوحةُ المفاتيح تُثبَت بضغطةٍ واحدة — وهي ضغطةٌ يفعلها
         * المستخدمُ بلا أن يُطلب منها شيءٌ إضافيّ: مفتاحُ Tab نفسُه
         * يكفي. فالقيدُ صارمٌ في المبدأ، هيّنٌ في الممارسة.
         */
        disabled: !keyboardOk,
        onClick: () => void submit(() => submitDevices(report)),
      }}
    >
      <div className="nx-list">
        {rows.map((row) => (
          <div className="nx-row" key={row.kind}>
            <span className="nx-row__icon" aria-hidden="true">
              {(() => {
                const Icon = ICONS[row.kind];
                return <Icon size={17} strokeWidth={1.7} />;
              })()}
            </span>

            <div className="nx-row__body">
              <span className="nx-row__label">{row.label}</span>
              <span className="nx-row__meta">
                {scanning && !row.required ? t.devices.searching : row.meta}
              </span>
            </div>

            {row.action && (
              <button
                type="button"
                className="nx-btn nx-btn--ghost"
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
                onClick={row.action.onClick}
              >
                {row.action.label}
              </button>
            )}

            <span
              className={
                row.ok
                  ? "nx-tag nx-tag--ok"
                  : row.required
                    ? "nx-tag nx-tag--bad"
                    : "nx-tag"
              }
            >
              {row.ok
                ? t.common.detected
                : row.required
                  ? t.common.required
                  : t.common.optional}
            </span>
          </div>
        ))}
      </div>

      {nothingFound && (
        <p className="nx-hint" style={{ marginTop: 12 }}>
          {t.devices.none}
        </p>
      )}
    </Stage>
  );
}
