import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, "btos.db"));
  db.pragma("journal_mode = WAL");
  migrate(db);
  migrateV2(db);
  migrateV3(db);
  migrateV4(db);
  migrateV5(db);
  migrateV6(db);
  return db;
}

/** Add a column if it doesn't exist yet (SQLite has no IF NOT EXISTS for columns). */
function addColumn(db: Database.Database, table: string, ddl: string) {
  const col = ddl.split(" ")[0];
  const exists = (db.pragma(`table_info(${table})`) as { name: string }[]).some(
    (c) => c.name === col
  );
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

/**
 * v2: second-brain schema. Extends todos into a full task model, deals into a
 * sponsorship CRM, and adds areas/projects/notes/goals/content_items/expenses/
 * weekly_reviews. Existing rows keep working: legacy todos become status
 * 'next', legacy deal statuses are mapped onto the new stage enum.
 */
function migrateV2(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= 2) return;

  // ---- tasks (extends todos in place; table name kept for compatibility)
  addColumn(db, "todos", "notes TEXT");
  addColumn(db, "todos", "status TEXT NOT NULL DEFAULT 'next'"); // inbox|next|in_progress|waiting|scheduled|someday|done|cancelled
  addColumn(db, "todos", "priority INTEGER"); // 1 high, 2 medium, 3 low, NULL none
  addColumn(db, "todos", "due_date TEXT"); // hard deadline, distinct from created_date rollover
  addColumn(db, "todos", "area_id INTEGER");
  addColumn(db, "todos", "project_id INTEGER");
  addColumn(db, "todos", "waiting_on TEXT"); // who/what it's blocked on
  addColumn(db, "todos", "estimate_mins INTEGER");
  addColumn(db, "todos", "recurrence TEXT"); // daily|weekly|monthly
  addColumn(db, "todos", "top3_date TEXT"); // YYYY-MM-DD it's flagged as a Top 3
  addColumn(db, "todos", "updated_at TEXT");
  db.exec("UPDATE todos SET updated_at = created_at WHERE updated_at IS NULL");

  // ---- deals → sponsorship CRM
  addColumn(db, "deals", "campaign TEXT");
  addColumn(db, "deals", "deliverables TEXT");
  addColumn(db, "deals", "agency_fee REAL"); // subtracted from price (gross) for net
  addColumn(db, "deals", "contract_status TEXT NOT NULL DEFAULT 'none'"); // none|sent|signed
  addColumn(db, "deals", "publish_date TEXT");
  addColumn(db, "deals", "invoice_status TEXT NOT NULL DEFAULT 'not_sent'"); // not_sent|sent|paid
  addColumn(db, "deals", "invoice_date TEXT");
  addColumn(db, "deals", "payment_due TEXT");
  addColumn(db, "deals", "payment_received TEXT");
  addColumn(db, "deals", "next_action TEXT");
  // map legacy statuses onto the expanded stage enum
  db.exec(`
    UPDATE deals SET status = CASE status
      WHEN 'signed' THEN 'contracted'
      WHEN 'in_progress' THEN 'in_production'
      WHEN 'delivered' THEN 'submitted'
      WHEN 'dead' THEN 'lost'
      ELSE status END;
    UPDATE deals SET invoice_status = 'paid', payment_received = COALESCE(payment_received, updated_at)
      WHERE status = 'paid';
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT,                        -- emoji
      kind TEXT NOT NULL DEFAULT 'personal',  -- personal|business
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      outcome TEXT,
      area_id INTEGER,
      goal_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active', -- planned|active|waiting|on_hold|completed|archived
      deadline TEXT,
      next_action TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      kind TEXT NOT NULL DEFAULT 'note', -- note|meeting|resource|idea|decision|lesson|template
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- polymorphic links: note ↔ any entity
    CREATE TABLE IF NOT EXISTS note_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,        -- project|area|task|deal|content|goal
      entity_id INTEGER NOT NULL,
      UNIQUE(note_id, entity_type, entity_id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      horizon TEXT NOT NULL DEFAULT 'year', -- year|quarter
      target REAL,
      current REAL NOT NULL DEFAULT 0,
      unit TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- active|achieved|abandoned
      deadline TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- editorial pipeline (supersedes content_log for planning; log rows are imported)
    CREATE TABLE IF NOT EXISTS content_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      platform TEXT,                    -- youtube|instagram|tiktok|newsletter
      format TEXT NOT NULL DEFAULT 'short', -- short|long|carousel|newsletter
      pillar TEXT,                      -- roadmaps|certifications|job_search|roles|commentary|tools|career
      status TEXT NOT NULL DEFAULT 'idea', -- idea|research|script|ready|filming|editing|review|scheduled|published
      hook TEXT,
      target_date TEXT,
      published_date TEXT,
      deal_id INTEGER,
      cta TEXT,
      links TEXT,
      notes TEXT,
      metrics TEXT,                     -- free-form post-publish numbers
      source TEXT NOT NULL DEFAULT 'manual', -- manual|youtube
      external_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL UNIQUE,  -- Monday YYYY-MM-DD
      summary TEXT,                     -- generated stats JSON
      reflections TEXT,
      priorities TEXT,                  -- JSON array of next week's priorities
      completed_at TEXT
    );
  `);

  // import legacy content_log rows into content_items as published entries
  db.exec(`
    INSERT OR IGNORE INTO content_items
      (title, platform, format, status, published_date, source, external_id, created_at)
    SELECT COALESCE(title, CASE type WHEN 'short' THEN 'Short' ELSE 'Video' END),
           platform,
           CASE type WHEN 'short' THEN 'short' ELSE 'long' END,
           'published', date, source, external_id, datetime('now')
    FROM content_log;
  `);

  db.pragma("user_version = 2");
}

