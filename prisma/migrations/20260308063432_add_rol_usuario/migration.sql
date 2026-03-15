-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('USUARIO', 'ADMIN');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "rol" "Rol" NOT NULL DEFAULT 'USUARIO';
