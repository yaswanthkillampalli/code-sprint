const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');

router.post('/create', assessmentController.createAssessment);
router.get('/all', assessmentController.getAllAssessments);
router.put('/:id', assessmentController.updateAssessment);
router.get('/:id', assessmentController.getAssessmentById);
router.get('/:id/questions', assessmentController.getQuestionsByAssessmentId);
router.put('/:id/status/:status', assessmentController.updateStatusOfAssessment);
router.delete('/:id', assessmentController.deleteAssessment);

module.exports = router;