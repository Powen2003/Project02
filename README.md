# E-commerce MVP REST API

## Giải thích kiến trúc và mã nguồn

Đây là kiến trúc **Monolithic**: một ứng dụng Node.js/Express duy nhất chứa route,
middleware, nghiệp vụ và kết nối Prisma trong cùng một project; Docker Compose chỉ
tách các process API và PostgreSQL. Cách này phù hợp MVP vì đơn giản để triển khai
và debug, nhưng vẫn có thể tách service sau này khi hệ thống lớn hơn.

- `src/server.js`: khởi động HTTP server và graceful shutdown.
- `src/app.js`: route REST, nghiệp vụ đặt hàng và xử lý lỗi.
- `src/middleware.js`: JWT authentication, phân quyền và validate Zod.
- `src/config.js`: đọc và kiểm tra biến môi trường.
- `prisma/schema.prisma`: mô hình ORM ánh xạ quan hệ database thành model JavaScript.
  Migration tạo bảng, foreign key, index và composite primary key `OrderDetail(oid, pid)`.
- `.env`: chứa cấu hình/mật khẩu theo máy, không commit lên GitHub.
- `.gitignore`: loại `node_modules`, `.env`, build output và log khỏi Git; `.env.example`
  chỉ chứa tên biến và giá trị mẫu để thành viên khác biết cần cấu hình gì.

## Giải thích chi tiết theo từng câu trong phiếu chấm

### Câu 1 — Giải thích cấu trúc project đạt chuẩn Monolithic

Project là **Monolithic** vì toàn bộ backend được đóng gói trong một ứng dụng
Node.js/Express:

```text
src/server.js       → khởi động server
src/app.js          → route và nghiệp vụ
src/middleware.js   → JWT, phân quyền, validate dữ liệu
src/config.js       → đọc và kiểm tra .env
src/db.js           → khởi tạo Prisma Client
prisma/             → schema, migration, seed database
```

Khi chạy Docker Compose, backend chạy trong container `api`; PostgreSQL chạy
trong container `db`. Đây vẫn là Monolithic ở tầng ứng dụng vì không tách
authentication, product và order thành các microservice độc lập.

Khi thầy hỏi, có thể trả lời:

> “Đây là kiến trúc Monolithic vì các module authentication, product, order và
> shipment cùng nằm trong một project Express và được deploy thành một API
> container. PostgreSQL là container database riêng để lưu trữ dữ liệu.”

### Câu 2 — Giải thích `.gitignore` và `.env` khi đưa lên GitHub

File [.gitignore](./.gitignore) không cho commit:

```text
node_modules/       # dependency, có thể cài lại bằng npm install
.env                # chứa password/database URL/JWT secret
coverage/, dist/    # file sinh ra khi build/test
*.log               # log local
```

File [.env.example](./.env.example) **được phép commit** vì chỉ chứa tên biến
và giá trị mẫu, không chứa secret thật:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
```

Khi chạy local:

```bash
cp .env.example .env
```

Sau đó thay `JWT_SECRET` bằng chuỗi bí mật dài ít nhất 32 ký tự. Code trong
[src/config.js](./src/config.js) dùng Zod để kiểm tra biến môi trường; thiếu
`DATABASE_URL` hoặc `JWT_SECRET` không hợp lệ thì ứng dụng dừng ngay, tránh
chạy với cấu hình sai.

### Câu 3 — Giải thích Prisma ORM

Prisma là ORM, giúp code JavaScript truy cập PostgreSQL thông qua model thay vì
viết SQL cho mọi thao tác. File [prisma/schema.prisma](./prisma/schema.prisma)
mô tả:

- `Role` — quyền `admin` hoặc `normal`.
- `User` — tài khoản và khóa ngoại tới `Role`, `Membership`.
- `Membership` — hạng thành viên và score.
- `Product` — tên, giá, số lượng tồn kho.
- `Order` — đơn hàng thuộc về một user.
- `OrderDetail` — bảng trung gian giữa order và product.
- `Shipment` — trạng thái giao hàng của order.

Quan hệ quan trọng:

```text
User 1 ── N Order
Order 1 ── N OrderDetail
Product 1 ── N OrderDetail
Order 1 ── N Shipment
```

Các lệnh Prisma:

```bash
npx prisma generate                  # sinh Prisma Client
npx prisma migrate dev --name init  # tạo migration khi phát triển
npm run prisma:deploy               # áp dụng migration trên Docker
npm run prisma:seed                 # tạo dữ liệu mẫu
```

Migration trong [prisma/migrations](./prisma/migrations) tạo bảng, foreign key,
index và khóa chính kép `(oid, pid)` cho `OrderDetail`.

### Câu 4 — Docker Compose, health check và liệt kê container

File [docker-compose.yml](./docker-compose.yml) định nghĩa hai service:

- `db`: PostgreSQL 17, có volume `postgres_data` để giữ dữ liệu.
- `api`: build từ [Dockerfile](./Dockerfile), chạy migration rồi khởi động Express.

`db` chỉ được xem là sẵn sàng khi lệnh `pg_isready` thành công. `api` có
healthcheck gọi endpoint `/health`; endpoint này thực hiện `SELECT 1` tới
PostgreSQL.

Chạy và kiểm tra:

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3000/health
```

