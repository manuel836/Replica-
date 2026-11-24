import "server-only";

/**
 * Avisos al dueño (solicitud nueva, pago que requiere atención, resumen diario).
 * Hoy se escriben en la consola del servidor; /replica-backend los manda por correo con Resend.
 */
export async function notifyOwner(subject: string, body: string): Promise<void> {
  console.info(`[aviso al dueño] ${subject}\n${body}`);
}
