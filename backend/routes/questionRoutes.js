const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

router.post('/create', questionController.createQuestion);
router.get('/all', questionController.getAllQuestions);
router.get('/all/with-progress', questionController.getAllQuestionsWithProgress);
router.get('/:id', questionController.getQuestionById);
module.exports = router;