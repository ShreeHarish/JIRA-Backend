const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const issueController = require('../controllers/issueController');

router.post('/', projectController.createProject);
router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.get('/:id/board', projectController.getProjectBoard);
router.get('/:id/activity', projectController.getProjectActivity);
router.get('/:id/sprints', projectController.getProjectSprints);
router.post('/:id/issues', issueController.createIssue);

module.exports = router;
