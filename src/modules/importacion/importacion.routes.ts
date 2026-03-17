import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@middlewares/auth.middleware';
import * as controller from './importacion.controller';

const TIPOS_PERMITIDOS = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const esValido =
      TIPOS_PERMITIDOS.includes(file.mimetype) ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls');

    if (esValido) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV o Excel (.xlsx, .xls)'));
    }
  },
});

const router = Router();

router.use(authenticate);

router.post('/preview', upload.single('archivo'), controller.previewCSV);
router.post('/ejecutar', upload.single('archivo'), controller.ejecutarImport);

// Rutas bancarias
router.get('/parsers', controller.listarParsers);
router.post('/preview-bancario', upload.single('archivo'), controller.previewBancario);
router.post('/ejecutar-bancario', upload.single('archivo'), controller.ejecutarImportBancario);

export const importacionRoutes = router;