/** v3: script/tags on content items (ideas library) + monthly AdSense figures. */
function migrateV3(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= 3) return;

  addColumn(db, "content_items", "script TEXT");
  addColumn(db, "content_items", "tags TEXT"); // comma-separated

  db.exec(`
    CREATE TABLE IF NOT EXISTS adsense (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,       -- YYYY-MM, from YouTube Studio
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.pragma("user_version = 3");
}

/**
 * v4: simplified content stages (idea → scripting → ready → done, + archived)
 * and retirement of the standalone task workspace — inbox tasks fold into the
 * Personal day list.
 */
function migrateV4(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= 4) return;

  db.exec(`
    UPDATE content_items SET status = CASE
      WHEN status IN ('idea','research') THEN 'idea'
      WHEN status = 'script' THEN 'scripting'
      WHEN status IN ('ready','filming','editing','review','scheduled') THEN 'ready'
      WHEN status = 'published' THEN 'done'
      ELSE status END;
    UPDATE todos SET status = 'next' WHERE status IN ('inbox','waiting','someday');
  `);

  db.pragma("user_version = 4");
}

/** v5: likes on social snapshots for the engagement metric tiles. */
function migrateV5(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= 5) return;
  addColumn(db, "social_stats", "likes INTEGER");
  db.pragma("user_version = 5");
}

/** v6: multi-day events + affiliate (Impact Radius) revenue months. */
function migrateV6(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= 6) return;
  addColumn(db, "local_events", "end_date TEXT"); // inclusive; NULL = single day
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,       -- YYYY-MM
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.pragma("user_version = 6");
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_date TEXT NOT NULL,      -- YYYY-MM-DD the item first appears
      completed_date TEXT,             -- YYYY-MM-DD it was checked off, NULL = open
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      price REAL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'lead',
      poc_name TEXT,
      poc_email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deal_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- events created directly in BT OS (feed events live in "events")
    CREATE TABLE IF NOT EXISTS local_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,              -- YYYY-MM-DD
      time TEXT,                       -- HH:MM, NULL = all-day
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- cached calendar events, re-fetched from the ICS feeds
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_name TEXT NOT NULL,
      uid TEXT NOT NULL,
      title TEXT NOT NULL,
      start TEXT NOT NULL,             -- ISO datetime
      end TEXT,
      all_day INTEGER NOT NULL DEFAULT 0
    );

    -- follower/stat snapshots per platform (manual or fetched)
    CREATE TABLE IF NOT EXISTS social_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,          -- youtube | instagram | tiktok
      followers INTEGER,
      views INTEGER,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- one row per piece of content that counts toward the weekly goal
    CREATE TABLE IF NOT EXISTS content_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,              -- YYYY-MM-DD published
      type TEXT NOT NULL,              -- short | long
      source TEXT NOT NULL,            -- youtube | manual
      platform TEXT,                   -- youtube | instagram | tiktok
      title TEXT,
      external_id TEXT UNIQUE          -- e.g. youtube video id, NULL for manual
    );
  `);
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  if (value === null || value === "") {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  } else {
    getDb()
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(key, value);
  }
}

/** Today's date in the server's local timezone, YYYY-MM-DD. */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
