import { Router } from 'express';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { authLimiter } from '@middlewares/rate-limit.middleware';
import { idParamSchema } from '@utils/params';
import * as controller from './auth.controller';
import { registroSchema, loginSchema, cambiarPasswordSchema } from './auth.schema';

const router = Router();

// Rutas publicas (con rate limit estricto)
router.post('/registro', authLimiter, validate(registroSchema, 'body'), controller.registrar);
router.post('/login', authLimiter, validate(loginSchema, 'body'), controller.login);
router.post('/refresh', controller.refresh);   // token viene en cookie, no en body
router.post('/logout', controller.logout);      // no requiere auth (borra cookie)

// Rutas protegidas
router.post('/cambiar-password', authenticate, validate(cambiarPasswordSchema, 'body'), controller.cambiarPassword);
router.get('/sesiones', authenticate, controller.listarSesiones);
router.delete('/sesiones', authenticate, controller.cerrarTodasSesiones);
router.delete('/sesiones/:id', authenticate, validate(idParamSchema, 'params'), controller.cerrarSesion);

// Rutas de autenticación con Google
router.get("/google", controller.googleAuth);
router.get("/google/callback", controller.googleCallback);

export const authRoutes = router;
