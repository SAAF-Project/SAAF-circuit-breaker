CREATE TABLE IF NOT EXISTS order_budgets (
  id text PRIMARY KEY,
  order_total double precision NOT NULL CHECK (order_total >= 0),
  authorized_cents integer NOT NULL DEFAULT 0 CHECK (authorized_cents >= 0)
);
