# SignalStage

Self-hosted онлайн-интервью: совместный редактор кода (Monaco + Yjs) и запуск
кода на C++, Python, Go, Java через self-hosted Judge0.

## Архитектура

```
browser
  │
  ▼
frontend (nginx, static React build)
  ├── /api/*     → api (Express, :4000)      — auth, rooms, /execute proxy
  └── /collab/*  → api (Hocuspocus, :1234)    — Yjs websocket sync
                       │
                       ▼
                 postgres (users, rooms)
                       │
        api ── signalstage_net ──► judge0-server (:2358) ──► judge0 workers
                                          │
                                    redis + postgres (Judge0's own, отдельные)
```

- Интервьюер логинится (email/пароль), создаёт сессию, получает ссылку
  `/room/<uuid>` — это и есть секрет доступа к комнате (как в CoderPad-подобных
  сервисах). Кандидат открывает ссылку без аккаунта, вводит имя и попадает в
  тот же документ.
- Совместное редактирование — Yjs CRDT документ на комнату, синхронизируется
  через Hocuspocus. Документ живёт в памяти процесса api, пока жив контейнер
  (для интервью такой сессионной модели достаточно; если нужна персистентность
  между рестартами — добавьте `@hocuspocus/extension-database`).
- Выполнение кода — отдельный self-hosted стек Judge0 (`judge0/`), вендоренный
  из официального репозитория. `api` дергает его REST API синхронно
  (`wait=true`) и возвращает stdout/stderr/compile_output.

## Быстрый старт

```bash
cp .env.example .env         # заполнить реальные секреты
vim .env

# 1. Поднять основной стек (создаёт сеть signalstage_net)
docker compose up -d --build

# 2. Поднять Judge0 (использует ту же сеть signalstage_net)
cd judge0
cp judge0.conf.example judge0.conf
vim judge0.conf              # ОБЯЗАТЕЛЬНО сменить пароли и AUTHN_TOKEN,
                              # AUTHN_TOKEN должен совпадать с JUDGE0_AUTH_TOKEN в ../.env
                              # (judge0.conf содержит реальные секреты - в git не попадает)
docker compose up -d
cd ..

# 3. Только на хостах с cgroup v2 (см. "cgroup v2 хосты" ниже) - один раз,
#    после того как Judge0 засеял таблицу languages при первом старте:
cat judge0/fixups.sql | docker compose -f judge0/docker-compose.yml exec -T db psql -U judge0 -d judge0
```

Открыть `http://<host>:${HTTP_PORT:-80}`, зарегистрировать интервьюера,
создать сессию, скопировать ссылку кандидату.

## cgroup v2 хосты (например, этот прод-инстанс)

`judge0/judge0:latest` пакетирует `isolate` 1.8.1, который умеет ограничивать
память/число процессов только через **cgroup v1**. На хосте с чистым cgroup v2
(`mount | grep cgroup2`, `docker info` → `Cgroup Version: 2`) путь
`/sys/fs/cgroup/memory/` не существует, и `isolate --cg` падает с
`Failed to create control group ... No such file or directory`. Менять
cgroup-режим ядра на общей машине (здесь заодно крутится MariaDB ColumnStore)
рискованно и требует ребута — вместо этого `judge0/judge0.conf` отключает
`--cg` целиком и переходит на rlimit-лимиты:

- `ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT=true` и
  `..._MEMORY_LIMIT=true` — заставляют `isolate_job.rb` не передавать `--cg`.
- `MEMORY_LIMIT` поднят до 1.5GB — без cgroup это лимит виртуального адресного
  пространства (RLIMIT_AS) **на процесс**, а не RSS, и JVM/Go резервируют
  сотни МБ виртуальной памяти под рантайм ещё до `Hello, world`.
- `MAX_PROCESSES_AND_OR_THREADS` поднят до 200 — GC/JIT-потоки JVM и
  GOMAXPROCS-воркеры `go build` считаются от видимого числа ядер.
- `worker` в `judge0/docker-compose.yml` закреплён через `cpuset` на подмножество
  ядер (значение зависит от размера инстанса — см. комментарий в файле) —
  иначе JVM по умолчанию поднимает GC/JIT-потоки пропорционально всем видимым
  ядрам хоста.
