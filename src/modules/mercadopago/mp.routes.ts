import { Router } from 'express'
import { authenticate } from '@middlewares/auth.middleware'
import * as controller from './mp.controller'

const router = Router()

// Rutas protegidas (requieren JWT)
router.get('/conectar', authenticate, controller.iniciarConexion)
router.get('/estado', authenticate, controller.obtenerEstado)
router.delete('/desconectar', authenticate, controller.desconectar)
router.post('/sincronizar', authenticate, controller.sincronizar)

// Callback: sin JWT (redirect de MP)
router.get('/callback', controller.callback)

export const mpRoutes = router
