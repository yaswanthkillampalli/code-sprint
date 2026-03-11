const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

router.post('/create', questionController.createQuestion);
router.get('/all', questionController.getAllQuestions);
router.get('/all/full', questionController.getAllQuestionsFull);
router.get('/all/with-progress', questionController.getAllQuestionsWithProgress);
router.get('/:id', questionController.getQuestionById);
router.put('/:id', questionController.updateQuestion);
router.delete('/:id', questionController.deleteQuestion);
module.exports = router;