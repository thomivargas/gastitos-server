import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { idParamSchema } from '@utils/params';
import { crearRecurrenteSchema, actualizarRecurrenteSchema } from './recurrente.schema';
import * as controller from './recurrente.controller';

const router = Router();

router.use(authenticate);

router.post('/generar', controller.generarPendientes);
router.post('/', validate(crearRecurrenteSchema), controller.crearRecurrente);
router.get('/', controller.listarRecurrentes);
router.get('/:id', validate(idParamSchema, 'params'), controller.obtenerRecurrente);
router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(actualizarRecurrenteSchema),
  controller.actualizarRecurrente
);
router.patch('/:id/activar', validate(idParamSchema, 'params'), controller.activarRecurrente);
router.patch('/:id/desactivar', validate(idParamSchema, 'params'), controller.desactivarRecurrente);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminarRecurrente);

export const recurrenteRoutes = router;
