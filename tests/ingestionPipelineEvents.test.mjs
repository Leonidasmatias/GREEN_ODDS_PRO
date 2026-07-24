import test from "node:test";
import assert from "node:assert/strict";
import { PipelineEventBus } from "../src/providers/pipeline/PipelineEvents.ts";

test("emit() delivers the event to every registered listener", () => {
  const bus = new PipelineEventBus();
  const received = [];
  bus.on((event) => received.push(event));
  bus.on((event) => received.push(event));

  bus.emit({ type: "MatchDuplicated", match: { id: "m1" } });

  assert.equal(received.length, 2);
  assert.equal(received[0].type, "MatchDuplicated");
});

test("the unsubscribe function returned by on() stops further delivery", () => {
  const bus = new PipelineEventBus();
  const received = [];
  const unsubscribe = bus.on((event) => received.push(event));

  bus.emit({ type: "MatchImported", match: { id: "m1" } });
  unsubscribe();
  bus.emit({ type: "MatchImported", match: { id: "m2" } });

  assert.equal(received.length, 1);
});

test("emitting with no listeners registered does not throw", () => {
  const bus = new PipelineEventBus();
  assert.doesNotThrow(() => bus.emit({ type: "AggregationCompleted", summary: {} }));
});

test("listenerCount reflects registrations and unsubscriptions", () => {
  const bus = new PipelineEventBus();
  assert.equal(bus.listenerCount(), 0);
  const unsubscribe = bus.on(() => {});
  assert.equal(bus.listenerCount(), 1);
  unsubscribe();
  assert.equal(bus.listenerCount(), 0);
});

test("all six documented event types can be emitted and are distinguishable by `type`", () => {
  const bus = new PipelineEventBus();
  const seen = [];
  bus.on((event) => seen.push(event.type));

  bus.emit({ type: "MatchImported", match: {} });
  bus.emit({ type: "MatchUpdated", match: {} });
  bus.emit({ type: "MatchIgnored", match: {}, reason: "x" });
  bus.emit({ type: "MatchDuplicated", match: {} });
  bus.emit({ type: "MatchRejected", raw: {}, errors: [] });
  bus.emit({ type: "AggregationCompleted", summary: {} });

  assert.deepEqual(seen, [
    "MatchImported",
    "MatchUpdated",
    "MatchIgnored",
    "MatchDuplicated",
    "MatchRejected",
    "AggregationCompleted",
  ]);
});
