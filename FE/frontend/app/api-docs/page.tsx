import specification from "@/documentation/api/openapi.json";
import Link from "next/link";

export const metadata = {
  title: "API reference | SGU Booking",
  description: "Tài liệu API SGU Booking: tham số, xác thực, yêu cầu và phản hồi.",
};

type Schema = Record<string, unknown>;
type Operation = {
  operationId: string;
  summary: string;
  description: string;
  "x-access": string;
  "x-source": string;
  parameters?: { name: string; in: string; required: boolean; description: string; schema: Schema }[];
  requestBody?: { content: Record<string, { schema: Schema; example?: unknown }> };
  responses: Record<string, { description: string; content: Record<string, { schema: Schema; "x-event-schema"?: Schema }> }>;
};
type Specification = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
  "x-generation": { operationCount: number };
};

const api = specification as unknown as Specification;
const accessLabels: Record<string, string> = {
  public: "Công khai",
  admin: "Phiên ADMIN",
  customer: "Phiên CUSTOMER",
  seat: "Cookie seat_session",
  "optional-admin": "admin=true cần ADMIN",
};

function schemaFor(schema: Schema): Schema {
  const reference = schema.$ref;
  return typeof reference === "string" && reference.startsWith("#/components/schemas/")
    ? api.components.schemas[reference.split("/").at(-1)!] ?? schema
    : schema;
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(value, null, 2)}</pre>;
}

export default async function ApiDocumentationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").slice(0, 200);
  const search = query.toLocaleLowerCase("vi");
  const operations = Object.entries(api.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({ path, method: method.toUpperCase(), operation })),
  ).filter(({ path, method, operation }) => `${method} ${path} ${operation.summary}`.toLocaleLowerCase("vi").includes(search));

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-medium text-teal-700">← SGU Booking</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Developer reference</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">SGU Booking API</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {api["x-generation"].operationCount} thao tác HTTP · OpenAPI 3.1.1 · URL tương đối theo máy chủ hiện tại.
              Mở từng endpoint để xem tham số, quyền truy cập và dữ liệu JSON.
            </p>
          </div>
          <a href="/api/openapi" className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">Xem OpenAPI JSON</a>
        </div>

        <aside className="my-8 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          <p><strong className="text-slate-900">Xác thực:</strong> đăng nhập cấp cookie HttpOnly riêng <code>admin_session</code> cho ADMIN và <code>customer_session</code> cho CUSTOMER, thời hạn 24 giờ. Hai phiên độc lập; bản demo thêm tiền tố <code>demo_</code>. Realtime sử dụng cookie <code>seat_session</code> cùng mã tab <code>clientId</code>. Yêu cầu ghi phải cùng origin với ứng dụng.</p>
          <p className="mt-2">Schema request được sinh từ Zod. Các kiểm tra liên quan nhiều trường và quy tắc nghiệp vụ tiếp tục chạy ở server. Dữ liệu service chưa có schema response được để mở. Thanh toán demo là giả lập.</p>
        </aside>

        <form action="/api-docs" method="get" className="mb-7 flex gap-3">
          <label className="sr-only" htmlFor="api-search">Tìm endpoint</label>
          <input id="api-search" name="q" type="search" defaultValue={query} placeholder="Tìm theo đường dẫn, phương thức hoặc chức năng…" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm" />
          <button className="rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold" type="submit">Tìm</button>
        </form>
        <p className="mb-4 text-sm text-slate-500">{operations.length} thao tác{query ? ` khớp “${query}”` : ""}</p>

        <div className="space-y-3">
          {operations.map(({ path, method, operation }) => (
            <details key={operation.operationId} id={operation.operationId} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-5 marker:text-slate-400">
                <span className={`min-w-16 rounded px-2 py-1 text-center text-xs font-bold ${method === "GET" ? "bg-blue-50 text-blue-700" : method === "DELETE" ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal-800"}`}>{method}</span>
                <code className="break-all text-sm font-semibold">{path}</code>
                <span className="text-sm text-slate-600">{operation.summary}</span>
                <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{accessLabels[operation["x-access"]]}</span>
              </summary>
              <div className="space-y-6 border-t border-slate-100 p-5 text-sm">
                <p className="whitespace-pre-line leading-7 text-slate-600">{operation.description}</p>
                {operation.parameters && (
                  <div className="overflow-x-auto">
                    <h2 className="mb-3 font-semibold">Tham số</h2>
                    <table className="w-full border-collapse text-left text-xs">
                      <thead><tr className="border-b text-slate-500"><th className="py-2 pr-4">Tên</th><th className="py-2 pr-4">Vị trí</th><th className="py-2 pr-4">Bắt buộc</th><th className="py-2">Mô tả</th></tr></thead>
                      <tbody>{operation.parameters.map((parameter) => <tr key={`${parameter.in}-${parameter.name}`} className="border-b border-slate-100"><td className="py-3 pr-4"><code>{parameter.name}</code></td><td className="py-3 pr-4">{parameter.in}</td><td className="py-3 pr-4">{parameter.required ? "Có" : "Không"}</td><td className="py-3 leading-5">{parameter.description}{Array.isArray(parameter.schema.enum) && <span className="block text-slate-500">Giá trị: {parameter.schema.enum.join(", ")}</span>}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                {operation.requestBody && Object.entries(operation.requestBody.content).map(([mediaType, content]) => (
                  <section key={mediaType} className="space-y-3">
                    <h2 className="font-semibold">Request body · {mediaType}</h2>
                    {content.example !== undefined && <><p className="text-xs text-slate-500">Ví dụ với dữ liệu giả; thay ID và ghế bằng dữ liệu phù hợp.</p><JsonBlock value={content.example} /></>}
                    <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer font-medium">Schema yêu cầu</summary><div className="mt-3"><JsonBlock value={schemaFor(content.schema)} /></div></details>
                  </section>
                ))}
                <section className="space-y-3">
                  <h2 className="font-semibold">Phản hồi</h2>
                  {Object.entries(operation.responses).map(([status, response]) => <details key={status} className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer"><strong className="mr-3">{status}</strong>{response.description}</summary>{Object.entries(response.content).map(([mediaType, content]) => <div key={mediaType} className="mt-3 space-y-2"><p className="text-xs text-slate-500">{mediaType}{content["x-event-schema"] ? " · schema JSON của từng SSE data frame" : ""}</p><JsonBlock value={schemaFor(content["x-event-schema"] ?? content.schema)} /></div>)}</details>)}
                </section>
                <p className="text-xs text-slate-400">Source: <code>{operation["x-source"]}</code></p>
              </div>
            </details>
          ))}
        </div>
        <footer className="mt-10 text-xs leading-6 text-slate-500">
          Sinh tự động từ source và metadata đã rà soát. Chuẩn: <a className="underline" href="https://spec.openapis.org/oas/v3.1.1.html">OpenAPI 3.1.1</a> · <a className="underline" href="https://zod.dev/json-schema">Zod JSON Schema</a>.
        </footer>
      </div>
    </main>
  );
}
