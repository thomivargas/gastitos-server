import { z } from 'zod';

export const registroSchema = z.object({
  email: z.string().email('Email invalido').toLowerCase().trim(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100).trim(),
  password: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
    .regex(/[0-9]/, 'Debe contener al menos un numero'),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalido').toLowerCase().trim(),
  password: z.string().min(1, 'La contrasena es requerida'),
});

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'La contrasena actual es requerida'),
  passwordNueva: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
    .regex(/[0-9]/, 'Debe contener al menos un numero'),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;
