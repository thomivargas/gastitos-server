import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { idParamSchema } from '@utils/params';
import * as controller from './categoria.controller';
import { crearCategoriaSchema, actualizarCategoriaSchema, listaCategoriaQuerySchema } from './categoria.schema';

const router = Router();

router.use(authenticate);

router.post('/', validate(crearCategoriaSchema), controller.crear);
router.get('/', validate(listaCategoriaQuerySchema, 'query'), controller.listar);
router.get('/:id', validate(idParamSchema, 'params'), controller.obtener);
router.patch('/:id', validate(idParamSchema, 'params'), validate(actualizarCategoriaSchema), controller.actualizar);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminar);

export const categoriaRoutes = router;
