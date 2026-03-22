import { Router } from 'express'
import { authenticate } from '@middlewares/auth.middleware'
import * as controller from './mp.controller'
import { handleWebhook } from './mp.webhook'

const router = Router()

// Rutas protegidas (requieren JWT)
router.get('/conectar', authenticate, controller.iniciarConexion)
router.get('/estado', authenticate, controller.obtenerEstado)
router.delete('/desconectar', authenticate, controller.desconectar)
router.post('/sincronizar', authenticate, controller.sincronizar)

// Callback: sin JWT (redirect de MP)
router.get('/callback', controller.callback)

// Webhook: sin JWT (llamado por Mercado Pago)
router.post('/webhook', handleWebhook)

export const mpRoutes = router
