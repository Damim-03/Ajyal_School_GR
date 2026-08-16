"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFieldChanges = exports.recordAudit = void 0;
const client_1 = require("../prisma/client");
const recordAudit = async (entry, client = client_1.prisma) => {
    try {
        await client.financialAuditLog.create({
            data: {
                entity: entry.entity,
                entityId: entry.entityId,
                action: entry.action,
                field: entry.field ?? null,
                oldValue: entry.oldValue ?? null,
                newValue: entry.newValue ?? null,
                reason: entry.reason ?? null,
                userId: entry.userId ?? null,
            },
        });
    }
    catch (error) {
        console.error("[audit] failed to record entry", entry, error);
    }
};
exports.recordAudit = recordAudit;
/** أثر التغييرات بين حالتين — يكتب سطراً لكل حقل تبدّل فعلاً */
const recordFieldChanges = async (entity, entityId, before, after, fields, userId, client = client_1.prisma) => {
    for (const field of fields) {
        const from = before[field];
        const to = after[field];
        if (String(from) === String(to))
            continue;
        await (0, exports.recordAudit)({
            entity,
            entityId,
            action: "UPDATE",
            field,
            oldValue: from == null ? null : String(from),
            newValue: to == null ? null : String(to),
            userId,
        }, client);
    }
};
exports.recordFieldChanges = recordFieldChanges;
//# sourceMappingURL=financial-audit.js.map