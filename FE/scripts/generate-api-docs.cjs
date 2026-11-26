const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const vm = require("node:vm");
const ts = require("typescript");
const { z } = require("zod");
const { metadata } = require("./api-docs-metadata.cjs");

const ROOT = path.resolve(__dirname, "..");
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const slash = (value) => value.replaceAll("\\", "/");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const parse = (relative) => ts.createSourceFile(relative, read(relative), ts.ScriptTarget.Latest, true);
const walk = (node, visit) => { visit(node); ts.forEachChild(node, (child) => walk(child, visit)); };

function filesIn(directory) {
  return fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? filesIn(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]).sort();
}

function routePath(relative) {
  return `/${relative.replace(/^app\//, "").replace(/\/route\.ts$/, "").split("/")
    .filter((segment) => !segment.startsWith("("))
    .map((segment) => /^\[([^.[\]]+)\]$/.test(segment) ? `{${segment.slice(1, -1)}}` : segment).join("/")}`;
}

function discoverRoutes(root = ROOT) {
  const apiDirectory = path.join(root, "app/api");
  const recursive = (directory) => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? recursive(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  const routes = [];
  for (const filename of recursive(apiDirectory).filter((file) => file.endsWith(`${path.sep}route.ts`)).sort()) {
    const relative = slash(path.relative(root, filename));
    const source = ts.createSourceFile(relative, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      const declarations = ts.isFunctionDeclaration(statement) ? [statement]
        : ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [];
      for (const declaration of declarations) {
        const method = declaration.name?.getText(source);
        if (!METHODS.has(method)) continue;
        const body = declaration.body ?? declaration.initializer;
        if (!body) throw new Error(`Missing handler implementation: ${relative} ${method}`);
        const queries = new Set();
        const explicitErrors = new Set();
        let consumesJson = false;
        walk(body, (node) => {
          if (ts.isCallExpression(node)) {
            const expression = node.expression.getText(source);
            if (expression === "readJson" || /\.json$/.test(expression) && !/^(NextResponse|Response)\.json$/.test(expression)) consumesJson = true;
            if (ts.isPropertyAccessExpression(node.expression) && ["get", "getAll", "has"].includes(node.expression.name.text)
              && /(?:^|\.)searchParams$/.test(node.expression.expression.getText(source))
              && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) queries.add(node.arguments[0].text);
          }
          if (ts.isPropertyAssignment(node) && node.name.getText(source) === "status" && ts.isNumericLiteral(node.initializer)) {
            const status = Number(node.initializer.text);
            if (status >= 400) explicitErrors.add(status);
          }
        });
        routes.push({ key: `${method} ${routePath(relative)}`, method, path: routePath(relative), source: relative, queries: [...queries].sort(), explicitErrors: [...explicitErrors], consumesJson });
      }
    }
    // New export styles must be reviewed rather than silently omitted from coverage.
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.some((element) => METHODS.has(element.name.text))) {
        throw new Error(`Re-exported HTTP handler requires discovery support: ${relative}`);
      }
    }
  }
  return routes.sort((a, b) => a.key.localeCompare(b.key, "en"));
}

function validateCoverage(routes, descriptions = metadata) {
  const actualKeys = new Set(routes.map((route) => route.key));
  const problems = [];
  for (const route of routes) {
    const details = descriptions[route.key];
    if (!details) { problems.push(`Missing metadata: ${route.key}`); continue; }
    const documentedQueries = (details.queries ?? []).map((parameter) => parameter.name).sort();
    if (JSON.stringify(route.queries) !== JSON.stringify(documentedQueries)) problems.push(`Query metadata differs: ${route.key}; code=${route.queries}; docs=${documentedQueries}`);
    if (route.consumesJson && !details.request) problems.push(`Missing request schema: ${route.key}`);
    if (!details.response) problems.push(`Missing response metadata: ${route.key}`);
  }
  for (const key of Object.keys(descriptions)) if (!actualKeys.has(key)) problems.push(`Stale metadata: ${key}`);
  if (problems.length) throw new Error(problems.join("\n"));
}

