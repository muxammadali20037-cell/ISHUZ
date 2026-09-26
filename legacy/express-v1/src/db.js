'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id       INTEGER UNIQUE,
  name        TEXT NOT NULL,
  username    TEXT,
  token       TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ish qidiruvchining rezyumesi
CREATE TABLE IF NOT EXISTS resumes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  birth_year       INTEGER,
  gender           TEXT,
  phone            TEXT NOT NULL,
  region           TEXT NOT NULL,
  district         TEXT,
  category         TEXT NOT NULL,
  specialization   TEXT NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0,
  education        TEXT NOT NULL DEFAULT 'none',
  languages        TEXT NOT NULL DEFAULT '[]',
  skills           TEXT NOT NULL DEFAULT '[]',
  employment_type  TEXT NOT NULL,
  official         TEXT NOT NULL DEFAULT 'any',
  salary_min       INTEGER,
  about            TEXT,
  portfolio_links  TEXT NOT NULL DEFAULT '[]',
  portfolio_images TEXT NOT NULL DEFAULT '[]',
  photo            TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resumes_cat ON resumes(category, region, is_active);

-- Ish beruvchining vakansiyasi
CREATE TABLE IF NOT EXISTS vacancies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company          TEXT NOT NULL,
  contact_name     TEXT NOT NULL,
  phone            TEXT NOT NULL,
  region           TEXT NOT NULL,
  district         TEXT,
  category         TEXT NOT NULL,
  position         TEXT NOT NULL,
  experience_min   INTEGER NOT NULL DEFAULT 0,
  education_min    TEXT NOT NULL DEFAULT 'none',
  gender           TEXT,
  age_min          INTEGER,
  age_max          INTEGER,
  languages        TEXT NOT NULL DEFAULT '[]',
  employment_type  TEXT NOT NULL,
  official         TEXT NOT NULL DEFAULT 'any',
  salary_from      INTEGER,
  salary_to        INTEGER,
  description      TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vacancies_cat ON vacancies(category, region, is_active);

-- Ishchi va ish beruvchini bog'lash so'rovlari
CREATE TABLE IF NOT EXISTS connections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id   INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
  vacancy_id  INTEGER REFERENCES vacancies(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('to_worker', 'to_employer')),
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conn_to ON connections(to_user, status);
CREATE INDEX IF NOT EXISTS idx_conn_from ON connections(from_user, status);
`;

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
