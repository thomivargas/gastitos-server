-- CreateTable
CREATE TABLE "reglas_categorizacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "patron" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglas_categorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reglas_categorizacion_usuario_id_activa_idx" ON "reglas_categorizacion"("usuario_id", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "reglas_categorizacion_usuario_id_nombre_key" ON "reglas_categorizacion"("usuario_id", "nombre");

-- AddForeignKey
ALTER TABLE "reglas_categorizacion" ADD CONSTRAINT "reglas_categorizacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_categorizacion" ADD CONSTRAINT "reglas_categorizacion_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
