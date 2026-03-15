import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { idParamSchema } from '@utils/params';
import { z } from 'zod';
import {
  crearPresupuestoSchema,
  actualizarPresupuestoSchema,
  asignarCategoriaSchema,
  listaPresupuestoQuerySchema,
  copiarPresupuestoSchema,
} from './presupuesto.schema';
import * as controller from './presupuesto.controller';

const router = Router();

router.use(authenticate);

router.post('/', validate(crearPresupuestoSchema), controller.crearPresupuesto);
router.get('/', validate(listaPresupuestoQuerySchema, 'query'), controller.listarPresupuestos);
router.get('/actual', controller.obtenerPresupuestoActual);
router.get('/:id', validate(idParamSchema, 'params'), controller.obtenerPresupuesto);
router.get('/:id/progreso', validate(idParamSchema, 'params'), controller.obtenerProgreso);
router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(actualizarPresupuestoSchema),
  controller.actualizarPresupuesto
);
router.post(
  '/:id/categorias',
  validate(idParamSchema, 'params'),
  validate(asignarCategoriaSchema),
  controller.asignarCategoria
);
router.delete(
  '/:id/categorias/:categoriaId',
  validate(idParamSchema.extend({ categoriaId: z.string().uuid() }), 'params'),
  controller.eliminarCategoria
);
router.post(
  '/:id/copiar',
  validate(idParamSchema, 'params'),
  validate(copiarPresupuestoSchema),
  controller.copiarPresupuesto
);
router.delete('/:id', validate(idParamSchema, 'params'), controller.eliminarPresupuesto);

export const presupuestoRoutes = router;
