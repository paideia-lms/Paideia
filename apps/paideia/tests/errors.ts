export class TestError extends Error {
	constructor(message: string, options: { cause?: unknown } = {}) {
		super(message);
		this.name = "TestError";
		this.cause = options.cause;
	}
}