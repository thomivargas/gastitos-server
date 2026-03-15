import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { convertirQuerySchema } from './moneda.schema';
import * as controller from './moneda.controller';

const router = Router();

router.use(authenticate);

router.get('/tasas', controller.obtenerTasas);
router.get('/convertir', validate(convertirQuerySchema, 'query'), controller.convertirMonto);
router.post('/actualizar-tasas', controller.actualizarTasas);

export const monedaRoutes = router;
