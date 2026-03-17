-- CreateEnum
CREATE TYPE "TipoInstitucion" AS ENUM ('BANCO', 'BILLETERA_VIRTUAL', 'OTRA');

-- AlterEnum
ALTER TYPE "TipoCuenta" ADD VALUE 'BILLETERA_VIRTUAL';

-- CreateTable
CREATE TABLE "instituciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoInstitucion" NOT NULL DEFAULT 'BANCO',
    "color" TEXT NOT NULL DEFAULT '#6172F3',
    "icono" TEXT NOT NULL DEFAULT 'landmark',
    "oficial" BOOLEAN NOT NULL DEFAULT false,
    "usuario_id" TEXT,

    CONSTRAINT "instituciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instituciones_oficial_idx" ON "instituciones"("oficial");

-- CreateIndex
CREATE INDEX "instituciones_usuario_id_idx" ON "instituciones"("usuario_id");

-- CreateIndex
CREATE INDEX "instituciones_nombre_idx" ON "instituciones"("nombre");

-- AlterTable
ALTER TABLE "cuentas" DROP COLUMN "institucion",
ADD COLUMN "institucion_id" TEXT;

-- AlterTable
ALTER TABLE "transacciones" ADD COLUMN "monto_original" DECIMAL(19,4),
ADD COLUMN "moneda_original" TEXT;

-- AddForeignKey
ALTER TABLE "instituciones" ADD CONSTRAINT "instituciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_institucion_id_fkey" FOREIGN KEY ("institucion_id") REFERENCES "instituciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
