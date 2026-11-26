const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load-ts.cjs");

// Chạy hook với state/effect tối thiểu để kiểm tra các request hoàn tất khác thứ tự.
function createRemoteDataHarness() {
  const states = [];
  const effects = [];
  let stateIndex = 0;
  let cleanup;
  let dependencies;
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      }];
    },
    useCallback(callback) { return callback; },
    useEffect(effect, nextDependencies) {
      if (!dependencies || nextDependencies.some((value, index) => value !== dependencies[index])) {
        if (cleanup) cleanup();
        dependencies = nextDependencies;
        effects.push(effect);
      }
    },
  };
  const { useRemoteData } = load("hooks/useRemoteData.ts", { react });
  return {
    render(loader, initialData = []) {
      stateIndex = 0;
      const result = useRemoteData(loader, initialData);
      while (effects.length) cleanup = effects.shift()();
      return result;
    },
    unmount() { if (cleanup) cleanup(); },
  };
}

function deferredRequest() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

test("remote data ignores a cancelled response after the filters change", async () => {
  const harness = createRemoteDataHarness();
  const first = deferredRequest();
  const second = deferredRequest();
  let firstSignal;
  const firstLoader = (signal) => { firstSignal = signal; return first.promise; };
  const secondLoader = () => second.promise;
  assert.equal(harness.render(firstLoader).loading, true);
  assert.equal(harness.render(secondLoader).loading, true);
  assert.equal(firstSignal.aborted, true);
  second.resolve(["new trip"]);
  await second.promise;
  first.resolve(["old trip"]);
  await first.promise;
  const result = harness.render(secondLoader);
  assert.deepEqual(result.data, ["new trip"]);
  assert.equal(result.loading, false);
  assert.equal(result.error, null);
  harness.unmount();
});

test("remote data retains previous data on failure and clears errors while retrying", async () => {
  const harness = createRemoteDataHarness();
  const requests = [];
  const loader = () => {
    const request = deferredRequest();
    requests.push(request);
    return request.promise;
  };
  harness.render(loader);
  requests[0].resolve(["saved trip"]);
  await requests[0].promise;
  let result = harness.render(loader);
  result.refresh();
  assert.equal(harness.render(loader).loading, true);
  requests[1].reject(new Error("Không thể tải dữ liệu"));
  await requests[1].promise.catch(() => {});
  result = harness.render(loader);
  assert.deepEqual(result.data, ["saved trip"]);
  assert.equal(result.error, "Không thể tải dữ liệu");
  assert.equal(result.loading, false);
  result.refresh();
  result = harness.render(loader);
  assert.equal(result.error, null);
  assert.equal(result.loading, true);
  requests[2].resolve(["retried trip"]);
  await requests[2].promise;
  result = harness.render(loader);
  assert.deepEqual(result.data, ["retried trip"]);
  assert.equal(result.error, null);
  harness.unmount();
});

test("unmount cancels the request and ignores its late failure", async () => {
  const harness = createRemoteDataHarness();
  const request = deferredRequest();
  let signal;
  const loader = (requestSignal) => { signal = requestSignal; return request.promise; };
  harness.render(loader, ["initial data"]);
  harness.unmount();
  assert.equal(signal.aborted, true);
  request.reject(new Error("late failure"));
  await request.promise.catch(() => {});
  const result = harness.render(loader);
  assert.deepEqual(result.data, ["initial data"]);
  assert.equal(result.error, null);
});
