"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const school_route_1 = __importDefault(require("../modules/school/school.route"));
const academic_year_route_1 = __importDefault(require("../modules/academic-year/academic-year.route"));
const education_stage_route_1 = __importDefault(require("../modules/education-stage/education-stage.route"));
const level_route_1 = __importDefault(require("../modules/level/level.route"));
const study_group_route_1 = __importDefault(require("../modules/study-group/study-group.route"));
const subject_route_1 = __importDefault(require("../modules/subject/subject.route"));
const classroom_route_1 = __importDefault(require("../modules/classroom/classroom.route"));
const lesson_slot_route_1 = __importDefault(require("../modules/lesson-slot/lesson-slot.route"));
const tuition_fee_route_1 = __importDefault(require("../modules/tuition-fee/tuition-fee.route"));
// --------------------------------------------------
// Settings — البيانات المرجعية التي تضبطها الإدارة
// مطابق لما تتوقعه الواجهة في core/api/endpoints.ts
//
// الترتيب يعكس التبعية:
//   EducationStage → Level → StudyGroup → TuitionFee
// --------------------------------------------------
const settingsRoute = (0, express_1.Router)();
// هوية المدرسة — مفتاح/قيمة، لا مورد CRUD
settingsRoute.use("/school", school_route_1.default);
settingsRoute.use("/academic-years", academic_year_route_1.default);
settingsRoute.use("/education-stages", education_stage_route_1.default);
settingsRoute.use("/levels", level_route_1.default);
settingsRoute.use("/study-groups", study_group_route_1.default);
settingsRoute.use("/subjects", subject_route_1.default);
settingsRoute.use("/classrooms", classroom_route_1.default);
settingsRoute.use("/lesson-slots", lesson_slot_route_1.default);
settingsRoute.use("/tuition-fees", tuition_fee_route_1.default);
exports.default = settingsRoute;
//# sourceMappingURL=settings.route.js.map