-- AlterTable: agregar mp_payment_id a transacciones
ALTER TABLE "transacciones" ADD COLUMN "mp_payment_id" TEXT;
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_mp_payment_id_key" UNIQUE ("mp_payment_id");

-- CreateTable: conexiones_mercadopago
CREATE TABLE "conexiones_mercadopago" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "mp_usuario_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "revocada" BOOLEAN NOT NULL DEFAULT false,
    "creado_el" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conexiones_mercadopago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conexiones_mercadopago_usuario_id_key" ON "conexiones_mercadopago"("usuario_id");
CREATE UNIQUE INDEX "conexiones_mercadopago_cuenta_id_key" ON "conexiones_mercadopago"("cuenta_id");

-- AddForeignKey
ALTER TABLE "conexiones_mercadopago" ADD CONSTRAINT "conexiones_mercadopago_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexiones_mercadopago" ADD CONSTRAINT "conexiones_mercadopago_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
