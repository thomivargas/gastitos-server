import { Router } from 'express'
import { authenticate } from '@middlewares/auth.middleware'
import * as controller from './mp.controller'

const router = Router()

// Rutas protegidas (requieren JWT)
router.get('/conectar', authenticate, controller.iniciarConexion)
router.get('/estado', authenticate, controller.obtenerEstado)
router.delete('/desconectar', authenticate, controller.desconectar)

// Callback: sin JWT (redirect de MP)
router.get('/callback', controller.callback)

// Webhook placeholder (implementado en Task 5)
// router.post('/webhook', handleWebhook)

export const mpRoutes = router
