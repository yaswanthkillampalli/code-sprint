const express = require('express');
const router = express.Router();
const multer = require('multer');
const assessmentController = require('../controllers/assessmentController');

// Configure multer for memory storage (for Excel processing)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/create', upload.single('file'), assessmentController.createAssessment);
router.get('/all', assessmentController.getAllAssessments);
router.get('/current', assessmentController.getCurrentAssessment);
router.get('/:id', assessmentController.getAssessmentById);
router.get('/:id/questions', assessmentController.getQuestionsByAssessmentId);
router.put('/:id/status/:status', assessmentController.updateStatusOfAssessment);
router.delete('/:id', assessmentController.deleteAssessment);

module.exports = router;