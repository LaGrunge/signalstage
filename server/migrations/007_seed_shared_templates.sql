-- One starter "shared" template per language, so a fresh install has a
-- working example in the common task bank instead of an empty state.
-- Fixed ids + ON CONFLICT DO NOTHING keep this idempotent across the
-- every-boot migration replay (see server/src/db.js's runMigrations) without
-- clobbering edits an interviewer may have made to their own copy.
INSERT INTO templates (id, title, language, code, created_by, is_shared) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Hello, World! (C++)',
  'cpp',
  E'#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-000000000002',
  'Hello, World! (Python)',
  'python',
  E'print("Hello, World!")\n',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-000000000003',
  'Hello, World! (Go)',
  'go',
  E'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-000000000004',
  'Hello, World! (Java)',
  'java',
  E'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-000000000005',
  'Hello, World! (Bash)',
  'bash',
  E'#!/usr/bin/env bash\necho "Hello, World!"\n',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-000000000006',
  'Hello, World! (MariaDB)',
  'mariadb',
  E'SELECT \'Hello, World!\' AS greeting;\n',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;
