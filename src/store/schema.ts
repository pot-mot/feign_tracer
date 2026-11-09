/** 架构变化时递增，存入 PRAGMA user_version。 */
export const SCHEMA_VERSION = 4;

/** 一次分析产生的元数据表；项目索引表独立持久化，不随每次分析清空。 */
const ANALYSIS_TABLES = `
CREATE TABLE analysis (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  root          TEXT NOT NULL,
  generated_at  TEXT NOT NULL,
  tool          TEXT NOT NULL,
  version       TEXT NOT NULL,
  options_json  TEXT NOT NULL,
  duration_ms   INTEGER NOT NULL
);

CREATE TABLE stats (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE warnings (
  id      INTEGER PRIMARY KEY,
  message TEXT NOT NULL
);

CREATE TABLE modules (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  build_tool  TEXT NOT NULL,
  dir         TEXT NOT NULL,
  build_file  TEXT,
  parent_id   TEXT,
  group_id    TEXT,
  artifact_id TEXT,
  version     TEXT,
  file_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE module_dependencies (
  id            INTEGER PRIMARY KEY,
  module_id     TEXT NOT NULL,
  to_module     TEXT,
  group_id      TEXT,
  artifact_id   TEXT,
  version       TEXT,
  scope         TEXT,
  configuration TEXT,
  optional      INTEGER NOT NULL DEFAULT 0,
  external      INTEGER NOT NULL DEFAULT 0,
  raw           TEXT
);
CREATE INDEX idx_module_dependencies_module ON module_dependencies(module_id);
CREATE INDEX idx_module_dependencies_target ON module_dependencies(to_module);

CREATE TABLE module_edges (
  from_module TEXT NOT NULL,
  to_module   TEXT NOT NULL,
  count       INTEGER NOT NULL,
  PRIMARY KEY (from_module, to_module)
);

CREATE TABLE module_children (
  parent_id TEXT NOT NULL,
  child_id  TEXT NOT NULL,
  position  INTEGER NOT NULL,
  PRIMARY KEY (parent_id, child_id)
);

CREATE TABLE endpoints (
  id            TEXT PRIMARY KEY,
  http_method   TEXT NOT NULL,
  paths_json    TEXT NOT NULL,
  handler       TEXT NOT NULL,
  handler_label TEXT NOT NULL,
  controller    TEXT NOT NULL,
  module_id     TEXT,
  file          TEXT,
  line          INTEGER,
  tree_built    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_endpoints_controller ON endpoints(controller);
CREATE INDEX idx_endpoints_module ON endpoints(module_id);

CREATE TABLE call_nodes (
  root_type        TEXT NOT NULL DEFAULT 'endpoint',
  endpoint_id      TEXT NOT NULL,
  seq              TEXT NOT NULL,
  path             TEXT NOT NULL,
  sort_key         TEXT NOT NULL,
  parent_seq       TEXT,
  node_order       INTEGER NOT NULL,
  depth            INTEGER NOT NULL,
  method_id        TEXT NOT NULL,
  label            TEXT NOT NULL,
  signature        TEXT,
  params_json      TEXT,
  visibility       TEXT,
  kind             TEXT NOT NULL,
  module_id        TEXT,
  file             TEXT,
  line             INTEGER,
  annotations_json TEXT,
  call_count       INTEGER NOT NULL DEFAULT 1,
  unresolved       INTEGER NOT NULL DEFAULT 0,
  cyclic           INTEGER NOT NULL DEFAULT 0,
  implementation_of TEXT,
  feign_service    TEXT,
  feign_http_method TEXT,
  feign_path       TEXT,
  remote_endpoint  TEXT,
  remote_service   TEXT,
  PRIMARY KEY (root_type, endpoint_id, seq)
);
CREATE INDEX idx_call_nodes_parent ON call_nodes(root_type, endpoint_id, parent_seq);
CREATE INDEX idx_call_nodes_sort ON call_nodes(root_type, endpoint_id, sort_key);
CREATE INDEX idx_call_nodes_method ON call_nodes(method_id);
CREATE INDEX idx_call_nodes_kind ON call_nodes(kind);

CREATE TABLE traces (
  id                TEXT PRIMARY KEY,
  class_name        TEXT NOT NULL,
  method_name       TEXT NOT NULL,
  label             TEXT NOT NULL,
  kind              TEXT NOT NULL,
  module_id         TEXT,
  file              TEXT,
  line              INTEGER,
  implementation_of TEXT,
  tree_built        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_traces_class ON traces(class_name);
CREATE INDEX idx_traces_module ON traces(module_id);

CREATE TABLE feign_clients (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  service_name TEXT,
  url          TEXT,
  module_id    TEXT,
  file         TEXT,
  line         INTEGER
);

CREATE TABLE feign_client_methods (
  client_id   TEXT NOT NULL,
  method_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  http_method TEXT NOT NULL,
  paths_json  TEXT NOT NULL,
  signature   TEXT NOT NULL,
  position    INTEGER NOT NULL,
  PRIMARY KEY (client_id, method_id)
);

CREATE TABLE feign_operations (
  method_id    TEXT NOT NULL,
  path         TEXT NOT NULL,
  client_name  TEXT NOT NULL,
  client_id    TEXT,
  service_name TEXT,
  url          TEXT,
  method_name  TEXT NOT NULL,
  http_method  TEXT NOT NULL,
  module_id    TEXT,
  file         TEXT,
  line         INTEGER,
  PRIMARY KEY (method_id, path)
);
CREATE INDEX idx_feign_operations_client ON feign_operations(client_id);

CREATE TABLE feign_operation_targets (
  method_id    TEXT NOT NULL,
  path         TEXT NOT NULL,
  endpoint_ref TEXT NOT NULL,
  PRIMARY KEY (method_id, path, endpoint_ref)
);

CREATE TABLE source_files (
  path           TEXT PRIMARY KEY,
  language       TEXT NOT NULL,
  module_id      TEXT,
  package_name   TEXT NOT NULL,
  imports_json   TEXT NOT NULL,
  types_json     TEXT NOT NULL,
  calls          INTEGER NOT NULL DEFAULT 0,
  parse_errors   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_source_files_module ON source_files(module_id);

CREATE TABLE file_dependencies (
  file_path TEXT NOT NULL,
  to_type   TEXT NOT NULL,
  count     INTEGER NOT NULL,
  kinds_json TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  PRIMARY KEY (file_path, to_type)
);
CREATE INDEX idx_file_dependencies_target ON file_dependencies(to_type);
`;

