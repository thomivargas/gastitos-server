/*
  Warnings:

  - You are about to drop the `presupuesto_categorias` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `presupuestos` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[google_id]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "presupuesto_categorias" DROP CONSTRAINT "presupuesto_categorias_categoria_id_fkey";

-- DropForeignKey
ALTER TABLE "presupuesto_categorias" DROP CONSTRAINT "presupuesto_categorias_presupuesto_id_fkey";

-- DropForeignKey
ALTER TABLE "presupuestos" DROP CONSTRAINT "presupuestos_usuario_id_fkey";

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "google_id" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- DropTable
DROP TABLE "presupuesto_categorias";

-- DropTable
DROP TABLE "presupuestos";

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");
