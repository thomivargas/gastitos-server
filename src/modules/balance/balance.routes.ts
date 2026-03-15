import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { historialQuerySchema, patrimonioQuerySchema } from './balance.schema';
import * as controller from './balance.controller';

const router = Router();

router.use(authenticate);

router.post('/snapshot', controller.generarSnapshot);
router.get('/historial', validate(historialQuerySchema, 'query'), controller.obtenerHistorial);
router.get('/patrimonio', validate(patrimonioQuerySchema, 'query'), controller.obtenerPatrimonio);

export const balanceRoutes = router;