/**
 * 项目索引表。`base_dir` 是跨次扫描匹配项目的唯一键；
 * 文件、类、方法、调用按层级外键关联，删除上层记录会级联清理下游。
 *
 * `project_files.parsed_json` 是加载索引时的快速路径；下面的规范化表
 * 同时保留完整的对象关系和调用边，方便直接查询。两者在同一次事务中写入。
 */
export const PROJECT_TABLES = `
CREATE TABLE IF NOT EXISTS projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  base_dir   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_files (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path           TEXT NOT NULL,
  abs_path       TEXT NOT NULL,
  language       TEXT NOT NULL,
  module_id      TEXT,
  package_name   TEXT NOT NULL,
  imports_json   TEXT NOT NULL,
  parse_errors   INTEGER NOT NULL DEFAULT 0,
  line_count     INTEGER NOT NULL DEFAULT 0,
  mtime_ms       REAL NOT NULL DEFAULT 0,
  size           INTEGER NOT NULL DEFAULT 0,
  parsed_json    TEXT NOT NULL,
  UNIQUE(project_id, path)
);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);

CREATE TABLE IF NOT EXISTS project_classes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id         INTEGER NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  parent_class_id INTEGER REFERENCES project_classes(id) ON DELETE CASCADE,
  fqn             TEXT NOT NULL,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL,
  package_name    TEXT NOT NULL,
  module_id       TEXT,
  annotations_json TEXT NOT NULL,
  modifiers_json  TEXT NOT NULL,
  super_types_json TEXT NOT NULL,
  fields_json     TEXT NOT NULL,
  line            INTEGER NOT NULL,
  UNIQUE(file_id, fqn)
);
CREATE INDEX IF NOT EXISTS idx_project_classes_file ON project_classes(file_id);
CREATE INDEX IF NOT EXISTS idx_project_classes_fqn ON project_classes(fqn);
CREATE INDEX IF NOT EXISTS idx_project_classes_parent ON project_classes(parent_class_id);

CREATE TABLE IF NOT EXISTS project_methods (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id          INTEGER NOT NULL REFERENCES project_classes(id) ON DELETE CASCADE,
  method_key        TEXT NOT NULL,
  name              TEXT NOT NULL,
  owner_fqn         TEXT NOT NULL,
  owner_simple_name TEXT NOT NULL,
  owner_kind        TEXT NOT NULL,
  annotations_json  TEXT NOT NULL,
  modifiers_json    TEXT NOT NULL,
  return_type       TEXT NOT NULL,
  params_json       TEXT NOT NULL,
  line              INTEGER NOT NULL,
  end_line          INTEGER NOT NULL,
  body_start        INTEGER,
  body_end          INTEGER,
  is_constructor    INTEGER NOT NULL DEFAULT 0,
  is_abstract       INTEGER NOT NULL DEFAULT 0,
  locals_json       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_methods_class ON project_methods(class_id);
CREATE INDEX IF NOT EXISTS idx_project_methods_key ON project_methods(method_key);

CREATE TABLE IF NOT EXISTS project_calls (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_method_id INTEGER NOT NULL REFERENCES project_methods(id) ON DELETE CASCADE,
  callee_method_id INTEGER REFERENCES project_methods(id) ON DELETE SET NULL,
  callee_method_key TEXT,
  name             TEXT NOT NULL,
  qualifier        TEXT,
  qualifier_kind   TEXT NOT NULL,
  arg_count        INTEGER NOT NULL,
  args_json        TEXT NOT NULL,
  line             INTEGER NOT NULL,
  offset           INTEGER NOT NULL,
  is_constructor   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_project_calls_caller ON project_calls(caller_method_id);
CREATE INDEX IF NOT EXISTS idx_project_calls_callee ON project_calls(callee_method_id);
CREATE INDEX IF NOT EXISTS idx_project_calls_callee_key ON project_calls(callee_method_key);
`;

