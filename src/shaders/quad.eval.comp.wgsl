
struct Node {
	valueAddress: f32,
	offset: f32,
	size: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	depth: f32,
	_pad: vec3<f32>,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
	_pad2: vec3<f32>,
	_pad4: vec4<f32>,
	_pad5: vec4<f32>,
};

@group(0) @binding(0) var texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read_write> result: array<f32>;
@group(0) @binding(2) var<storage, read_write> traversal: Traversal;



@group(1) @binding(0) var<storage, read> selected: array<f32>;
@group(1) @binding(1) var<storage, read> levelValues: array<f32>;


@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let depth = global_id.x;
	
	result[depth] = abs(selected[depth] - levelValues[depth]);
}
