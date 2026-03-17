import { Router } from 'express';
import {
  authRoutes,
  adminRoutes,
  balanceRoutes,
  categoriaRoutes,
  cuentaRoutes,
  etiquetaRoutes,
  importacionRoutes,
  institucionRoutes,
  monedaRoutes,
  presupuestoRoutes,
  recurrenteRoutes,
  reglaRoutes,
  reporteRoutes,
  transaccionRoutes,
  transferenciaRoutes,
  usuarioRoutes,
} from '../modules/index';

const router = Router();

router.use(`/auth`, authRoutes);
router.use(`/usuario`, usuarioRoutes);
router.use(`/cuentas`, cuentaRoutes);
router.use(`/categorias`, categoriaRoutes);
router.use(`/etiquetas`, etiquetaRoutes);
router.use(`/transacciones`, transaccionRoutes);
router.use(`/transferencias`, transferenciaRoutes);
router.use(`/presupuestos`, presupuestoRoutes);
router.use(`/recurrentes`, recurrenteRoutes);
router.use(`/balances`, balanceRoutes);
router.use(`/reportes`, reporteRoutes);
router.use(`/instituciones`, institucionRoutes);
router.use(`/monedas`, monedaRoutes);
router.use(`/importacion`, importacionRoutes);
router.use(`/reglas`, reglaRoutes);
router.use(`/admin`, adminRoutes);

export default router;