export const VIEWS = `
CREATE VIEW v_endpoint_overview AS
SELECT
  e.id,
  e.http_method,
  e.paths_json,
  e.controller,
  e.module_id,
  e.file,
  e.tree_built,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'endpoint' AND n.endpoint_id = e.id) AS node_count,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'endpoint' AND n.endpoint_id = e.id AND n.kind = 'feign') AS feign_calls,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'endpoint' AND n.endpoint_id = e.id AND n.depth = 0) AS root_nodes
FROM endpoints e;

CREATE VIEW v_trace_overview AS
SELECT
  t.id,
  t.class_name,
  t.method_name,
  t.label,
  t.kind,
  t.module_id,
  t.file,
  t.implementation_of,
  t.tree_built,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'trace' AND n.endpoint_id = t.id) AS node_count,
  (SELECT COUNT(*) FROM call_nodes n WHERE n.root_type = 'trace' AND n.endpoint_id = t.id AND n.kind = 'feign') AS feign_calls
FROM traces t;

CREATE VIEW v_module_overview AS
SELECT
  m.*,
  (SELECT COUNT(*) FROM module_dependencies d WHERE d.module_id = m.id) AS dependency_count,
  (SELECT COUNT(*) FROM module_dependencies d WHERE d.to_module = m.id) AS dependent_count
FROM modules m;

CREATE VIEW v_file_overview AS
SELECT
  f.path,
  f.language,
  f.module_id,
  f.package_name,
  f.calls,
  (SELECT COUNT(*) FROM file_dependencies d WHERE d.file_path = f.path) AS dependency_count
FROM source_files f;
`;

export const SCHEMA = `${ANALYSIS_TABLES}\n${PROJECT_TABLES}\n${VIEWS}`;

export const VIEW_NAMES = [
    "v_endpoint_overview",
    "v_trace_overview",
    "v_module_overview",
    "v_file_overview",
] as const;

export const TABLE_NAMES = [
    "analysis",
    "stats",
    "warnings",
    "modules",
    "module_dependencies",
    "module_edges",
    "module_children",
    "endpoints",
    "call_nodes",
    "traces",
    "feign_clients",
    "feign_client_methods",
    "feign_operations",
    "feign_operation_targets",
    "source_files",
    "file_dependencies",
    "projects",
    "project_files",
    "project_classes",
    "project_methods",
    "project_calls",
] as const;

/** 每次分析都会整体重写的元数据表；项目索引表不在其中。 */
export const METADATA_TABLES = [
    "analysis",
    "stats",
    "warnings",
    "modules",
    "module_dependencies",
    "module_edges",
    "module_children",
    "endpoints",
    "traces",
    "feign_clients",
    "feign_client_methods",
    "feign_operations",
    "feign_operation_targets",
    "source_files",
    "file_dependencies",
] as const;
