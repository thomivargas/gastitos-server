import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { idParamSchema } from '@utils/params';
import * as controller from './etiqueta.controller';
import { crearEtiquetaSchema, actualizarEtiquetaSchema } from './etiqueta.schema';

const router = Router();

router.use(authenticate);

router.post('/', validate(crearEtiquetaSchema), controller.crear);
router.get('/', controller.listar);
router.patch('/:id', validate(idParamSchema, 'params'), validate(actualizarEtiquetaSchema), controller.actualizar);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminar);

export const etiquetaRoutes = router;
