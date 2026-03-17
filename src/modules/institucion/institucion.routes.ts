import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { idParamSchema } from '@utils/params';
import * as controller from './institucion.controller';
import { crearInstitucionSchema, actualizarInstitucionSchema, listarInstitucionesSchema } from './institucion.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listarInstitucionesSchema, 'query'), controller.listar);
router.post('/', validate(crearInstitucionSchema), controller.crear);
router.patch('/:id', validate(idParamSchema, 'params'), validate(actualizarInstitucionSchema), controller.actualizar);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminar);

export const institucionRoutes = router;
