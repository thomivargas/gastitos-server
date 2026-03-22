import { z } from 'zod'

// Query params del callback de OAuth
export const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

// Query params del endpoint /conectar
export const conectarQuerySchema = z.object({
  cuentaId: z.string().uuid('cuentaId debe ser un UUID válido'),
})

export type CallbackQuery = z.infer<typeof callbackQuerySchema>
export type ConectarQuery = z.infer<typeof conectarQuerySchema>