Kết quả cần trình bày:

```text
lthdv2-api-1  Up (healthy)  0.0.0.0:3000->3000/tcp
lthdv2-db-1   Up (healthy)
```

```json
{"status":"ok","database":"ok"}
```

Xem log API:

```bash
docker compose logs api
```

### Mở PostgreSQL bằng pgAdmin

Compose có thêm service pgAdmin tại:

```text
http://localhost:8083
```

Đăng nhập pgAdmin:

```text
Email: admin@example.com
Password: Admin123!
```

Sau khi đăng nhập, chọn **Add New Server** và nhập:

```text
General → Name: ecommerce-postgres
Connection → Host name/address: db
Connection → Port: 5432
Connection → Maintenance database: ecommerce
Connection → Username: postgres
Connection → Password: postgres
```

Lưu ý: vì pgAdmin chạy cùng Docker network, `Host name/address` phải là `db`,
không phải `localhost`. Nếu pgAdmin chạy trực tiếp ngoài Docker thì dùng
`localhost`, nhưng khi đó cần expose PostgreSQL bằng cách thêm
`"5432:5432"` vào service `db`.

### Câu 5 — Truy cập PostgreSQL, kiểm tra bảng và tạo sản phẩm X/Y

Vào PostgreSQL container bằng CLI:

```bash
docker compose exec db psql -U postgres -d ecommerce
```

Trong `psql`, liệt kê bảng:

```sql
\dt
```

Kết quả phải có các bảng:

```text
roles, memberships, users, products,
orders, order_details, shipments
```

Seed dữ liệu mẫu:

```bash
docker compose exec api node prisma/seed.js
```

Seed tạo sản phẩm X và Y. Kiểm tra:

```bash
docker compose exec db psql -U postgres -d ecommerce \
  -c 'SELECT pid, pname, price, quantity FROM products ORDER BY pid;'
```

Hoặc tạo thủ công bằng CLI:

```sql
INSERT INTO products (pname, price, quantity)
VALUES ('X', 100.00, 20), ('Y', 200.00, 20);
```

Nếu đã chạy seed trước đó thì không insert thủ công lần nữa để tránh dữ liệu
bị trùng về mặt trình diễn.

### Câu 6 — Postman: đăng ký tài khoản và kiểm tra role/score

Request:

```text
POST http://localhost:3000/api/auth/register
Content-Type: application/json
```

Body:

```json
{
  "username": "student",
  "fullname": "Student User",
  "password": "Student123!"
}
```

Response cần giải thích:

```json
{
  "role": "normal",
  "membership": "Normal",
  "score": 10
}
```

Backend tự động lấy role `normal` và membership `Normal`, người dùng không
được tự gửi `roleid` hay `mid`. Sau đó đăng nhập:

```text
POST http://localhost:3000/api/auth/login
```

```json
{
  "username": "student",
  "password": "Student123!"
}
```

Copy trường `token` trong response. Những request cần đăng nhập phải thêm header:

```text
Authorization: Bearer <JWT_TOKEN>
```

### Câu 7 — Postman: đặt hàng và kiểm tra lỗi

Đặt X mua 2 và Y mua 5:

