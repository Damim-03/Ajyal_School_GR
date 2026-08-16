"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLessonSlotController = exports.updateLessonSlotController = exports.createLessonSlotController = exports.getLessonSlotController = exports.listLessonSlotsController = void 0;
const api_response_1 = require("../../core/config/api-response");
const lesson_slot_service_1 = require("./lesson-slot.service");
const listLessonSlotsController = async (req, res) => {
    const query = req.query;
    const { lessonSlots, pagination } = await (0, lesson_slot_service_1.listLessonSlotsService)(query);
    return api_response_1.ApiResponse.paginated(res, lessonSlots, pagination, "Lesson slots retrieved");
};
exports.listLessonSlotsController = listLessonSlotsController;
const getLessonSlotController = async (req, res) => {
    const lessonSlot = await (0, lesson_slot_service_1.getLessonSlotService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { lessonSlot }, "Lesson slot retrieved");
};
exports.getLessonSlotController = getLessonSlotController;
const createLessonSlotController = async (req, res) => {
    const lessonSlot = await (0, lesson_slot_service_1.createLessonSlotService)(req.body);
    return api_response_1.ApiResponse.created(res, { lessonSlot }, "Lesson slot created");
};
exports.createLessonSlotController = createLessonSlotController;
const updateLessonSlotController = async (req, res) => {
    const lessonSlot = await (0, lesson_slot_service_1.updateLessonSlotService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { lessonSlot }, "Lesson slot updated");
};
exports.updateLessonSlotController = updateLessonSlotController;
const deleteLessonSlotController = async (req, res) => {
    await (0, lesson_slot_service_1.deleteLessonSlotService)(req.params.id);
    return api_response_1.ApiResponse.success(res, null, "Lesson slot deleted");
};
exports.deleteLessonSlotController = deleteLessonSlotController;
//# sourceMappingURL=lesson-slot.controller.js.map