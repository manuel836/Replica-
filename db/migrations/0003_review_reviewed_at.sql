-- Migración 0003: saber si el dueño ya revisó una reseña (publicada o no).
-- Sin esto, las reseñas que el dueño decidía no publicar volvían a la cola para siempre.
alter table reviews add column reviewed_at timestamptz;
update reviews set reviewed_at = created_at where is_published;
create index reviews_business_pending on reviews (business_id, created_at) where reviewed_at is null;
