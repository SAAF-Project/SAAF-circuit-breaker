"""Atomic authorization reservations. Use a stable SQLite path across CLI invocations.
No automatic release: authorize != execute; reconcile externally before any release.
"""
import sqlite3
from contextlib import contextmanager

class OrderBudgets:
    def __init__(self, path=":memory:"):
        self.db = sqlite3.connect(str(path), timeout=2, check_same_thread=False, isolation_level=None)
        self.db.execute("CREATE TABLE IF NOT EXISTS order_budgets (id TEXT PRIMARY KEY, total REAL NOT NULL, cents INTEGER NOT NULL CHECK(cents >= 0))")

    @contextmanager
    def locked(self, order_id, total):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            row = self.db.execute("SELECT total, cents FROM order_budgets WHERE id = ?", (order_id,)).fetchone()
            if row and row[0] != total:
                raise ValueError("ORDER_TOTAL_CONFLICT")
            if row is None:
                if self.db.execute("SELECT count(*) FROM order_budgets").fetchone()[0] >= 10000:
                    raise ValueError("ORDER_BUDGET_LIMIT")
                self.db.execute("INSERT INTO order_budgets VALUES (?, ?, 0)", (order_id, total))
            yield (row[1] if row else 0) / 100
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def reserve(self, order_id, amount):
        self.db.execute("UPDATE order_budgets SET cents = cents + ? WHERE id = ?", (round(amount * 100), order_id))
