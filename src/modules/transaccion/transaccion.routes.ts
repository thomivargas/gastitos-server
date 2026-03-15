import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { idParamSchema } from '@utils/params';
import * as controller from './transaccion.controller';
import {
  crearTransaccionSchema,
  actualizarTransaccionSchema,
  listaTransaccionQuerySchema,
} from './transaccion.schema';

const router = Router();

router.use(authenticate);

router.post('/', validate(crearTransaccionSchema), controller.crear);
router.get('/', validate(listaTransaccionQuerySchema, 'query'), controller.listar);
router.get('/:id', validate(idParamSchema, 'params'), controller.obtener);
router.patch('/:id', validate(idParamSchema, 'params'), validate(actualizarTransaccionSchema), controller.actualizar);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminar);

export const transaccionRoutes = router;