// Only pure validators and their pure dependencies may execute during generation.
// Route handlers, Prisma, environment files and service modules are never imported.
function validatorLoader() {
  const cache = new Map();
  return function load(relative) {
    relative = slash(relative);
    if (!/^lib\/validations\/[\w-]+\.ts$/.test(relative)
      && !["lib/trip-id.ts", "lib/trip-search.ts", "lib/business-error.ts", "lib/trip-status.ts"].includes(relative)) throw new Error(`Validator import not allowed: ${relative}`);
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative);
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(relative, mod);
    mod.require = (id) => {
      if (id === "zod") return require("zod");
      if (id.startsWith("@/") || id.startsWith(".")) {
        const resolved = id.startsWith("@/") ? id.slice(2) : slash(path.relative(ROOT, path.resolve(path.dirname(filename), id)));
        return load(`${resolved}.ts`);
      }
      throw new Error(`Validator dependency not allowed: ${id}`);
    };
    mod._compile(ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
    return mod.exports;
  };
}

function inlineSchema(relative, bindings) {
  const source = parse(relative);
  let initializer;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) === "schema") initializer = declaration.initializer;
    }
  }
  if (!initializer) throw new Error(`Missing inline Zod schema: ${relative}`);
  return vm.runInNewContext(`(${initializer.getText(source)})`, { z, ...bindings }, { timeout: 1000 });
}

function enumValues(relative, name) {
  const source = parse(relative);
  let values;
  walk(source, (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      values = node.initializer.elements.map((element) => {
        if (!ts.isStringLiteral(element)) throw new Error(`Non-literal enum in ${relative}`);
        return element.text;
      });
    }
  });
  if (!values?.length) throw new Error(`Missing ${name} enum: ${relative}`);
  return values;
}