- `judge0/fixups.sql` переопределяет `run_cmd` для Java (id 62) явными
  флагами JVM (`-Xmx256m`, `-XX:MaxMetaspaceSize=128m`, `-XX:+UseSerialGC`,
  `-XX:TieredStopAtLevel=1`, …) — без них JVM резервирует ~1GB под metaspace
  и поднимает GC/JIT-потоки, которые уже сами по себе выбивают
  RLIMIT_AS/RLIMIT_NPROC при отключённых cgroups. Нужно применить один раз
  после первого старта Judge0 (см. шаг 3 быстрого старта выше) — таблица
  `languages` сидится только при первом boot, конфиг-файлом это не задать.

Если разворачиваете на хосте с cgroup v1/hybrid (`cat /sys/fs/cgroup/cgroup.controllers`
не существует) — весь этот раздел не нужен, используйте `judge0.conf` из
апстрима как есть (уберите/верните ENABLE_PER_PROCESS_AND_THREAD_* в default).

## Локальная разработка без Docker

```bash
# судья кода всё равно нужен как отдельный стек, поднимите его один раз
cd judge0 && docker compose up -d && cd ..

# postgres для основного приложения — свой, минимальный
docker run -d --name signalstage-pg -p 5432:5432 \
  -e POSTGRES_DB=signalstage -e POSTGRES_USER=signalstage \
  -e POSTGRES_PASSWORD=devpassword postgres:16.2

cd server
cp .env.example .env  # или экспортируйте переменные вручную
npm install
npm start

cd ../frontend
npm install
npm run dev            # http://localhost:5173, проксирует /api и /collab на :4000/:1234
```

## Переменные окружения (`.env` в корне)

| Переменная | Назначение |
|---|---|
| `POSTGRES_PASSWORD` | пароль для БД приложения (users/rooms) |
| `JWT_SECRET` | секрет для подписи JWT интервьюеров |
| `JUDGE0_AUTH_TOKEN` | токен для доступа к Judge0 API; должен совпадать с `AUTHN_TOKEN` в `judge0/judge0.conf` |
| `HTTP_PORT` | порт, на котором nginx публикует фронтенд на хосте |

## Добавление / изменение языков

Список языков и их Judge0 language_id — в `server/src/judge0.js` (`LANGUAGES`).
ID могут отличаться в зависимости от версии образа Judge0 — проверьте
`GET http://<judge0-host>:2358/languages` на вашем инстансе и поправьте id при
необходимости.

## Безопасность и продакшн-чеклист

- **`privileged: true` у Judge0** нужен для песочницы `isolate` — держите
  Judge0 в отдельной изолированной сети/хосте, не открывайте `2358` наружу
  (в `judge0/docker-compose.yml` порт `2358:2358` пробрасывается на хост
  только для отладки — уберите проброс или закройте фаерволом в проде).
  По умолчанию `ENABLE_NETWORK=false` — запускаемый код кандидата не имеет
  сетевого доступа, не меняйте это без необходимости.
- Смените **все** пароли/токены в `.env` и `judge0/judge0.conf` — плейсхолдеры
  `change-me-*` не предназначены для реального использования.
- Поставьте TLS перед nginx (например, Caddy/Traefik/certbot) — сейчас стек
  рассчитан на HTTP за вашим внешним reverse-proxy или для локальной сети.
- Ссылка на комнату (`/room/<uuid>`) — единственный секрет доступа кандидата;
  не публикуйте её вне переписки с конкретным кандидатом.
- Yjs-документ сейчас хранится только в памяти `api` — рестарт контейнера
  между интервью обнулит несохранённый код. Для критичных случаев добавьте
  persistence-расширение Hocuspocus или экспорт содержимого после сессии.

## Тестирование вручную

1. Зарегистрировать интервьюера, создать сессию.
2. Открыть ссылку сессии в двух вкладках (или второй браузер) под разными
   именами — убедиться, что правки и курсоры синхронизируются в реальном
   времени.
3. Выбрать язык, написать `Hello, world!`, нажать «Запустить» — проверить
   stdout для C++/Python/Go/Java.
4. Проверить ошибку компиляции (например, синтаксическая ошибка в C++) —
   должен показаться `compile_output`.
