import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { idParamSchema } from '@utils/params';
import * as controller from './transferencia.controller';
import { crearTransferenciaConForzarSchema, listaTransferenciaQuerySchema } from './transferencia.schema';

const router = Router();

router.use(authenticate);

router.post('/', validate(crearTransferenciaConForzarSchema), controller.crear);
router.get('/', validate(listaTransferenciaQuerySchema, 'query'), controller.listar);
router.get('/:id', validate(idParamSchema, 'params'), controller.obtener);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminar);

export const transferenciaRoutes = router;