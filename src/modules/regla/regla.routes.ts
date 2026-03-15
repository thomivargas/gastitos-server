import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { crearReglaSchema, actualizarReglaSchema, sugerirSchema } from './regla.schema';
import { idParamSchema } from '@utils/params';
import * as controller from './regla.controller';

const router = Router();

router.use(authenticate);

router.get('/', controller.listarReglas);
router.post('/', validate(crearReglaSchema, 'body'), controller.crearRegla);
router.post('/aplicar', controller.aplicarReglas);
router.post('/sugerir', validate(sugerirSchema, 'body'), controller.sugerirCategoria);
router.get('/:id', validate(idParamSchema, 'params'), controller.obtenerRegla);
router.put('/:id', validate(idParamSchema, 'params'), validate(actualizarReglaSchema, 'body'), controller.actualizarRegla);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminarRegla);

export const reglaRoutes = router;
