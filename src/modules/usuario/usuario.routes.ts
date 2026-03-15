import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import * as controller from './usuario.controller';
import { actualizarPerfilSchema } from './usuario.schema';

const router = Router();

router.use(authenticate);

router.get('/perfil', controller.obtenerPerfil);
router.patch('/perfil', validate(actualizarPerfilSchema), controller.actualizarPerfil);

export const usuarioRoutes = router;
