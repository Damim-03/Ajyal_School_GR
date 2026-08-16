import { Router } from "express";
import schoolRoutes from "../modules/school/school.route";
import academicYearRoutes from "../modules/academic-year/academic-year.route";
import educationStageRoutes from "../modules/education-stage/education-stage.route";
import levelRoutes from "../modules/level/level.route";
import studyGroupRoutes from "../modules/study-group/study-group.route";
import subjectRoutes from "../modules/subject/subject.route";
import classroomRoutes from "../modules/classroom/classroom.route";
import lessonSlotRoutes from "../modules/lesson-slot/lesson-slot.route";
import tuitionFeeRoutes from "../modules/tuition-fee/tuition-fee.route";

// --------------------------------------------------
// Settings — البيانات المرجعية التي تضبطها الإدارة
// مطابق لما تتوقعه الواجهة في core/api/endpoints.ts
//
// الترتيب يعكس التبعية:
//   EducationStage → Level → StudyGroup → TuitionFee
// --------------------------------------------------

const settingsRoute: Router = Router();

// هوية المدرسة — مفتاح/قيمة، لا مورد CRUD
settingsRoute.use("/school", schoolRoutes);

settingsRoute.use("/academic-years", academicYearRoutes);
settingsRoute.use("/education-stages", educationStageRoutes);
settingsRoute.use("/levels", levelRoutes);
settingsRoute.use("/study-groups", studyGroupRoutes);
settingsRoute.use("/subjects", subjectRoutes);
settingsRoute.use("/classrooms", classroomRoutes);
settingsRoute.use("/lesson-slots", lessonSlotRoutes);
settingsRoute.use("/tuition-fees", tuitionFeeRoutes);

export default settingsRoute;