function buildSchemas() {
  const load = validatorLoader();
  const { tripIdSchema } = load("lib/trip-id.ts");
  const realtime = load("lib/validations/seat-realtime.ts");
  const profile = load("lib/validations/profile.ts");
  const order = load("lib/validations/order.ts");
  const user = load("lib/validations/user.ts");
  const validators = {
    LoginInput: inlineSchema("app/api/auth/login/route.ts"),
    RegisterInput: load("lib/validations/register.ts").registerSchema,
    CustomerUpdateInput: z.union([
      z.object({ action: z.literal("profile"), ...profile.profileSchema.shape }),
      z.object({ action: z.literal("password"), ...profile.passwordSchema.shape }),
    ]),
    OnlineBookingInput: order.onlineOrderSchema,
    OfflineBookingInput: order.offlineOrderSchema,
    TripInput: load("lib/validations/trip.ts").tripSchema,
    BusInput: load("lib/validations/bus.ts").busSchema,
    EmployeeInput: load("lib/validations/employee.ts").employeeSchema,
    UserInput: user.userSchema,
    SeatInteractionInput: realtime.seatInteractionRequestSchema,
    SeatSyncInput: realtime.seatSyncRequestSchema,
    SeatRealtimeMessage: realtime.seatRealtimeMessageSchema,
    SeatHoldInput: inlineSchema("app/api/seats/hold/route.ts", { tripIdSchema, realtimeClientIdSchema: realtime.realtimeClientIdSchema }),
    DemoPaymentInput: inlineSchema("app/api/payments/demo/confirm/route.ts"),
    OrderPaymentInput: inlineSchema("app/api/admin/orders/[id]/payment/route.ts"),
    OrderStatusInput: z.object({ status: z.enum(enumValues("app/api/admin/orders/[id]/route.ts", "allowedStatuses")) }),
    BusStatusInput: z.object({ status: z.enum(enumValues("app/api/buses/[id]/status/route.ts", "allowedStatuses")) }),
    EmployeeStatusInput: z.object({ status: z.enum(enumValues("app/api/employees/[id]/status/route.ts", "allowedStatuses")) }),
    UserRoleInput: z.object({ role: user.userSchema.shape.role.removeDefault().exclude(["CUSTOMER"]) }),
  };
  const schemas = {};
  for (const [name, validator] of Object.entries(validators)) {
    const schema = z.toJSONSchema(validator, { target: "draft-2020-12", io: "input", unrepresentable: "throw" });
    delete schema.$schema;
    schemas[name] = schema;
  }
  // Bus year uses the server's current year + 1. Avoid a stale frozen upper bound.
  const yearSchema = schemas.BusInput.properties.year;
  const removeMaximum = (node) => { if (node && typeof node === "object") { delete node.maximum; for (const value of Object.values(node)) if (typeof value === "object") removeMaximum(value); } };
  removeMaximum(yearSchema);
  yearSchema.description = "Năm tối thiểu 2000; tối đa năm hiện tại của server + 1; chuỗi rỗng được đổi thành null.";
  const object = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required });
  const str = { type: "string" };
  const bool = { type: "boolean" };
  const int = { type: "integer" };
  const data = { description: "Dữ liệu do service trả về; chưa có schema response dùng chung. Cấu trúc bên trong không được suy đoán từ TypeScript hoặc Prisma." };
  const success = { const: true };
  const envelope = (properties, required) => object({ success, ...properties }, required);
  const bookingData = object({ pnr: str, tripId: int, passenger: object({ name: str, phone: str }), seats: { type: "array", items: str }, totalPrice: { type: "number" }, bookingIds: { type: "array", items: int } });
  const paymentData = object({ status: { type: "string", enum: ["NONE", "SUCCESS", "REVIEW"] }, bookingStatus: { type: "string", enum: ["CONFIRMED", "PENDING", "UNAVAILABLE"] } });
  Object.assign(schemas, {
    Error: object({ success: { const: false }, message: str, errors: { type: "array", items: {} } }, ["message"]),
    Success: envelope({}), SuccessMessage: envelope({ message: str }), MessageResult: object({ message: str }),
    DataResult: envelope({ data, message: str }, ["success", "data"]),
    ArrayDataResult: envelope({ data: { type: "array", items: data } }),
    AdminListResult: envelope({ data: { type: "array", items: data }, pagination: data, stats: data, message: str }),
    TripListResult: envelope({ data: { type: "array", items: data }, count: int, pagination: data, stats: data, message: str }, ["success", "data", "pagination"]),
    LookupResult: envelope({ count: int, data: { type: "array", items: data } }),
    BookingCreated: envelope({ message: str, data: bookingData }),
    PaymentResult: envelope({ message: str, data: paymentData }, ["success", "data"]),
    LoginResult: envelope({ redirectTo: str }), RegistrationResult: envelope({ message: str, redirectTo: str }),
    SessionResult: object({ authenticated: bool, user: { anyOf: [object({ id: int, name: str, role: str }), { type: "null" }] } }),
    SeatStateResult: envelope({ capacity: int, bookedSeats: { type: "array", items: str }, holds: { type: "array", items: object({ seatNumber: str, isOwn: bool }) }, selections: { type: "array", items: object({ seatNumber: str, clientId: str }) } }),
    OpenApiDocument: { type: "object", description: "Đặc tả OpenAPI 3.1.1 do generator tạo; không nhúng lặp chính nó." },
  });
  return { schemas, validators };
}

function sourceManifest(routes) {
  const files = [...new Set([
    ...routes.map((route) => route.source), ...filesIn("lib/validations").filter((file) => file.endsWith(".ts")),
    "lib/trip-id.ts", "lib/trip-search.ts", "lib/business-error.ts", "lib/session.ts", "lib/seat-session.ts", "lib/admin-api.ts",
    "lib/public-trip-search.ts", "lib/query-params.ts", "lib/request-origin.ts", "lib/vietqr.ts", "proxy.ts",
    ...filesIn("services").filter((file) => file.endsWith(".ts")),
    "scripts/api-docs-metadata.cjs", "scripts/generate-api-docs.cjs",
  ])].filter((file) => fs.existsSync(path.join(ROOT, file))).sort();
  return Object.fromEntries(files.map((file) => [file, crypto.createHash("sha256").update(read(file).replaceAll("\r\n", "\n")).digest("hex")]));
}

