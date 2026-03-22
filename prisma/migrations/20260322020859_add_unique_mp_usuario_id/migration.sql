-- Add unique constraint to mpUsuarioId
CREATE UNIQUE INDEX "conexiones_mercadopago_mp_usuario_id_key" ON "conexiones_mercadopago"("mp_usuario_id");
