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

// Body del webhook de MP
export const webhookBodySchema = z.object({
  id: z.number().optional(),
  type: z.string(),
  user_id: z.number().optional(),
  action: z.string().optional(),
  data: z.object({
    id: z.union([z.string(), z.number()]),
  }).optional(),
  live_mode: z.boolean().optional(),
})

export type CallbackQuery = z.infer<typeof callbackQuerySchema>
export type ConectarQuery = z.infer<typeof conectarQuerySchema>
export type WebhookBody = z.infer<typeof webhookBodySchema>
