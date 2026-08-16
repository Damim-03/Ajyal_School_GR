"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetSchoolService = exports.updateSchoolService = exports.getSchoolService = void 0;
const client_1 = require("../../core/prisma/client");
const school_schema_1 = require("./school.schema");
const withDefaults = (stored) => Object.fromEntries(school_schema_1.SCHOOL_KEYS.map((key) => [key, stored.get(key) ?? school_schema_1.SCHOOL_DEFAULTS[key]]));
// --------------------------------------------------
// Read
// --------------------------------------------------
const getSchoolService = async () => {
    const rows = await client_1.prisma.setting.findMany({
        where: { key: { in: school_schema_1.SCHOOL_KEYS } },
        select: { key: true, value: true, updatedAt: true },
    });
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    /*
     * آخر تعديل يُرسَل مع القيم: الواجهة تستعمله لتعرف متى تُبطل
     * نسختها المخزّنة محلياً بدل أن تُعيد الجلب في كل شاشة.
     */
    const updatedAt = rows.reduce((latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest), null);
    return {
        settings: withDefaults(stored),
        /** المفاتيح المضبوطة فعلاً — ما عداها افتراضي */
        configured: rows.map((row) => row.key),
        updatedAt,
    };
};
exports.getSchoolService = getSchoolService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateSchoolService = async (body) => {
    const entries = Object.entries(body);
    await client_1.prisma.$transaction(entries.map(([key, value]) => client_1.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
    })));
    return (0, exports.getSchoolService)();
};
exports.updateSchoolService = updateSchoolService;
// --------------------------------------------------
// Reset
//
// الحذف لا الكتابة بالقيمة الافتراضية: الصفّ الغائب يعني «غير مضبوط»
// فتتبع المدرسةُ أيَّ تغييرٍ لاحقٍ في الافتراضيات تلقائياً.
// --------------------------------------------------
const resetSchoolService = async (body) => {
    await client_1.prisma.setting.deleteMany({ where: { key: { in: body.keys } } });
    return (0, exports.getSchoolService)();
};
exports.resetSchoolService = resetSchoolService;
//# sourceMappingURL=school.service.js.map