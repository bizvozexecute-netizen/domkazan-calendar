# Ограниченный тестовый стенд на общем сервере

Этот план относится только к **отдельному** Docker-проекту `domkazan-vpn-test`. Существующий `compose.yaml`, соседние контейнеры, SSH, firewall и службы хоста не меняются. Все действия на сервере выполняет владелец **после отдельного согласования**. Код из этого PR сам к серверу не подключается.

Стенд открывается только через SSH-туннель на `https://localhost:9443`. Это самоподписанный сертификат для localhost. Он не создаёт публичный HTTPS API для Tilda. Рабочая Tilda и production не затрагиваются.

## Что подготовлено

- `compose.vpn-test.yaml`: отдельные сеть БД, web-сеть, том PostgreSQL, одноразовые миграции и TLS, приложение, прокси, опциональный Telegram worker, seed и backup. Нет `build:`; приложение, tools и TLS берутся из GHCR по digest. PostgreSQL и Nginx — готовые официальные образы.
- `.github/workflows/vpn-test-images.yml`: проверяет Compose в PR. Публикация трёх образов возможна только при ручном запуске workflow на `main` после слияния зависимых PR. В summary каждого job указан неизменяемый `image@sha256:...`.
- `ops/vpn-test/setup.mjs`: создаёт случайные тестовые секреты и пароль администратора. Файлы `.env.vpn-test` и `.vpn-test-credentials.json` имеют режим 0600 и не входят в Git.
- `ops/vpn-test/watchdog.sh`: каждые 10 секунд читает память хоста и минутную нагрузку. При менее 250 MiB доступной памяти останавливает только тестовый Compose-проект сразу; при менее 350 MiB или load ≥ 1.25 три раза подряд — тоже останавливает тестовый проект. Том БД сохраняется. Скрипт надо запустить перед контейнерами и оставить работающим в отдельном сеансе; он не меняет системные службы.
- `ops/vpn-test/check.sh`: проверяет health, вход в админку, каталог и закрытый внутренний endpoint.

Лимиты одновременно работающих сервисов без worker: 224 MiB PostgreSQL + 384 MiB Next.js + 48 MiB Nginx = 656 MiB (плюс накладные расходы Docker/ядра). Worker добавляет до 80 MiB. Миграции/seed запускаются **до** Next.js и ограничены 384 MiB. При OOM ограниченного контейнера следует остановить стенд и пересмотреть лимиты, а не отнимать резерв у VPN.

## 1. Действия до доступа к серверу

1. Слить зависимые draft PR #1 и #2, затем этот PR. Проверить CI. На `main` вручную запустить workflow **VPN test images** и дождаться успешного завершения всех трёх сборок. Записать из summary digest для `app`, `tools` и `tls` из **одного запуска**. На VPN-ноде ничего не собирать.
2. На доверенном локальном компьютере получить проверенный commit репозитория. В его корне создать секреты, подставив три реальных digest:

   ```sh
   node ops/vpn-test/setup.mjs \
     --app-image 'ghcr.io/bizvozexecute-netizen/domkazan-calendar-app@sha256:<64-hex>' \
     --tools-image 'ghcr.io/bizvozexecute-netizen/domkazan-calendar-tools@sha256:<64-hex>' \
     --tls-image 'ghcr.io/bizvozexecute-netizen/domkazan-calendar-tls@sha256:<64-hex>'
   node ops/vpn-test/verify-compose.mjs
   ```

   `setup.mjs` откажется перезаписать уже созданные файлы. Пароль из `.vpn-test-credentials.json` передать только тестировщику по защищённому каналу. Не отправлять секреты в PR, чат, логи или тикеты.
3. Подготовить архив **только** с файлами развёртывания и проверить его список:

   ```sh
   tar -czf vpn-test-release.tar.gz compose.vpn-test.yaml ops/vpn-test ops/backup.sh
   tar -tzf vpn-test-release.tar.gz
   ```

## 2. Предварительная проверка владельцем VPN-ноды

Владелец проверяет под своим административным SSH-доступом: состояние соседних контейнеров, `free -m`, `df -h`, `docker ps`, `docker compose version`, `ss -ltn`. Порт 9443 должен быть свободен. Доступная память должна быть не менее примерно 1,2 ГБ; если меньше — запуск отложить. Проверить, что проект `domkazan-vpn-test` и том `domkazan-vpn-test-postgres` ещё не существуют; при совпадении имён сначала разобраться, кому они принадлежат. Состояние соседних контейнеров записать для сравнения после запуска. Не выполнять `docker system prune`, `docker compose down -v` или массовые операции над чужими контейнерами.

Для передачи файлов владелец создаёт отдельного пользователя, например `dkcal-test`, с входом только по SSH-ключу и каталогом `~/incoming`:

```sh
sudo adduser --disabled-password --gecos '' dkcal-test
sudo install -d -m 700 -o dkcal-test -g dkcal-test /home/dkcal-test/.ssh /home/dkcal-test/incoming
```

