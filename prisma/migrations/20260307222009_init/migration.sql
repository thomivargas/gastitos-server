-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('EFECTIVO', 'BANCO_CORRIENTE', 'BANCO_AHORRO', 'TARJETA_CREDITO', 'INVERSION', 'PRESTAMO', 'OTRO_ACTIVO', 'OTRO_PASIVO');

-- CreateEnum
CREATE TYPE "ClasificacionCuenta" AS ENUM ('ACTIVO', 'PASIVO');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('ACTIVA', 'INACTIVA', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "ClasificacionCategoria" AS ENUM ('INGRESO', 'GASTO');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('INGRESO', 'GASTO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "FrecuenciaRecurrencia" AS ENUM ('DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "preferencias" JSONB NOT NULL DEFAULT '{}',
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "clasificacion" "ClasificacionCuenta" NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'ACTIVA',
    "institucion" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6172F3',
    "icono" TEXT NOT NULL DEFAULT 'wallet',
    "notas" TEXT,
    "detalles" JSONB NOT NULL DEFAULT '{}',
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6172F3',
    "icono" TEXT NOT NULL DEFAULT 'shapes',
    "clasificacion" "ClasificacionCategoria" NOT NULL,
    "padre_id" TEXT,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6172F3',
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "categoria_id" TEXT,
    "tipo" "TipoTransaccion" NOT NULL,
    "monto" DECIMAL(19,4) NOT NULL,
    "moneda" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "notas" TEXT,
    "excluida" BOOLEAN NOT NULL DEFAULT false,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones_etiquetas" (
    "transaccion_id" TEXT NOT NULL,
    "etiqueta_id" TEXT NOT NULL,

    CONSTRAINT "transacciones_etiquetas_pkey" PRIMARY KEY ("transaccion_id","etiqueta_id")
);

-- CreateTable
CREATE TABLE "transferencias" (
    "id" TEXT NOT NULL,
    "transaccion_origen_id" TEXT NOT NULL,
    "transaccion_destino_id" TEXT NOT NULL,
    "cuenta_origen_id" TEXT NOT NULL,
    "cuenta_destino_id" TEXT NOT NULL,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "gasto_presupuestado" DECIMAL(19,4),
    "ingreso_esperado" DECIMAL(19,4),
    "moneda" TEXT NOT NULL,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuesto_categorias" (
    "id" TEXT NOT NULL,
    "presupuesto_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "monto_presupuestado" DECIMAL(19,4) NOT NULL,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuesto_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones_recurrentes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "categoria_id" TEXT,
    "tipo" "TipoTransaccion" NOT NULL,
    "monto" DECIMAL(19,4) NOT NULL,
    "moneda" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "frecuencia" "FrecuenciaRecurrencia" NOT NULL,
    "dia_del_mes" INTEGER,
    "dia_de_la_semana" INTEGER,
    "proxima_fecha" DATE NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transacciones_recurrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balances_historicos" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "balance" DECIMAL(19,4) NOT NULL,
    "moneda" TEXT NOT NULL,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balances_historicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasas_cambio" (
    "id" TEXT NOT NULL,
    "moneda_origen" TEXT NOT NULL,
    "moneda_destino" TEXT NOT NULL,
    "tasa" DECIMAL(19,10) NOT NULL,
    "fecha" DATE NOT NULL,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasas_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "cuentas_usuario_id_estado_idx" ON "cuentas"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "cuentas_usuario_id_tipo_idx" ON "cuentas"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "categorias_usuario_id_clasificacion_idx" ON "categorias"("usuario_id", "clasificacion");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_usuario_id_nombre_padre_id_key" ON "categorias"("usuario_id", "nombre", "padre_id");

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_usuario_id_nombre_key" ON "etiquetas"("usuario_id", "nombre");

-- CreateIndex
CREATE INDEX "transacciones_cuenta_id_fecha_idx" ON "transacciones"("cuenta_id", "fecha");

-- CreateIndex
CREATE INDEX "transacciones_usuario_id_fecha_idx" ON "transacciones"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "transacciones_categoria_id_idx" ON "transacciones"("categoria_id");

-- CreateIndex
CREATE INDEX "transacciones_tipo_idx" ON "transacciones"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "transferencias_transaccion_origen_id_key" ON "transferencias"("transaccion_origen_id");

-- CreateIndex
CREATE UNIQUE INDEX "transferencias_transaccion_destino_id_key" ON "transferencias"("transaccion_destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_usuario_id_fecha_inicio_fecha_fin_key" ON "presupuestos"("usuario_id", "fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE UNIQUE INDEX "presupuesto_categorias_presupuesto_id_categoria_id_key" ON "presupuesto_categorias"("presupuesto_id", "categoria_id");

-- CreateIndex
CREATE INDEX "transacciones_recurrentes_usuario_id_activa_idx" ON "transacciones_recurrentes"("usuario_id", "activa");

-- CreateIndex
CREATE INDEX "transacciones_recurrentes_proxima_fecha_idx" ON "transacciones_recurrentes"("proxima_fecha");

-- CreateIndex
CREATE INDEX "balances_historicos_cuenta_id_fecha_idx" ON "balances_historicos"("cuenta_id", "fecha" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "balances_historicos_cuenta_id_fecha_key" ON "balances_historicos"("cuenta_id", "fecha");

-- CreateIndex
CREATE INDEX "tasas_cambio_moneda_origen_idx" ON "tasas_cambio"("moneda_origen");

-- CreateIndex
CREATE INDEX "tasas_cambio_moneda_destino_idx" ON "tasas_cambio"("moneda_destino");

-- CreateIndex
CREATE UNIQUE INDEX "tasas_cambio_moneda_origen_moneda_destino_fecha_key" ON "tasas_cambio"("moneda_origen", "moneda_destino", "fecha");

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etiquetas" ADD CONSTRAINT "etiquetas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_etiquetas" ADD CONSTRAINT "transacciones_etiquetas_transaccion_id_fkey" FOREIGN KEY ("transaccion_id") REFERENCES "transacciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_etiquetas" ADD CONSTRAINT "transacciones_etiquetas_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_transaccion_origen_id_fkey" FOREIGN KEY ("transaccion_origen_id") REFERENCES "transacciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_transaccion_destino_id_fkey" FOREIGN KEY ("transaccion_destino_id") REFERENCES "transacciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_cuenta_origen_id_fkey" FOREIGN KEY ("cuenta_origen_id") REFERENCES "cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_cuenta_destino_id_fkey" FOREIGN KEY ("cuenta_destino_id") REFERENCES "cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_categorias" ADD CONSTRAINT "presupuesto_categorias_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_categorias" ADD CONSTRAINT "presupuesto_categorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_recurrentes" ADD CONSTRAINT "transacciones_recurrentes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balances_historicos" ADD CONSTRAINT "balances_historicos_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
