
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
	coord: vec2<f32>,
	address: f32,
};

@group(1) @binding(0) var<storage, read_write> traversal: Traversal;
@group(1) @binding(1) var<storage, read_write> values: array<f32>;
@group(1) @binding(2) var<storage, read_write> nodes: array<Node>;
@group(1) @binding(3) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let depth = traversal.depth;
	let id = global_id.x % u32(depth);
	
	let traversalNode = traversal.address;
	let node = nodes[u32(traversalNode)];
	let value = values[u32(node.valueAddress)];
	result[u32(depth)] = value;

	traversal.address = f32(node.children[0]);
}
