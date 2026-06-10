const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');

router.post('/', issueController.createIssue);
router.get('/:id', issueController.getIssueById);
router.patch('/:id', issueController.updateIssue);
router.post('/:id/transitions', issueController.transitionIssue);
router.get('/:id/comments', issueController.getIssueComments);
router.post('/:id/comments', issueController.addComment);
router.post('/:id/watch', issueController.watchIssue);
router.delete('/:id/watch', issueController.unwatchIssue);

module.exports = router;
