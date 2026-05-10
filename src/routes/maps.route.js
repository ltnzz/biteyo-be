import express from 'express';

import { searchLocation } from '../controllers/maps.controller.js';
import { locationLimiter } from '../utils/rate.limit.js';

const router = express.Router();

router.get('/location/search', locationLimiter, searchLocation);

export default router;