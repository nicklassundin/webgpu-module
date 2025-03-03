// create class for shapes

class Shape {
	constructor(public x: number, public y: number) {
		this.arrayStrid = 2 * 4
	}
	// Array of Float32Array
	vertices: Float32Array[];
	constructor(public x: number, public y: number) {
	}
	// map and sum all Float32Array.byteLength
	byteLength: number;
	// get all Float32Array
	getVertices(): Float32Array[] {
		return this.vertices;
	}
	arrayStrid: number;
}

class Triangle extends Shape {
	constructor(x: number, y: number, public width: number, public height: number) {
		super(x, y);


		this.vertices = [
			new Float32Array([x, y, x + width, y, x + width / 2, y + height])
		];
		this.byteLength = this.vertices.map(v => v.byteLength).reduce((a, b) => a + b);
	}
}

class Hexagon extends Shape {
	constructor(x: number, y: number, public width: number, public height: number) {
		super(x, y);
		this.vertices = [
			new Float32Array([x, y, x + width, y, x + width + width / 2, y + height / 2, x + width, y + height, x, y + height, x - width / 2, y + height / 2])
		];
		this.byteLength = this.vertices.map(v => v.byteLength).reduce((a, b) => a + b);
	}
}

export { Shape, Triangle, Hexagon };

