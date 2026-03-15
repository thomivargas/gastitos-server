import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { idParamSchema } from '@utils/params';
import * as controller from './cuenta.controller';
import { crearCuentaSchema, actualizarCuentaSchema, listaCuentasQuerySchema } from './cuenta.schema';

const router = Router();

router.use(authenticate);

router.post('/', validate(crearCuentaSchema), controller.crear);
router.get('/', validate(listaCuentasQuerySchema, 'query'), controller.listar);
router.get('/resumen', controller.obtenerResumen);
router.get('/:id', validate(idParamSchema, 'params'), controller.obtener);
router.patch('/:id', validate(idParamSchema, 'params'), validate(actualizarCuentaSchema), controller.actualizar);
router.patch('/:id/archivar', validate(idParamSchema, 'params'), controller.archivar);
router.patch('/:id/reactivar', validate(idParamSchema, 'params'), controller.reactivar);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminar);

export const cuentaRoutes = router;
