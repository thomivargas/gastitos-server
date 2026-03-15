import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { exportarQuerySchema } from './importacion.schema';
import * as controller from './importacion.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'));
    }
  },
});

const router = Router();

router.use(authenticate);

router.post('/preview', upload.single('archivo'), controller.previewCSV);
router.post('/ejecutar', upload.single('archivo'), controller.ejecutarImport);
router.get('/exportar', validate(exportarQuerySchema, 'query'), controller.exportarCSV);
router.get('/plantilla', controller.descargarPlantilla);

export const importacionRoutes = router;
