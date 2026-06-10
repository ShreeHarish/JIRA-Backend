const express = require('express');
const router = express.Router();
const sprintController = require('../controllers/sprintController');

router.post('/', sprintController.createSprint);
router.patch('/:id', sprintController.updateSprint);
router.post('/:id/start', sprintController.startSprint);
router.post('/:id/complete', sprintController.completeSprint);
router.post('/:id/issues', sprintController.addIssuesToSprint);

module.exports = router;