```text
POST http://localhost:3000/api/orders
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

```json
{
  "items": [
    { "pid": 1, "qty": 2 },
    { "pid": 2, "qty": 5 }
  ]
}
```

Backend sẽ:

1. Kiểm tra JWT.
2. Kiểm tra sản phẩm có tồn tại.
3. Kiểm tra tồn kho đủ.
4. Tạo `Order`.
5. Tạo các dòng `OrderDetail` và lưu `unit_price` tại thời điểm mua.
6. Tạo `Shipment` trạng thái `pending`.
7. Trừ tồn kho trong cùng một transaction.

Để chứng minh lỗi “không dùng token”:

```bash
curl -i -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"pid":1,"qty":2}]}'
```

Kết quả: HTTP `401 Authentication required`.

Để chứng minh lỗi vượt tồn kho:

```json
{
  "items": [
    { "pid": 1, "qty": 999999 }
  ]
}
```

Kết quả: HTTP `400 Insufficient stock`; không tạo order mới.

### Câu 8 — CLI PostgreSQL: kiểm tra dữ liệu sau đặt hàng

Kiểm tra Order:

```bash
docker compose exec db psql -U postgres -d ecommerce \
  -c 'SELECT * FROM orders;'
```

Kiểm tra OrderDetail:

```bash
docker compose exec db psql -U postgres -d ecommerce \
  -c 'SELECT * FROM order_details;'
```

Kiểm tra Product đã trừ số lượng:

```bash
docker compose exec db psql -U postgres -d ecommerce \
  -c 'SELECT pid, pname, quantity FROM products ORDER BY pid;'
```

Kiểm tra Shipment:

```bash
docker compose exec db psql -U postgres -d ecommerce \
  -c 'SELECT * FROM shipments;'
```

Với đơn X mua 2 và Y mua 5, nếu ban đầu mỗi sản phẩm có 20 thì kết quả mong
đợi là X còn 18, Y còn 15; `order_details` có hai dòng với `qty` tương ứng
2 và 5; `shipments.status` là `pending`.

Để cập nhật shipment bằng tài khoản admin:

```text
PATCH http://localhost:3000/api/shipments/1
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

```json
{"status":"shipped"}
```

## Postman collection

Import [postman/ecommerce-mvp.postman_collection.json](./postman/ecommerce-mvp.postman_collection.json)
vào Postman. Chạy theo thứ tự: Health check → Register → Login → List products
→ Create order → View order/details → View shipment. Collection tự lưu JWT sau
request Login vào biến `token`.

## Chạy local

```bash
cp .env.example .env
# Đặt JWT_SECRET dài ít nhất 32 ký tự trong .env
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Health check: `GET http://localhost:3000/health`.
The seed creates roles `admin`, `normal`, membership `Normal` with score `10`, and products `X`, `Y`.

## Chạy bằng Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Compose khởi động PostgreSQL trước, chạy migration rồi mới chạy API.

## API chính

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/products`, `GET /api/products/:id`
- Admin: `POST/PATCH/DELETE /api/products`
- User: `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `GET /api/shipments/:id`
- Admin: `PATCH /api/shipments/:id`

Các endpoint cần đăng nhập nhận header `Authorization: Bearer <JWT>`. Tài khoản seed:
`admin / Admin123!` (chỉ dùng development).

## Kịch bản trình diễn theo phiếu chấm

```bash
# 1. Xem container và health
docker compose ps
curl http://localhost:3000/health

# 2. Kiểm tra bảng và dữ liệu PostgreSQL
docker compose exec db psql -U postgres -d ecommerce -c '\dt'
docker compose exec db psql -U postgres -d ecommerce -c 'SELECT * FROM products;'

# 3. Đăng ký tài khoản normal, score 10
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"student","fullname":"Student User","password":"Student123!"}'

# 4. Đăng nhập và copy token trong response
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"student","password":"Student123!"}'

# 5. Đặt X mua 2, Y mua 5 (thay TOKEN bằng JWT)
curl -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer TOKEN' \
  -d '{"items":[{"pid":1,"qty":2},{"pid":2,"qty":5}]}'

# 6. Xem Order, OrderDetail và Shipment
curl -H 'Authorization: Bearer TOKEN' http://localhost:3000/api/orders/1
curl -H 'Authorization: Bearer TOKEN' http://localhost:3000/api/shipments/1

# 6b. Admin chuyển Shipment sang shipped (dùng ADMIN_TOKEN)
curl -X PATCH http://localhost:3000/api/shipments/1 \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer ADMIN_TOKEN' \
  -d '{"status":"shipped"}'

# 7. Xác nhận dữ liệu đã cập nhật
docker compose exec db psql -U postgres -d ecommerce -c \
  'SELECT * FROM orders; SELECT * FROM order_details; SELECT * FROM products; SELECT * FROM shipments;'
```

Khi gửi request không có sản phẩm hoặc số lượng vượt tồn kho, API trả lỗi `400` và không tạo đơn hàng.
