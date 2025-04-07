
struct Node {
	valueAddress: f32,
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: f32,
	address: f32,
	coord: vec2<f32>,
	boundBox: vec4<f32>,
};

@group(0) @binding(0) var<storage, read_write> result: array<f32>;
@group(0) @binding(1) var<storage, read_write> traversal: array<Traversal>; 

@group(1) @binding(0) var<storage, read> selected: array<f32>;
@group(1) @binding(1) var<storage, read> levelValues: array<f32>;


@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let index = global_id.x;
	//let index = u32(traversal.depth);
		
	result[index] = abs(selected[index] - levelValues[index]);
	//result[index] = index;
}
