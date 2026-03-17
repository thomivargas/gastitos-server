-- AddForeignKey
ALTER TABLE "transacciones_recurrentes" ADD CONSTRAINT "transacciones_recurrentes_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