Владелец записывает предоставленный публичный ключ в `/home/dkcal-test/.ssh/authorized_keys` с правами 0600 и владельцем `dkcal-test`; секретный ключ на сервер не передаёт. **Не** добавлять пользователя в группы `docker` или `sudo` и не давать доступ к Docker socket. Публичный SSH-ключ и fingerprint ключа сервера сверить вне текущего сеанса. Можно ограничить ключ параметрами `restrict,port-forwarding,permitopen="127.0.0.1:9443"`. Пользователь загружает только архив и `.env.vpn-test`; запуск Docker выполняет владелец из проверенной root-owned копии.

Пример передачи с локальной машины; `<VPN_HOST>` владелец подставляет только в локальной команде:

```sh
scp vpn-test-release.tar.gz .env.vpn-test dkcal-test@<VPN_HOST>:incoming/
```

Владелец сверяет архив и помещает файлы в новый `/opt/domkazan-vpn-test` с владельцем root; `.env.vpn-test` — режим 0600, каталог `backups` — 0700. Список архива проверить перед распаковкой, чтобы исключить неожиданные пути. В каталоге должны оказаться `compose.vpn-test.yaml`, `ops/vpn-test/nginx.conf.template`, `ops/vpn-test/watchdog.sh`, `ops/vpn-test/check.sh` и `ops/backup.sh`. Переключать этот каталог на записи пользователя `dkcal-test` нельзя.

Если GHCR-пакеты приватные, владелец на сервере выполняет `docker login ghcr.io` токеном только с правом `read:packages` через stdin. Токен не сохранять в файлах стенда. Доступность образов по digest проверить до запуска.

## 3. Первый запуск владельцем

Под привилегированной учётной записью в `/opt/domkazan-vpn-test`:

```bash
cd /opt/domkazan-vpn-test
dc=(docker compose --project-name domkazan-vpn-test --env-file .env.vpn-test -f compose.vpn-test.yaml)
"${dc[@]}" config --quiet
"${dc[@]}" pull
nohup bash ops/vpn-test/watchdog.sh > watchdog.log 2>&1 &
echo $! > watchdog.pid
"${dc[@]}" up -d migrate
migration_id=$("${dc[@]}" ps -q -a migrate)
test -n "$migration_id"
test "$(docker wait "$migration_id")" = 0
"${dc[@]}" run --rm --no-deps seed
"${dc[@]}" up -d --wait --wait-timeout 180 app proxy
bash ops/vpn-test/check.sh
"${dc[@]}" ps
"${dc[@]}" stats --no-stream
```

В `.env.vpn-test` используются только случайные секреты, `tester@example.invalid`, девять вымышленных домов, вымышленная политика `/test-policy`. В Compose Telegram token/chat ID принудительно пусты, даже если переменные появятся на хосте. Worker можно отдельно включить **после** оценки памяти: `"${dc[@]}" --profile worker up -d telegram-worker`. Без токена он не делает отправок в Telegram; заявки в тестовом окружении должны содержать только вымышленные контакты.

После запуска сравнить `docker ps` и состояние соседних контейнеров с исходным снимком. Если память падает или соседние сервисы работают хуже, немедленно выполнить `"${dc[@]}" --profile worker stop --timeout 20`; эта команда касается только тестового проекта и сохраняет том. При необходимости отключить worker первым: `"${dc[@]}" --profile worker stop telegram-worker`. Не увеличивать лимиты на этом сервере без повторной оценки.

## 4. Проверка из локального браузера

Пользователь `dkcal-test` создаёт туннель со своего компьютера:

```sh
ssh -N -L 9443:127.0.0.1:9443 dkcal-test@<VPN_HOST>
```

Затем открывает `https://localhost:9443/admin/login` и `https://localhost:9443/test-catalog`. Проверить fingerprint самоподписанного сертификата из доверенного канала перед его принятием. Туннель не требует открытия нового внешнего порта. Проверять только вымышленные данные и контакты.

Стенд **не является** HTTPS API для страницы Tilda: адрес localhost доступен только владельцу туннеля, а сертификат самоподписанный. Для живой интеграции Tilda позже потребуются отдельный публично доступный тестовый HTTPS-адрес, реальная политика и подтверждённые UID ↔ дома. Здесь их не имитируют как подтверждённые.

## 5. Backup и остановка

Перед резервным копированием на малой ноде остановить app, proxy и worker, оставив PostgreSQL:

```bash
"${dc[@]}" --profile worker stop proxy telegram-worker app
"${dc[@]}" run --rm --no-deps backup
ls -lh backups/*.dump backups/*.sha256
(cd backups && sha256sum -c *.dump.sha256)
"${dc[@]}" --profile worker stop --timeout 20
```

Скопировать архив в защищённое место **вне** VPN-ноды и проверить checksum там. Не удалять том PostgreSQL. Для повторного запуска владелец снова проверяет ресурсы, watchdog, затем выполняет `"${dc[@]}" up -d --wait app proxy` и `check.sh`. Если watchdog остановил проект, сначала выяснить причину; автоперезапуск вручную до этого не делать.

## Что нужно от владельца сервера

Подтвердить окно первого запуска с допустимым кратковременным тестом нагрузки, предоставить SSH-публичный ключ для отдельного `dkcal-test` и fingerprint SSH-хоста, проверить свободный 9443 и текущий запас RAM/диска, указать кто будет административно копировать файлы в root-owned каталог, запускать Docker и следить за watchdog. Если GHCR-пакеты закрытые — организовать чтение пакетов с минимальным правом. Ключи, пароли и токены в PR не присылать.