function createSpecification(routes, schemas) {
  const paths = {};
  const errors = { 400: "JSON, tham số hoặc dữ liệu không hợp lệ.", 401: "Chưa đăng nhập hoặc thông tin đăng nhập không hợp lệ.", 403: "Không đủ quyền, nguồn yêu cầu không hợp lệ hoặc tính năng bị tắt.", 404: "Không tìm thấy tài nguyên.", 409: "Xung đột dữ liệu, ghế hoặc trạng thái nghiệp vụ.", 429: "Vượt giới hạn tra cứu; thử lại sau Retry-After.", 500: "Lỗi máy chủ hoặc cấu hình.", 503: "Chưa cấu hình hợp lệ tài khoản VietQR." };
  const reference = (name) => {
    if (!schemas[name]) throw new Error(`Unknown schema ${name}`);
    return { $ref: `#/components/schemas/${name}` };
  };
  for (const route of routes) {
    const details = metadata[route.key];
    const security = details.auth === "admin" ? [{ AdminSessionCookie: [] }]
      : details.auth === "customer" ? [{ SessionCookie: [] }]
      : details.auth === "seat" ? [{ SeatSessionCookie: [] }]
        : details.auth === "optional-admin" ? [{}, { AdminSessionCookie: [] }] : [];
    const authDescription = details.auth === "admin" ? "Yêu cầu đăng nhập bằng tài khoản ADMIN."
      : details.auth === "customer" ? "Yêu cầu phiên tài khoản CUSTOMER đang hoạt động."
        : details.auth === "seat" ? "Yêu cầu cookie seat_session hợp lệ, gắn với clientId."
          : details.auth === "optional-admin" ? "Công khai khi không bật admin=true; admin=true bắt buộc ADMIN." : "Không yêu cầu phiên tài khoản.";
    const responses = {
      [details.status ?? 200]: {
        description: details.mediaType === "text/event-stream" ? "Luồng SSE liên tục; schema mô tả JSON trong mỗi data: frame, không phải toàn bộ HTTP body." : "Yêu cầu thành công.",
        content: { [details.mediaType ?? "application/json"]: { schema: details.mediaType === "text/event-stream" ? { type: "string", description: "Luồng SSE; tham chiếu x-event-schema cho mỗi JSON data frame." } : reference(details.response), ...(details.mediaType ? { "x-event-schema": reference(details.response) } : {}) } },
      },
    };
    const failureStatuses = new Set([...details.errors, ...route.explicitErrors, ...(["admin", "customer"].includes(details.auth) ? [401, 403] : [])]);
    for (const status of [...failureStatuses].sort()) {
      responses[status] = { description: errors[status] ?? "Yêu cầu thất bại.", content: { "application/json": { schema: reference("Error") } }, ...(status === 429 ? { headers: { "Retry-After": { description: "Số giây chờ trước khi thử lại.", schema: { type: "string" } } } } : {}) };
    }
    const parameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map((match) => {
      const numeric = !/^\/api\/(buses|employees)\//.test(route.path);
      return { name: match[1], in: "path", required: true, description: numeric ? "ID nguyên dương, tối đa 2147483647." : "Mã tài nguyên dạng chuỗi; dùng đúng mã được API trả về.", schema: numeric ? { type: "integer", minimum: 1, maximum: 2147483647 } : { type: "string", minLength: 1 } };
    }).concat(details.queries ?? []);
    const operation = {
      operationId: `${route.method.toLowerCase()}_${route.path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
      summary: details.summary, tags: [route.path.split("/")[2]],
      description: [authDescription, details.description, !["GET", "HEAD", "OPTIONS"].includes(route.method) ? "Yêu cầu ghi phải cùng origin với ứng dụng; gửi Content-Type: application/json nếu có body. Cookie do trình duyệt quản lý." : ""].filter(Boolean).join("\n\n"),
      security, "x-access": details.auth, "x-source": route.source,
      ...(parameters.length ? { parameters } : {}),
      ...(details.request ? { requestBody: { required: true, content: { "application/json": { schema: reference(details.request), ...(details.example ? { example: details.example } : {}) } } } } : {}),
      responses,
    };
    if (details.auth === "admin" || details.auth === "customer") operation["x-required-role"] = details.auth === "admin" ? "ADMIN" : "CUSTOMER";
    paths[route.path] ??= {};
    paths[route.path][route.method.toLowerCase()] = operation;
  }
  return {
    openapi: "3.1.1", jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: { title: "SGU Booking API", version: "0.1.0", description: "Sinh từ Route Handlers, Zod validators và metadata được rà soát. Các schema mô tả yêu cầu JSON trước xử lý; refinement, chuẩn hóa/coercion và kiểm tra nghiệp vụ tiếp tục được thực thi trên server. Dữ liệu response chưa có schema runtime được để mở, không khẳng định kiểm chứng CSDL hoặc bảo mật toàn hệ thống." },
    servers: [{ url: "/", description: "Cùng origin với ứng dụng đang chạy." }],
    paths,
    components: {
      securitySchemes: {
        SessionCookie: { type: "apiKey", in: "cookie", name: "customer_session", description: "Cookie HttpOnly sau đăng nhập/đăng ký CUSTOMER, hạn 24 giờ. Bản demo dùng demo_customer_session. Server kiểm tra lại tài khoản và phiên bản mật khẩu." },
        AdminSessionCookie: { type: "apiKey", in: "cookie", name: "admin_session", description: "Cookie HttpOnly riêng cho ADMIN, hạn 24 giờ. Bản demo dùng demo_admin_session. Đăng nhập/đăng xuất khách hàng không thay đổi phiên này." },
        SeatSessionCookie: { type: "apiKey", in: "cookie", name: "seat_session", description: "Cookie HttpOnly được cấp khi đọc holds hoặc mở stream; server kết hợp với clientId để xác định sở hữu." },
      }, schemas,
    },
    "x-generation": { command: "node scripts/generate-api-docs.cjs", check: "node scripts/generate-api-docs.cjs --check", operationCount: routes.length, sourceSha256: sourceManifest(routes) },
  };
}

function markdown(specification) {
  const lines = [
    "# SGU Booking — API reference", "", "<!-- Generated by scripts/generate-api-docs.cjs. Do not edit this file directly. -->", "",
    `Bao phủ **${specification["x-generation"].operationCount} HTTP operation** được export trong app/api/**/route.ts.`, "",
    "Xem giao diện tại `/api-docs`, tải JSON tại `/api/openapi` hoặc dùng file [openapi.json](./openapi.json). Tài liệu và trang xem không cần CDN, tài khoản hoặc kết nối CSDL.", "",
    "## Tái sinh và kiểm tra", "", "```powershell", "node scripts/generate-api-docs.cjs", "node scripts/generate-api-docs.cjs --check", "```", "",
    "`--check` chỉ đọc file và thoát khác 0 khi tài liệu thiếu/cũ. Thêm hoặc xóa handler, thay đổi query/schema/nguồn sẽ yêu cầu cập nhật. Manifest chuẩn hóa CRLF/LF và không ghi thời gian sinh hoặc biến môi trường. Không import Route Handler/Prisma/service để sinh tài liệu.", "",
    "Nguồn gồm route được TypeScript AST phát hiện, Zod validators thực tế, schema inline trích từ AST và metadata trong `scripts/api-docs-metadata.cjs` cho mô tả nghiệp vụ, quyền và response. Metadata mới bắt buộc khi thêm endpoint; query được đối chiếu với source. Đầu vào HTTP HEAD/OPTIONS do Next.js tự sinh không được tính là handler do project triển khai.", "",
    "## Phạm vi và giới hạn", "",
    "- OpenAPI mô tả JSON request; Zod refine/cross-field (ví dụ mật khẩu xác nhận), chuẩn hóa chuỗi, coercion và kiểm tra DB vẫn do server thực hiện. Năm sản xuất xe có giới hạn trên động là năm hiện tại của server + 1.",
    "- Các response envelope đã đối chiếu route; một số dữ liệu `data`, `stats`, `pagination` do service trả chưa có schema runtime và được để mở. Đây không phải schema response được tự suy ra hoặc đã kiểm thử tích hợp.",
    "- Admin dùng cookie `admin_session`; khách hàng dùng `customer_session`. Hai phiên độc lập, thời hạn 24 giờ; bản demo thêm tiền tố `demo_`. Server kiểm tra lại vai trò và trạng thái tài khoản. `admin=true` trên GET /api/trips bắt buộc ADMIN. Cookie HttpOnly do trình duyệt quản lý.",
    "- `GET /api/auth/session` chỉ đọc, không đặt hoặc xóa cookie; nếu có cả hai phiên thì trả tài khoản CUSTOMER. `POST /api/auth/logout?audience=admin` chỉ đăng xuất quản trị, `audience=customer` (mặc định) chỉ đăng xuất khách hàng.",
    "- Mutation phải cùng origin ứng dụng; không cấu hình wildcard CORS. Các cookie thật/mật khẩu thật không được đưa vào tài liệu. Ví dụ chỉ dùng dữ liệu giả và ID minh họa.",
    "- SSE là luồng text/event-stream; schema SeatRealtimeMessage mô tả JSON của từng data frame. Trạng thái chọn tạm chỉ được chia sẻ trong một tiến trình Node.js; chưa có hàng đợi offline hoặc CRDT.",
    "- Thanh toán demo là giả lập và có cờ cấu hình riêng; không xác minh giao dịch ngân hàng. Chạy generator không gọi API, không tạo vé và không kiểm chứng kết quả thực tế của database.", "",
    "## Ví dụ đặt vé", "", "POST `/api/bookings` nhận **seats là mảng**, không phải seatNumber đơn lẻ. Server quyết định giá và trạng thái PENDING:", "", "```json", JSON.stringify(metadata["POST /api/bookings"].example, null, 2), "```", "",
    "ID chuyến và ghế trong ví dụ phải thay bằng dữ liệu thực tế. Nếu truyền clientId, trước tiên tải `/api/trips/{id}/holds?clientId=...` để có cookie seat_session tương ứng. Đặt vé thành công trả data.pnr dùng để tra cứu và thanh toán.", "",
    "## Danh sách endpoint", "", "| Method | Path | Quyền | Mô tả |", "| --- | --- | --- | --- |",
  ];
  const access = { public: "Công khai", admin: "ADMIN", customer: "CUSTOMER", seat: "seat_session", "optional-admin": "Công khai; admin=true cần ADMIN" };
  for (const [apiPath, operations] of Object.entries(specification.paths)) {
    for (const [method, operation] of Object.entries(operations)) lines.push(`| ${method.toUpperCase()} | \`${apiPath}\` | ${access[operation["x-access"]]} | ${operation.summary} |`);
  }
  lines.push("", "## Tài liệu chuẩn", "", "- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html).", "- [Zod — native JSON Schema conversion](https://zod.dev/json-schema), dùng z.toJSONSchema với io=input và target=draft-2020-12.", "", "Đọc chi tiết parameters, body, response, mã lỗi và source của từng operation trong JSON hoặc giao diện `/api-docs`. Những mô tả thủ công cần được rà soát khi thay đổi nghiệp vụ; manifest phát hiện thay đổi source để tránh vô tình dùng bản tài liệu cũ.", "");
  return lines.join("\n");
}

