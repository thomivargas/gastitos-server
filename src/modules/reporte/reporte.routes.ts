import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  resumenMensualQuerySchema,
  rangoFechaQuerySchema,
  tendenciaMensualQuerySchema,
  flujoCajaQuerySchema,
  topGastosQuerySchema,
} from './reporte.schema';
import * as controller from './reporte.controller';

const router = Router();

router.use(authenticate);

router.get('/resumen-mensual', validate(resumenMensualQuerySchema, 'query'), controller.resumenMensual);
router.get('/gastos-por-categoria', validate(rangoFechaQuerySchema, 'query'), controller.gastoPorCategoria);
router.get('/ingresos-por-categoria', validate(rangoFechaQuerySchema, 'query'), controller.ingresoPorCategoria);
router.get('/tendencia-mensual', validate(tendenciaMensualQuerySchema, 'query'), controller.tendenciaMensual);
router.get('/flujo-de-caja', validate(flujoCajaQuerySchema, 'query'), controller.flujoDeCaja);
router.get('/top-gastos', validate(topGastosQuerySchema, 'query'), controller.topGastos);

export const reporteRoutes = router;
