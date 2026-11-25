-- Correos al cliente (si dejó su correo): una plantilla nueva para "cambio guardado", y el
-- recordatorio automático se limita a uno por canal (correo y, más adelante, WhatsApp por API).

alter table messages drop constraint messages_template_check;
alter table messages add constraint messages_template_check check (template in (
  'request_received', 'new_request_owner', 'confirmed', 'declined', 'proposal',
  'reminder', 'cancelled', 'review_request', 'payment_link', 'changed'
));

drop index messages_one_auto_reminder;
create unique index messages_one_auto_reminder on messages (booking_id, channel)
  where template = 'reminder' and mode = 'api';
