import tape from "tape";
import { ExpiringMap } from "./ExpiringMap";

tape("ExpiringMap: basic set/get/has/delete", (assert) => {
	const map = new ExpiringMap<string, number>({ defaultTtlMs: 1000 });

	map.set("a", 1);
	assert.equal(map.get("a"), 1, "get returns stored value");
	assert.equal(map.has("a"), true, "has returns true for existing key");

	map.delete("a");
	assert.equal(map.get("a"), undefined, "get returns undefined after delete");
	assert.equal(map.has("a"), false, "has returns false after delete");

	map.clear();
	assert.equal(map.size, 0, "size is 0 after clear");

	assert.end();
});

tape("ExpiringMap: eager eviction removes expired entries", (assert) => {
	const map = new ExpiringMap<string, number>({
		defaultTtlMs: 50,
		lazyEviction: false,
	});

	map.set("a", 1);
	assert.equal(map.has("a"), true, "has before expiration is true");

	setTimeout(() => {
		assert.equal(map.get("a"), undefined, "get after expiration is undefined");
		assert.equal(map.has("a"), false, "has after expiration is false");
		assert.equal(map.size, 0, "size is 0 after expiration");
		assert.end();
	}, 70);
});

tape(
	"ExpiringMap: lazy eviction removes expired entries on access",
	(assert) => {
		const map = new ExpiringMap<string, number>({
			defaultTtlMs: 50,
			lazyEviction: true,
		});

		map.set("a", 1);
		assert.equal(map.has("a"), true, "has before expiration is true");

		setTimeout(() => {
			assert.equal(
				map.has("a"),
				false,
				"has after expiration returns false (lazy eviction)",
			);
			assert.equal(
				map.get("a"),
				undefined,
				"get after expiration returns undefined",
			);
			assert.equal(map.size, 0, "size is 0 after lazy eviction");
			assert.end();
		}, 70);
	},
);

tape("ExpiringMap: onExpire callback fires on eager eviction", (assert) => {
	assert.plan(2);

	const map = new ExpiringMap<string, number>({
		defaultTtlMs: 50,
		lazyEviction: false,
		onExpire: (key, value) => {
			assert.equal(key, "a", "onExpire called with correct key");
			assert.equal(value, 1, "onExpire called with correct value");
		},
	});

	map.set("a", 1);
});

tape("ExpiringMap: onExpire callback fires on lazy eviction", (assert) => {
	assert.plan(3);

	const map = new ExpiringMap<string, number>({
		defaultTtlMs: 50,
		lazyEviction: true,
		onExpire: (key, value) => {
			assert.equal(key, "a", "onExpire called with correct key");
			assert.equal(value, 1, "onExpire called with correct value");
		},
	});

	map.set("a", 1);

	setTimeout(() => {
		// triggers lazy eviction and onExpire
		assert.equal(map.get("a"), undefined);
	}, 70);
});

tape(
	"ExpiringMap: size getter cleans expired entries in lazy mode",
	(assert) => {
		const map = new ExpiringMap<string, number>({
			defaultTtlMs: 50,
			lazyEviction: true,
		});
		map.set("a", 1);
		map.set("b", 2);

		assert.equal(map.size, 2, "size before expiration is correct");

		setTimeout(() => {
			assert.equal(
				map.size,
				0,
				"size after expiration is 0 (expired entries removed)",
			);
			assert.end();
		}, 70);
	},
);

tape("ExpiringMap: iteration methods return valid entries", (assert) => {
	const map = new ExpiringMap<string, number>({ defaultTtlMs: 1000 });
	map.set("a", 1);
	map.set("b", 2);

	const keys = Array.from(map.keys()).sort();
	assert.deepEqual(keys, ["a", "b"], "keys() returns all keys");

	const values = Array.from(map.values()).sort();
	assert.deepEqual(values, [1, 2], "values() returns all values");

	const entries = Array.from(map.entries()).sort((a, b) =>
		a[0].localeCompare(b[0]),
	);
	assert.deepEqual(
		entries,
		[
			["a", 1],
			["b", 2],
		],
		"entries() returns all entries",
	);

	const forEachItems: Array<[string, number]> = [];
	map.forEach((value, key) => {
		forEachItems.push([key, value]);
	});
	const sortedForEach = forEachItems.sort((a, b) => a[0].localeCompare(b[0]));
	assert.deepEqual(
		sortedForEach,
		[
			["a", 1],
			["b", 2],
		],
		"forEach() iterates all entries",
	);

	assert.end();
});

tape("ExpiringMap: supports custom TTL per entry", (assert) => {
	const map = new ExpiringMap<string, number>({ defaultTtlMs: 100 });
	map.set("short", 1, 50);
	map.set("long", 2, 200);

	setTimeout(() => {
		assert.equal(map.has("short"), false, "short TTL expired");
		assert.equal(map.has("long"), true, "long TTL still valid");
		assert.end();
	}, 80);
});

tape(
	"ExpiringMap: onExpire called when accessing expired key with has() in lazy mode",
	(assert) => {
		assert.plan(3);

		const map = new ExpiringMap<string, number>({
			defaultTtlMs: 50,
			lazyEviction: true,
			onExpire: (key, value) => {
				assert.equal(key, "a", "onExpire called with correct key");
				assert.equal(value, 1, "onExpire called with correct value");
			},
		});

		map.set("a", 1);

		setTimeout(() => {
			assert.equal(map.has("a"), false, "has() triggers onExpire after TTL");
		}, 70);
	},
);

tape(
	"ExpiringMap: onExpire not called by clear(), but timer should be canceled",
	(assert) => {
		assert.plan(2);

		let expired = false;

		const map = new ExpiringMap<string, number>({
			defaultTtlMs: 100,
			lazyEviction: false,
			onExpire: () => {
				expired = true;
			},
		});

		map.set("a", 1);
		map.set("b", 2);

		map.clear(); // should cancel timers before expiry

		setTimeout(() => {
			assert.equal(map.has("a"), false, "has(a) after clear is false");
			assert.equal(expired, false, "onExpire was not called after clear");
			assert.end();
		}, 150);
	},
);