function generate() {
  const routes = discoverRoutes();
  validateCoverage(routes);
  const { schemas } = buildSchemas();
  const specification = createSpecification(routes, schemas);
  return { "documentation/api/openapi.json": `${JSON.stringify(specification, null, 2)}\n`, "documentation/api/README.md": markdown(specification) };
}

function checkArtifacts(outputs, root = ROOT) {
  const stale = Object.entries(outputs).filter(([relative, content]) => {
    const destination = path.join(root, relative);
    return !fs.existsSync(destination) || fs.readFileSync(destination, "utf8").replaceAll("\r\n", "\n") !== content;
  }).map(([relative]) => relative);
  if (stale.length) throw new Error(`API documentation is stale: ${stale.join(", ")}. Run node scripts/generate-api-docs.cjs`);
}

function main() {
  const check = process.argv.includes("--check");
  const outputs = generate();
  if (check) {
    checkArtifacts(outputs);
    process.stdout.write("API documentation is up to date.\n");
    return;
  }
  for (const [relative, content] of Object.entries(outputs)) {
    const destination = path.join(ROOT, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, "utf8");
  }
  process.stdout.write("Generated documentation/api/openapi.json and README.md.\n");
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { discoverRoutes, validateCoverage, buildSchemas, createSpecification, generate, checkArtifacts };
