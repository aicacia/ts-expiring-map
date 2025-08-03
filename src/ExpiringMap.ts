type Timeout = ReturnType<typeof setTimeout>;

interface Entry<V> {
	value: V;
	expiresAt: number;
	timeout?: Timeout;
}

export interface ExpiringMapOptions<K, V> {
	defaultTtlMs: number;
	lazyEviction?: boolean;
	onExpire?: (key: K, value: V) => void;
}

export class ExpiringMap<K, V> implements Map<K, V> {
	#defaultTtlMs: number;
	#lazyEviction: boolean;
	#onExpire?: (key: K, value: V) => void;
	#store = new Map<K, Entry<V>>();

	constructor(options: ExpiringMapOptions<K, V>) {
		if (options.defaultTtlMs <= 0) {
			throw new Error("TTL must be greater than 0");
		}
		this.#defaultTtlMs = options.defaultTtlMs;
		this.#lazyEviction = options.lazyEviction ?? false;
		this.#onExpire = options.onExpire;
	}

	#isExpired(entry: Entry<V>): boolean {
		return Date.now() >= entry.expiresAt;
	}

	set(key: K, value: V): this;
	set(key: K, value: V, ttlMs?: number): this;

	set(key: K, value: V, ttlMs?: number): this {
		const ttl = ttlMs ?? this.#defaultTtlMs;
		const expiresAt = Date.now() + ttl;
		let timeout: Timeout | undefined;

		if (this.#lazyEviction) {
			this.delete(key);
		} else {
			timeout = setTimeout(() => {
				const entry = this.#store.get(key);
				if (entry) {
					this.#store.delete(key);
					if (this.#onExpire) {
						this.#onExpire(key, entry.value);
					}
				}
			}, ttl);
		}

		this.#store.set(key, { value, expiresAt, timeout });

		return this;
	}

	get(key: K): V | undefined {
		const entry = this.#store.get(key);
		if (!entry) {
			return undefined;
		}

		if (this.#lazyEviction && this.#isExpired(entry)) {
			this.delete(key);
			if (this.#onExpire) {
				this.#onExpire(key, entry.value);
			}
			return undefined;
		}

		return entry.value;
	}

	has(key: K): boolean {
		const entry = this.#store.get(key);
		if (!entry) {
			return false;
		}

		if (this.#lazyEviction && this.#isExpired(entry)) {
			this.delete(key);
			if (this.#onExpire) {
				this.#onExpire(key, entry.value);
			}
			return false;
		}

		return true;
	}

	delete(key: K): boolean {
		const entry = this.#store.get(key);
		if (entry?.timeout) {
			clearTimeout(entry.timeout);
		}
		return this.#store.delete(key);
	}

	clear(): void {
		for (const [, entry] of this.#store) {
			if (entry.timeout) {
				clearTimeout(entry.timeout);
			}
		}
		this.#store.clear();
	}

	get size(): number {
		if (!this.#lazyEviction) {
			return this.#store.size;
		}

		for (const key of this.#store.keys()) {
			this.has(key);
		}

		return this.#store.size;
	}

	*keys(): MapIterator<K> {
		for (const key of this.#store.keys()) {
			if (this.has(key)) {
				yield key;
			}
		}
	}

	*values(): MapIterator<V> {
		for (const [key, entry] of this.#store.entries()) {
			if (this.has(key)) {
				yield entry.value;
			}
		}
	}

	*entries(): MapIterator<[K, V]> {
		for (const [key, entry] of this.#store.entries()) {
			if (this.has(key)) {
				yield [key, entry.value];
			}
		}
	}

	forEach(callback: (value: V, key: K, map: this) => void): void {
		for (const [key, value] of this.entries()) {
			callback(value, key, this);
		}
	}

	[Symbol.iterator](): MapIterator<[K, V]> {
		return this.entries();
	}

	[Symbol.toStringTag] = "ExpiringMap";
}
