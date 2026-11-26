const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./load-ts.cjs");

async function renderHome(routes) {
  const Home = load("app/(client)/page.tsx", {
    "next/server": { connection: async () => {} },
    "@/services/tripService": {
      getFeaturedRoutes: async () => routes,
      getTripSearchOptions: async () => [{ from: "Huế", to: "Quảng Bình", date: "2026-10-20" }],
    },
  }).default;
  return renderToStaticMarkup(await Home());
}

test("home displays database search options and each available route with its own price and link", async () => {
  const routes = [
    { from: "Huế", to: "Quảng Bình", _min: { price: 190000 } },
    { from: "Huế", to: "Đà Nẵng", _min: { price: 140000 } },
    { from: "Hà Nội", to: "Hải Phòng", _min: { price: 120000 } },
  ];
  const html = await renderHome(routes);
  assert.ok(html.includes('<option value="Huế">Huế</option>'));
  assert.ok(html.includes('<option value="Quảng Bình">Quảng Bình</option>'));
  assert.ok(html.includes('name="date"'));
  assert.ok(html.includes('method="GET"'));
  for (const route of routes) {
    const query = new URLSearchParams({ from: route.from, to: route.to }).toString().replaceAll("&", "&amp;");
    assert.ok(html.includes(`/trips?${query}`));
    assert.ok(html.includes(route._min.price.toLocaleString("vi-VN") + "đ"));
  }
});

test("home explains an empty sale list without inventing route prices", async () => {
  const html = await renderHome([]);
  assert.ok(html.includes("Hiện chưa có tuyến xe đang mở bán."));
  assert.ok(html.includes("Các chuyến đã khởi hành hoặc hết ghế không xuất hiện ở đây."));
  assert.ok(!html.includes("Giá vé từ"));
});
