
struct Uniforms {
	resolution: vec2<f32>,
	mipLevel: f32,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms; 


struct Node {
	valueAddress: f32,
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: f32,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};


// function to get quad index from cordinates and boundbox
fn getQuadIndex(coord: vec2<f32>, boundBox: vec4<f32>) -> u32 {
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	var quad = vec2<f32>(0.0, 0.0);
	if (coord.x > center.x) {
	 	quad.x = 1.0;
	}
	if (coord.y > center.y) {
		quad.y = 1.0;
	}
	return u32(quad.x + quad.y * 2.0);
}

@group(1) @binding(0) var<storage, read_write> traversal: Traversal;
@group(1) @binding(1) var<storage, read_write> values: array<f32>;
@group(1) @binding(2) var<storage, read_write> nodes: array<Node>;

@group(1) @binding(3) var<storage, read_write> result: array<f32>;




@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let i = global_id.x;
	let depth = global_id.y;
	let address = i32(traversal.address);
	let node = nodes[address].children[i];
	if node == 0.0 {
		return;
	}
	var boundBox = traversal.boundBox;
	if boundBox.x == 0.0 && boundBox.y == 0.0 && boundBox.z == 0.0 && boundBox.w == 0.0 {
		boundBox = vec4<f32>(0.0, 0.0, 1.0, 1.0);
	}
	let value = values[address];
	let quad = getQuadIndex(traversal.coord.xy, boundBox);
	if quad == i {
		traversal.address = node;
		result[u32(traversal.depth)] = value;
		traversal.depth = traversal.depth + 1.0;
		if quad == 0 {
			traversal.boundBox = vec4<f32>(boundBox.xy, (boundBox.xy + boundBox.zw) * 0.5);
		} else if quad == 1 {
			traversal.boundBox = vec4<f32>((boundBox.xy + boundBox.zw) * 0.5, boundBox.zw);
		} else if quad == 2 {
			traversal.boundBox = vec4<f32>(vec2<f32>(boundBox.x, (boundBox.y + boundBox.w) * 0.5), vec2<f32>((boundBox.x + boundBox.z) * 0.5, boundBox.w));
		} else if quad == 3 {
			traversal.boundBox = vec4<f32>(vec2<f32>((boundBox.x + boundBox.z) * 0.5, (boundBox.y + boundBox.w) * 0.5), boundBox.zw);
		}
	}
}
